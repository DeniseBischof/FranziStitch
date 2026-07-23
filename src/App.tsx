import { useEffect, useMemo, useRef, useState } from "react";
import { EXAMPLE_DESIGNS } from "./examples";
import { COPY, objectDisplayName, translatedError, translatedIssue, type Language } from "./i18n";
import { useObjectHistory } from "./hooks/useObjectHistory";
import { prepareEmbroideryObjects } from "./lib/converter";
import { createEmbroideryFile } from "./lib/embroideryFile";
import { FABRIC_PROFILES, MACHINE_PROFILES } from "./lib/profiles";
import { createProject, parseProject, serializeProject } from "./lib/project";
import { cancelConversion, convertObjectsInWorker } from "./lib/workerClient";
import type { ConversionResult, ConversionSettings, DesignSource, EmbroideryFormat, EmbroideryObject, FabricProfileId, HoopPreset, MachineProfileId, StitchBlock, StitchStyle, StitchStyleType, TextFont, UnderlayType } from "./types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const DEFAULT_SETTINGS: ConversionSettings = {
  hoopPreset: "100x100", hoopWidthMm: 100, hoopHeightMm: 100, targetWidthMm: 72, targetHeightMm: 72,
  lockAspectRatio: true, stitchLengthMm: 2.5, rowSpacingMm: 0.45, fillAngleDeg: 45, marginMm: 4,
  minimumStitchMm: 0.5, satinMaxWidthMm: 12, fabricProfileId: "woven", machineProfileId: "generic-dst", exportFormat: "dst",
};
const HOOPS: Record<Exclude<HoopPreset, "custom">, [number, number]> = { "100x100": [100, 100], "130x180": [130, 180], "200x200": [200, 200] };
const FONT_OPTIONS: { value: TextFont; label: string; description: Record<Language, string>; className: string }[] = [
  { value: "noto-sans", label: "Noto Sans", description: { de: "klar", en: "clean" }, className: "font-sans-preview" },
  { value: "montserrat", label: "Montserrat", description: { de: "kräftig", en: "bold" }, className: "font-montserrat-preview" },
  { value: "bungee", label: "Bungee", description: { de: "plakativ", en: "display" }, className: "font-bungee-preview" },
  { value: "noto-serif", label: "Noto Serif", description: { de: "klassisch", en: "classic" }, className: "font-serif-preview" },
  { value: "playfair", label: "Playfair Display", description: { de: "elegant", en: "elegant" }, className: "font-playfair-preview" },
  { value: "pacifico", label: "Pacifico", description: { de: "handschriftlich", en: "handwritten" }, className: "font-script-preview" },
  { value: "lobster", label: "Lobster", description: { de: "retro", en: "retro" }, className: "font-lobster-preview" },
];

function safeName(value: string) {
  return value.trim().toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "franzistitch-motiv";
}

function stitchPath(block: StitchBlock, limit = Number.POSITIVE_INFINITY) {
  let data = ""; let count = 0;
  for (const point of block.stitches) {
    if (count++ >= limit) break;
    if (point.command === "trim" || point.command === "stop") continue;
    data += `${point.command === "jump" ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)} `;
  }
  return data;
}

function jumpPath(block: StitchBlock, limit = Number.POSITIVE_INFINITY) {
  let data = ""; let previous = block.stitches[0]; let count = 0;
  for (const point of block.stitches.slice(1)) {
    if (count++ >= limit) break;
    if (point.command === "jump" && previous) data += `M${previous.x.toFixed(2)} ${previous.y.toFixed(2)} L${point.x.toFixed(2)} ${point.y.toFixed(2)} `;
    if (point.command === "stitch" || point.command === "jump") previous = point;
  }
  return data;
}

export default function App() {
  const history = useObjectHistory();
  const [language, setLanguage] = useState<Language>("de");
  const [mode, setMode] = useState<"svg" | "text">("svg");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [text, setText] = useState("Franzi"); const [font, setFont] = useState<TextFont>("noto-sans"); const [textColor, setTextColor] = useState("#e24b2d");
  const [fileName, setFileName] = useState("franzistitch-motiv"); const [sourceLabel, setSourceLabel] = useState("");
  const [result, setResult] = useState<ConversionResult | null>(null); const [error, setError] = useState(""); const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0); const [dragging, setDragging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [playhead, setPlayhead] = useState(0); const [playing, setPlaying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null); const projectRef = useRef<HTMLInputElement>(null);
  const selected = history.objects.find((object) => object.id === selectedId) ?? null;
  const c = COPY[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `FranziStitch – ${language === "de" ? "SVG & Text zu Stickdateien" : "SVG & text to stitch files"}`;
  }, [language]);

  useEffect(() => {
    if (!history.objects.length) { setResult(null); return; }
    const timer = window.setTimeout(() => {
      setBusy(true); setProgress(0); setError("");
      convertObjectsInWorker(history.objects, settings, setProgress)
        .then((next) => {
          if (sourceWarnings.length) next.issues.unshift(...sourceWarnings.map((message, index) => ({ id: `source-${index}`, severity: "warning" as const, code: "unsupported" as const, message })));
          setResult(next); setPlayhead(next.blocks.reduce((sum, block) => sum + block.stitches.length, 0));
        })
        .catch((problem) => {
          if (!(problem instanceof DOMException && problem.name === "AbortError")) {
            setResult(null); const message = problem instanceof Error ? problem.message : ""; setError(translatedError(message, language, c.conversionError));
          }
        })
        .finally(() => setBusy(false));
    }, 180);
    return () => { window.clearTimeout(timer); cancelConversion(); };
  }, [history.objects, settings, sourceWarnings]);

  const totalCommands = useMemo(() => result?.blocks.reduce((sum, block) => sum + block.stitches.length, 0) ?? 0, [result]);
  useEffect(() => {
    if (!playing || !totalCommands) return;
    if (playhead >= totalCommands) { setPlaying(false); return; }
    const timer = window.setInterval(() => setPlayhead((value) => Math.min(totalCommands, value + Math.max(1, Math.ceil(totalCommands / 180)))), 30);
    return () => window.clearInterval(timer);
  }, [playing, playhead, totalCommands]);

  const previewBlocks = useMemo(() => {
    if (!result) return [];
    let remaining = playhead;
    const entries: { block: StitchBlock; limit: number }[] = [];
    result.blocks.forEach((sourceBlock) => {
      const visible = sourceBlock.stitches.slice(0, Math.max(0, Math.min(sourceBlock.stitches.length, remaining)));
      remaining -= visible.length;
      let current: StitchBlock | null = null;
      visible.forEach((stitch) => {
        const objectId = stitch.objectId ?? sourceBlock.objectIds[0] ?? "unknown";
        if (!current || current.objectIds[0] !== objectId) {
          current = { id: `${sourceBlock.id}-${objectId}-${entries.length}`, color: sourceBlock.color, label: sourceBlock.label, objectIds: [objectId], stitches: [] };
          entries.push({ block: current, limit: 0 });
        }
        current.stitches.push(stitch); entries[entries.length - 1].limit += 1;
      });
    });
    return entries;
  }, [result, playhead]);

  const updateSettings = <K extends keyof ConversionSettings>(key: K, value: ConversionSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const selectHoop = (preset: HoopPreset) => preset === "custom" ? updateSettings("hoopPreset", preset) : setSettings((current) => ({ ...current, hoopPreset: preset, hoopWidthMm: HOOPS[preset][0], hoopHeightMm: HOOPS[preset][1] }));

  const prepareSource = async (source: DesignSource) => {
    setBusy(true); setError("");
    try {
      const prepared = await prepareEmbroideryObjects(source);
      history.reset(prepared.objects); setSourceWarnings(prepared.warnings); setSelectedId(prepared.objects[0]?.id ?? null); setSourceLabel(source.name); setFileName(safeName(source.name));
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : ""; setError(translatedError(message, language, c.sourceError));
    } finally { setBusy(false); }
  };

  const loadFile = async (file?: File) => {
    setDragging(false); if (!file) return;
    if (!file.name.toLowerCase().endsWith(".svg") && file.type !== "image/svg+xml") { setError(c.selectSvg); return; }
    if (file.size > MAX_FILE_SIZE) { setError(c.tooLarge); return; }
    const name = file.name.replace(/\.svg$/i, "");
    await prepareSource({ kind: "svg", name, content: await file.text() }); setMode("svg");
  };
  const loadExample = (example: (typeof EXAMPLE_DESIGNS)[number]) => prepareSource({ kind: "svg", name: example.name[language], content: example.svg });
  const useText = () => prepareSource({ kind: "text", name: text.trim() || "FranziStitch", text, font, color: textColor });

  const updateObject = (id: string, update: Partial<EmbroideryObject>) => history.commit((objects) => objects.map((object) => object.id === id ? { ...object, ...update } : object));
  const updateTransform = (key: keyof EmbroideryObject["transform"], value: number) => selected && updateObject(selected.id, { transform: { ...selected.transform, [key]: value } });
  const setObjectStyle = (type: StitchStyleType) => {
    if (!selected) return;
    const style = type === "running" ? { type, stitchLengthMm: settings.stitchLengthMm } as const
      : type === "tatami" ? { type, stitchLengthMm: settings.stitchLengthMm, rowSpacingMm: settings.rowSpacingMm, angleDeg: settings.fillAngleDeg } as const
      : type === "satin" ? { type, densityMm: settings.rowSpacingMm, angleDeg: settings.fillAngleDeg, maxWidthMm: settings.satinMaxWidthMm } as const
      : { type: "auto" } as const;
    updateObject(selected.id, { style });
  };
  const updateStyleParameter = (key: string, value: number) => {
    if (!selected || selected.style.type === "auto") return;
    updateObject(selected.id, { style: { ...selected.style, [key]: value } as StitchStyle });
  };
  const moveObject = (id: string, direction: -1 | 1) => history.commit((objects) => {
    const ordered = [...objects].sort((a, b) => a.sourceIndex - b.sourceIndex); const index = ordered.findIndex((object) => object.id === id); const next = index + direction;
    if (next < 0 || next >= ordered.length) return objects; [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    return ordered.map((object, sourceIndex) => ({ ...object, sourceIndex }));
  });
  const duplicateObject = () => selected && history.commit((objects) => [...objects, { ...selected, id: `${selected.id}-copy-${Date.now()}`, name: `${selected.name} ${c.copySuffix}`, sourceIndex: objects.length, transform: { ...selected.transform, translateX: selected.transform.translateX + 5, translateY: selected.transform.translateY + 5 } }]);

  const selectFabric = (id: FabricProfileId) => {
    const profile = FABRIC_PROFILES[id];
    setSettings((current) => ({ ...current, fabricProfileId: id, rowSpacingMm: profile.rowSpacingMm, minimumStitchMm: profile.minimumStitchMm }));
    history.commit((objects) => objects.map((object) => ({ ...object, underlay: { ...profile.underlay }, pullCompensationMm: null })));
  };

  const selectMachine = (id: MachineProfileId) => {
    const profile = MACHINE_PROFILES[id];
    setSettings((current) => ({ ...current, machineProfileId: id, exportFormat: profile.defaultFormat }));
  };

  const downloadEmbroidery = () => {
    if (!result || result.issues.some((issue) => issue.severity === "error")) return;
    const format = settings.exportFormat;
    const url = URL.createObjectURL(createEmbroideryFile(result, fileName, format)); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${safeName(fileName)}.${format}`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  const saveProject = () => {
    const blob = new Blob([serializeProject(createProject(fileName, history.objects, settings))], { type: "application/json" }); const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${safeName(fileName)}.franzistitch.json`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  const loadProject = async (file?: File) => {
    if (!file) return;
    try { const project = parseProject(await file.text()); history.reset(project.objects); setSettings(project.settings); setFileName(project.name); setSourceLabel(project.name); setSelectedId(project.objects[0]?.id ?? null); setError(""); }
    catch (problem) { const message = problem instanceof Error ? problem.message : ""; setError(translatedError(message, language, c.projectError)); }
  };

  const preview = useMemo(() => ({ viewBox: `${-settings.hoopWidthMm / 2} ${-settings.hoopHeightMm / 2} ${settings.hoopWidthMm} ${settings.hoopHeightMm}`, x: -settings.hoopWidthMm / 2, y: -settings.hoopHeightMm / 2, width: settings.hoopWidthMm, height: settings.hoopHeightMm }), [settings.hoopWidthMm, settings.hoopHeightMm]);
  const fabricNames: Record<FabricProfileId, string> = { woven: c.fabricWoven, stretch: c.fabricStretch, terry: c.fabricTerry };
  const machineNames: Record<MachineProfileId, string> = { "generic-dst": c.machineGeneric, "dst-auto-trim": c.machineTrim, "melco-exp": c.machineMelco, "janome-jef": c.machineJanome };
  const formatNames: Record<EmbroideryFormat, string> = { dst: c.formatDst, exp: c.formatExp, jef: c.formatJef };
  const styleNames: Record<StitchStyleType, string> = { auto: c.automatic, running: c.running, tatami: c.tatami, satin: c.satin };

  return <div className="app-shell">
    <header className="topbar">
      <a className="logo" href="#top"><span className="logo-mark">F</span><span>Franzi<b>Stitch</b></span></a>
      <div className="header-actions">
        <div className="language-toggle" aria-label="Language"><button className={language === "de" ? "active" : ""} onClick={() => setLanguage("de")}>DE</button><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button></div>
        <button onClick={() => projectRef.current?.click()}>{c.openProject}</button><button disabled={!history.objects.length} onClick={saveProject}>{c.saveProject}</button>
        <input ref={projectRef} hidden type="file" accept=".json,.franzistitch.json,.stitchlite.json" onChange={(event) => loadProject(event.target.files?.[0])}/>
      </div>
    </header>
    <main id="top">
      <section className="intro"><div><p className="kicker">{c.kicker}</p><h1>{c.headlineA}<br/><em>{c.headlineB}</em></h1></div><div className="intro-copy"><p>{c.intro}</p><div className="feature-row"><span>✓ {c.featureObject}</span><span>✓ {c.featureFabric}</span><span>✓ {c.featureDst}</span></div></div></section>
      <section className="workflow">
        <aside className="control-card">
          <div className="step-heading"><span>01</span><div><small>{c.motif}</small><h2>{c.sourceProject}</h2></div></div>
          <div className="mode-tabs"><button className={mode === "svg" ? "active" : ""} onClick={() => setMode("svg")}>{c.svgFile}</button><button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}>{c.lettering}</button></div>
          {mode === "svg" ? <>
            <div className={`dropzone ${dragging ? "dragging" : ""}`} role="button" tabIndex={0} onClick={() => fileRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileRef.current?.click(); }} onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); loadFile(event.dataTransfer.files[0]); }}>
              <div className="file-icon">↥</div><strong>{sourceLabel || c.dropTitle}</strong><span>{c.dropMeta}</span><input ref={fileRef} hidden type="file" accept=".svg,image/svg+xml" onChange={(event) => loadFile(event.target.files?.[0])}/>
            </div>
            <div className="example-picker"><div className="example-title"><span>{c.examples}</span></div><div className="example-grid">{EXAMPLE_DESIGNS.map((example) => <button key={example.id} onClick={() => loadExample(example)}><img src={`data:image/svg+xml,${encodeURIComponent(example.svg)}`} alt=""/><span><strong>{example.name[language]}</strong><small>{example.description[language]}</small></span></button>)}</div></div>
          </> : <div className="text-controls">
            <label>{c.yourText} <span>{text.length}/40</span><input maxLength={40} value={text} onChange={(event) => setText(event.target.value)} className={FONT_OPTIONS.find((option) => option.value === font)?.className}/></label>
            <div className="split-fields"><label>{c.font}<select value={font} onChange={(event) => setFont(event.target.value as TextFont)}>{FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} – {option.description[language]}</option>)}</select></label><label>{c.color}<input className="color-input" type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)}/></label></div>
            <div className="umlaut-note">Ä · Ö · Ü · ä · ö · ü · ß ✓</div><button className="secondary-button" onClick={useText}>{c.createText}</button>
          </div>}

          <div className="divider"/><div className="step-heading compact"><span>02</span><div><small>{c.production}</small><h2>{c.setup}</h2></div></div>
          <div className="field-grid">
            <label className="wide">{c.hoop}<select value={settings.hoopPreset} onChange={(event) => selectHoop(event.target.value as HoopPreset)}><option value="100x100">100 × 100 mm</option><option value="130x180">130 × 180 mm</option><option value="200x200">200 × 200 mm</option><option value="custom">{c.customSize}</option></select></label>
            {settings.hoopPreset === "custom" && <><label>{c.width}<input type="number" min={20} max={300} value={settings.hoopWidthMm} onChange={(event) => updateSettings("hoopWidthMm", Number(event.target.value))}/></label><label>{c.height}<input type="number" min={20} max={300} value={settings.hoopHeightMm} onChange={(event) => updateSettings("hoopHeightMm", Number(event.target.value))}/></label></>}
            <label>{c.designWidth}<input type="number" min={5} max={292} value={settings.targetWidthMm} onChange={(event) => updateSettings("targetWidthMm", Number(event.target.value))}/><i>mm</i></label>
            <label>{c.designHeight}<input type="number" min={5} max={292} disabled={settings.lockAspectRatio} value={settings.targetHeightMm} onChange={(event) => updateSettings("targetHeightMm", Number(event.target.value))}/><i>mm</i></label>
            <label className="wide">{c.fabric}<select value={settings.fabricProfileId} onChange={(event) => selectFabric(event.target.value as FabricProfileId)}>{Object.values(FABRIC_PROFILES).map((profile) => <option key={profile.id} value={profile.id}>{fabricNames[profile.id]}</option>)}</select></label>
            <label className="wide">{c.machine}<select value={settings.machineProfileId} onChange={(event) => selectMachine(event.target.value as MachineProfileId)}>{Object.values(MACHINE_PROFILES).map((profile) => <option key={profile.id} value={profile.id}>{machineNames[profile.id]}</option>)}</select></label>
            <label className="wide">{c.format}<select value={settings.exportFormat} onChange={(event) => updateSettings("exportFormat", event.target.value as EmbroideryFormat)}>{(["dst", "exp", "jef"] as EmbroideryFormat[]).map((format) => <option key={format} value={format}>{formatNames[format]}</option>)}</select></label>
            <p className="machine-hint">{c.machineHint}</p>
            <label className="check wide"><input type="checkbox" checked={settings.lockAspectRatio} onChange={(event) => updateSettings("lockAspectRatio", event.target.checked)}/> {c.lockAspect}</label>
          </div>
          <div className="sliders"><label><span>{c.stitchLength} <output>{settings.stitchLengthMm.toFixed(1)} mm</output></span><input type="range" min="1" max="5" step=".1" value={settings.stitchLengthMm} onChange={(event) => updateSettings("stitchLengthMm", Number(event.target.value))}/></label><label><span>{c.density} <output>{settings.rowSpacingMm.toFixed(2)} mm</output></span><input type="range" min=".3" max="1.5" step=".05" value={settings.rowSpacingMm} onChange={(event) => updateSettings("rowSpacingMm", Number(event.target.value))}/></label><label><span>{c.fillAngle} <output>{settings.fillAngleDeg}°</output></span><input type="range" min="0" max="180" step="5" value={settings.fillAngleDeg} onChange={(event) => updateSettings("fillAngleDeg", Number(event.target.value))}/></label></div>

          {history.objects.length > 0 && <><div className="divider"/><div className="object-heading"><div><small>{c.objects}</small><strong>{history.objects.length} {c.areas}</strong></div><div><button disabled={!history.canUndo} onClick={history.undo}>↶</button><button disabled={!history.canRedo} onClick={history.redo}>↷</button></div></div><ol className="object-list">{[...history.objects].sort((a,b) => a.sourceIndex-b.sourceIndex).map((object, index) => <li className={selectedId === object.id ? "selected" : ""} key={object.id} onClick={() => setSelectedId(object.id)}><input aria-label={c.visible} type="checkbox" checked={object.visible} onChange={(event) => { event.stopPropagation(); updateObject(object.id, { visible: event.target.checked }); }}/><span className="swatch" style={{background:object.color}}/><strong>{objectDisplayName(object, language)}</strong><em>{styleNames[object.style.type]}</em><button disabled={index===0} onClick={(event) => {event.stopPropagation();moveObject(object.id,-1);}}>↑</button><button disabled={index===history.objects.length-1} onClick={(event) => {event.stopPropagation();moveObject(object.id,1);}}>↓</button></li>)}</ol></>}

          {selected && <div className="object-editor"><div className="section-label"><span>{c.objectEdit}</span><button onClick={duplicateObject}>{c.duplicate}</button></div><div className="field-grid">
            <label>{c.color}<input className="color-input" type="color" value={selected.color} onChange={(event) => updateObject(selected.id,{color:event.target.value})}/></label>
            <label>{c.stitchType}<select value={selected.style.type} onChange={(event) => setObjectStyle(event.target.value as StitchStyleType)}><option value="auto">{c.automatic}</option><option value="running">{c.running}</option><option value="tatami">{c.tatami}</option><option value="satin">{c.satin}</option></select></label>
            <label>{c.underlay}<select value={selected.underlay.type} onChange={(event) => updateObject(selected.id,{underlay:{...selected.underlay,enabled:event.target.value!=="none",type:event.target.value as UnderlayType}})}><option value="none">{c.none}</option><option value="center">{c.center}</option><option value="edge">{c.edge}</option><option value="tatami">{c.tatami}</option></select></label>
            <label>{c.pullComp}<input type="number" min="0" max="2" step=".1" value={selected.pullCompensationMm ?? FABRIC_PROFILES[settings.fabricProfileId].pullCompensationMm} onChange={(event) => updateObject(selected.id,{pullCompensationMm:Number(event.target.value)})}/><i>mm</i></label>
            <label>X<input type="number" step="1" value={selected.transform.translateX} onChange={(event) => updateTransform("translateX",Number(event.target.value))}/><i>mm</i></label><label>Y<input type="number" step="1" value={selected.transform.translateY} onChange={(event) => updateTransform("translateY",Number(event.target.value))}/><i>mm</i></label>
            <label>{c.rotation}<input type="number" step="5" value={selected.transform.rotationDeg} onChange={(event) => updateTransform("rotationDeg",Number(event.target.value))}/><i>°</i></label><label>{c.scale}<input type="number" min=".1" max="5" step=".1" value={Math.abs(selected.transform.scaleX)} onChange={(event) => updateTransform("scaleX",Math.sign(selected.transform.scaleX||1)*Number(event.target.value))}/></label>
            {selected.style.type === "running" && <label className="wide">{c.objectStitchLength}<input type="number" min="1" max="5" step=".1" value={selected.style.stitchLengthMm} onChange={(event) => updateStyleParameter("stitchLengthMm",Number(event.target.value))}/><i>mm</i></label>}
            {selected.style.type === "tatami" && <><label>{c.objectDensity}<input type="number" min=".3" max="1.5" step=".05" value={selected.style.rowSpacingMm} onChange={(event) => updateStyleParameter("rowSpacingMm",Number(event.target.value))}/><i>mm</i></label><label>{c.objectAngle}<input type="number" min="0" max="180" step="5" value={selected.style.angleDeg} onChange={(event) => updateStyleParameter("angleDeg",Number(event.target.value))}/><i>°</i></label></>}
            {selected.style.type === "satin" && <><label>{c.satinDensity}<input type="number" min=".25" max="1" step=".05" value={selected.style.densityMm} onChange={(event) => updateStyleParameter("densityMm",Number(event.target.value))}/><i>mm</i></label><label>{c.satinAngle}<input type="number" min="0" max="180" step="5" value={selected.style.angleDeg} onChange={(event) => updateStyleParameter("angleDeg",Number(event.target.value))}/><i>°</i></label></>}
            <label>{c.startX}<input type="number" step="1" value={selected.entryPoint?.x??0} onChange={(event) => updateObject(selected.id,{entryPoint:{x:Number(event.target.value),y:selected.entryPoint?.y??0}})}/><i>mm</i></label><label>{c.startY}<input type="number" step="1" value={selected.entryPoint?.y??0} onChange={(event) => updateObject(selected.id,{entryPoint:{x:selected.entryPoint?.x??0,y:Number(event.target.value)}})}/><i>mm</i></label>
            <label>{c.endX}<input type="number" step="1" value={selected.exitPoint?.x??0} onChange={(event) => updateObject(selected.id,{exitPoint:{x:Number(event.target.value),y:selected.exitPoint?.y??0}})}/><i>mm</i></label><label>{c.endY}<input type="number" step="1" value={selected.exitPoint?.y??0} onChange={(event) => updateObject(selected.id,{exitPoint:{x:selected.exitPoint?.x??0,y:Number(event.target.value)}})}/><i>mm</i></label>
          </div><div className="editor-actions"><button onClick={() => updateTransform("scaleX",selected.transform.scaleX*-1)}>{c.mirrorH}</button><button onClick={() => updateTransform("scaleY",selected.transform.scaleY*-1)}>{c.mirrorV}</button></div></div>}
          {error && <div className="message error-message">! <span>{error}</span></div>}
        </aside>

        <section className="preview-card"><div className="preview-title"><div><span className="step-number">03</span><div><small>{c.previewExport}</small><h2>{sourceLabel || c.noDesign}</h2></div></div><span className={`ready-badge ${result ? "ready" : ""}`}>{busy ? `${Math.round(progress*100)} %` : result ? c.checked : c.waiting}</span></div>
          <div className="hoop-stage"><svg viewBox={preview.viewBox}><defs><pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#c8bda9" strokeWidth=".18"/></pattern></defs><rect {...preview} rx="3" fill="#f2eadb" stroke="#b1a38e" strokeWidth="1.2"/><rect x={preview.x+settings.marginMm} y={preview.y+settings.marginMm} width={preview.width-settings.marginMm*2} height={preview.height-settings.marginMm*2} rx="2" fill="url(#smallGrid)" stroke="#c4b6a2" strokeDasharray="2 2" strokeWidth=".35"/>{previewBlocks.map(({block,limit}) => <g key={block.id} role="button" onClick={() => setSelectedId(block.objectIds[0]??null)} className={block.objectIds.includes(selectedId??"")?"selected-stitches":""}><path d={jumpPath(block,limit)} fill="none" stroke="#53625b" strokeWidth=".28" strokeDasharray="1.4 1.4"/><path d={stitchPath(block,limit)} fill="none" stroke={block.color} strokeWidth=".48" strokeLinecap="round"/></g>)}</svg>{!result&&!busy&&<div className="empty-preview"><div className="thread-mark">✣</div><strong>{c.previewTitle}</strong><span>{c.previewHint}</span></div>}{busy&&<div className="empty-preview"><div className="spinner"/><strong>{c.calculating}</strong></div>}<div className="hoop-label">{settings.hoopWidthMm} × {settings.hoopHeightMm} mm</div></div>
          <div className="stitch-legend"><span><i className="sewn-line"/>{c.legendStitch}</span><span title={c.legendHint}><i className="jump-line"/>{c.legendJump}<b>?</b></span></div>
          <div className="player"><button disabled={!result} onClick={() => { if(playhead>=totalCommands)setPlayhead(0);setPlaying(!playing); }}>{playing?c.pause:c.play}</button><input type="range" min="0" max={Math.max(1,totalCommands)} value={playhead} onChange={(event)=>{setPlaying(false);setPlayhead(Number(event.target.value));}}/><span>{totalCommands?Math.round(playhead/totalCommands*100):0}%</span></div>
          <div className="stat-row"><div><small>{c.stitches}</small><strong>{result?.stitchCount.toLocaleString(language === "de" ? "de-DE" : "en-US")??"–"}</strong></div><div><small>{c.jumps}</small><strong>{result?.jumpCount??"–"}</strong></div><div><small>{c.trims}</small><strong>{result?.trimCount??"–"}</strong></div><div><small>{c.size}</small><strong>{result?`${result.bounds.width.toFixed(1)} × ${result.bounds.height.toFixed(1)} mm`:"–"}</strong></div></div>
          <div className="quality-panel"><div className="section-label"><span>{c.quality}</span><small>{result?.issues.length??0} {c.notices}</small></div>{result?.issues.length?<ul>{result.issues.map((issue)=><li className={issue.severity} key={issue.id} onClick={()=>issue.objectId&&setSelectedId(issue.objectId)}><b>{issue.severity==="error"?"!":issue.severity==="warning"?"△":"i"}</b><span>{translatedIssue(issue, language, history.objects)}</span></li>)}</ul>:<p className="muted">{c.noIssues}</p>}</div>
          <div className="export-area"><label>{c.filename}<div><input value={fileName} maxLength={40} onChange={(event)=>setFileName(safeName(event.target.value))}/><span>.{settings.exportFormat}</span></div></label><button className="download-button" disabled={!result||busy||result.issues.some((issue)=>issue.severity==="error")} onClick={downloadEmbroidery}>{c.download} <span>↓</span></button></div>
        </section>
      </section>
    </main>
    <footer><div><span className="logo-mark small">F</span><strong>FranziStitch</strong></div><p>{c.footer}</p><span>{c.privacy}</span></footer>
  </div>;
}
