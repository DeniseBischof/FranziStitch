import {
  addTieStitches,
  applyObjectTransform,
  boundsOf,
  boundsOfPolylines,
  distance,
  filterShortStitches,
  offsetPaths,
  runningStitches,
  satinStitches,
  tatamiStitches,
  transformPaths,
  underlayStitches,
} from "./geometry";
import { fabricProfile, machineProfile } from "./profiles";
import { parseSvg } from "./svg";
import { textToVectorDesign } from "./text";
import type {
  ConversionResult,
  ConversionSettings,
  DesignSource,
  EmbroideryObject,
  ParsedVectorDesign,
  Polyline,
  StitchBlock,
  StitchPoint,
  StitchStyle,
  ValidationIssue,
} from "../types";

export const MAX_STITCHES = 250_000;

const DEFAULT_TRANSFORM = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotationDeg: 0 };

export async function parseDesignSource(source: DesignSource): Promise<ParsedVectorDesign> {
  return source.kind === "svg" ? parseSvg(source.content) : textToVectorDesign(source);
}

export async function prepareEmbroideryObjects(source: DesignSource): Promise<{ objects: EmbroideryObject[]; warnings: string[] }> {
  const parsed = await parseDesignSource(source);
  const profile = fabricProfile("woven");
  return {
    warnings: parsed.warnings,
    objects: parsed.shapes.map((shape, index) => ({
      id: `${source.kind}-${shape.id}-${index}`,
      name: source.kind === "text" ? `Zeichen ${index + 1}` : `${shape.kind === "fill" ? "Fläche" : "Kontur"} ${index + 1}`,
      sourceIndex: index,
      color: shape.color,
      visible: true,
      geometryKind: shape.kind,
      paths: shape.paths,
      style: { type: "auto" },
      underlay: { ...profile.underlay },
      pullCompensationMm: null,
      entryPoint: null,
      exitPoint: null,
      transform: { ...DEFAULT_TRANSFORM },
    })),
  };
}

function fitTarget(sourceWidth: number, sourceHeight: number, settings: ConversionSettings) {
  let width = settings.targetWidthMm;
  let height = settings.lockAspectRatio ? width * (sourceHeight / Math.max(sourceWidth, 1e-7)) : settings.targetHeightMm;
  const availableWidth = settings.hoopWidthMm - settings.marginMm * 2;
  const availableHeight = settings.hoopHeightMm - settings.marginMm * 2;
  const fit = Math.min(1, availableWidth / Math.max(width, 0.001), availableHeight / Math.max(height, 0.001));
  return { width: width * fit, height: height * fit, wasReduced: fit < 0.999 };
}

function effectiveStyle(object: EmbroideryObject, settings: ConversionSettings): StitchStyle {
  if (object.style.type !== "auto") return object.style;
  if (object.geometryKind === "stroke") return { type: "running", stitchLengthMm: settings.stitchLengthMm };
  return { type: "satin", densityMm: Math.max(0.3, settings.rowSpacingMm), angleDeg: settings.fillAngleDeg, maxWidthMm: settings.satinMaxWidthMm };
}

function nearestPathOrder(paths: Polyline[], preferred?: StitchPoint, preferredExit?: StitchPoint): Polyline[] {
  if (paths.length < 2) return paths;
  const remaining = paths.map((path) => ({ ...path, points: [...path.points] }));
  const ordered: Polyline[] = [];
  let current = preferred ?? { ...remaining[0].points[0], command: "jump" as const };
  while (remaining.length) {
    let bestIndex = 0; let reverse = false; let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((path, index) => {
      const startDistance = distance(current, path.points[0]);
      const endDistance = distance(current, path.points[path.points.length - 1]);
      if (startDistance < bestDistance) { bestDistance = startDistance; bestIndex = index; reverse = false; }
      if (!path.closed && endDistance < bestDistance) { bestDistance = endDistance; bestIndex = index; reverse = true; }
    });
    const [next] = remaining.splice(bestIndex, 1);
    if (reverse) next.points.reverse();
    ordered.push(next);
    current = { ...next.points[next.points.length - 1], command: "stitch" };
  }
  const last = ordered.at(-1);
  if (last && !last.closed && preferredExit && distance(last.points[last.points.length - 1], preferredExit) > distance(last.points[0], preferredExit)) last.points.reverse();
  return ordered;
}

function markObject(stitches: StitchPoint[], objectId: string) {
  return stitches.map((stitch) => ({ ...stitch, objectId }));
}

function generateObjectStitches(
  object: EmbroideryObject,
  paths: Polyline[],
  settings: ConversionSettings,
  issues: ValidationIssue[],
): StitchPoint[] {
  const fabric = fabricProfile(settings.fabricProfileId);
  const pull = object.pullCompensationMm ?? fabric.pullCompensationMm;
  const compensated = object.geometryKind === "fill" && pull > 0 ? offsetPaths(paths, pull) : paths;
  const style = effectiveStyle(object, settings);
  const angle = style.type === "tatami" || style.type === "satin" ? style.angleDeg : settings.fillAngleDeg;
  const underlay = object.geometryKind === "fill" ? underlayStitches(compensated, object.underlay, angle) : [];
  let top: StitchPoint[] = [];

  if (style.type === "running") {
    const preferred = object.entryPoint ? { ...object.entryPoint, command: "jump" as const } : undefined;
    const exit = object.exitPoint ? { ...object.exitPoint, command: "stitch" as const } : undefined;
    top = runningStitches(nearestPathOrder(compensated, preferred, exit), style.stitchLengthMm);
  } else if (style.type === "tatami") {
    top = tatamiStitches(compensated, style.stitchLengthMm, style.rowSpacingMm, style.angleDeg);
  } else if (style.type === "satin") {
    const satin = satinStitches(compensated, style.densityMm, style.angleDeg);
    if (satin.branched || satin.maximumWidth > style.maxWidthMm) {
      issues.push({ id: `wide-satin-${object.id}`, severity: "warning", code: "wide-satin", objectId: object.id, message: `${object.name} ist für Satin zu breit oder verzweigt und wurde als Tatami erzeugt.` });
      top = tatamiStitches(compensated, settings.stitchLengthMm, settings.rowSpacingMm, settings.fillAngleDeg);
    } else top = satin.stitches;
  } else {
    top = tatamiStitches(compensated, settings.stitchLengthMm, settings.rowSpacingMm, settings.fillAngleDeg);
  }

  const withTies = addTieStitches([...markObject(underlay, object.id), ...markObject(top, object.id)]);
  return filterShortStitches(withTies, Math.max(settings.minimumStitchMm, fabric.minimumStitchMm));
}

function addTrimCandidate(block: StitchBlock, next: StitchPoint, threshold: number, enableTrim: boolean, issues: ValidationIssue[]) {
  const last = block.stitches.at(-1);
  if (!last || next.command !== "jump") return;
  const length = distance(last, next);
  if (length <= threshold) return;
  issues.push({ id: `long-jump-${block.id}-${block.stitches.length}`, severity: "info", code: "long-jump", message: `Sprung von ${length.toFixed(1)} mm erkannt.` });
  if (enableTrim) block.stitches.push({ ...last, command: "trim", objectId: next.objectId });
}

function validationIssues(blocks: StitchBlock[], settings: ConversionSettings) {
  const issues: ValidationIssue[] = [];
  const points = blocks.flatMap((block) => block.stitches).filter((point) => point.command === "stitch" || point.command === "jump");
  const bounds = boundsOf(points);
  const safeWidth = settings.hoopWidthMm - settings.marginMm * 2; const safeHeight = settings.hoopHeightMm - settings.marginMm * 2;
  if (bounds.minX < -safeWidth / 2 - 0.01 || bounds.maxX > safeWidth / 2 + 0.01 || bounds.minY < -safeHeight / 2 - 0.01 || bounds.maxY > safeHeight / 2 + 0.01) issues.push({ id: "hoop-overflow", severity: "error", code: "hoop-overflow", message: "Das Motiv überschreitet den sicheren Stickbereich des Rahmens." });
  if (points.length > 150_000) issues.push({ id: "dense-design", severity: "warning", code: "dense-design", message: "Das Motiv ist sehr stichintensiv und kann auf schwächeren Geräten langsam sein." });
  return issues;
}

export function convertObjects(
  objects: EmbroideryObject[],
  settings: ConversionSettings,
  sourceWarnings: string[] = [],
  progress?: (value: number) => void,
): ConversionResult {
  const visible = objects.filter((object) => object.visible);
  if (!visible.length) throw new Error("Es sind keine sichtbaren Stickobjekte vorhanden.");
  const sourceBounds = boundsOfPolylines(visible.flatMap((object) => object.paths));
  const size = fitTarget(sourceBounds.width, sourceBounds.height, settings);
  const issues: ValidationIssue[] = sourceWarnings.map((message, index) => ({ id: `source-${index}`, severity: "warning", code: "unsupported", message }));
  const blocks: StitchBlock[] = [];
  const machine = machineProfile(settings.machineProfileId);

  visible.sort((a, b) => a.sourceIndex - b.sourceIndex).forEach((object, index) => {
    const scaled = transformPaths(object.paths, sourceBounds, size.width, size.height);
    const transformed = applyObjectTransform(scaled, object.transform);
    const objectBounds = boundsOfPolylines(transformed);
    if (Math.min(objectBounds.width, objectBounds.height) < 1) issues.push({ id: `tiny-${object.id}`, severity: "warning", code: "tiny-object", objectId: object.id, message: `${object.name} enthält Details unter 1 mm.` });
    if (object.name.startsWith("Zeichen") && objectBounds.height < 5) issues.push({ id: `letter-error-${object.id}`, severity: "error", code: "tiny-object", objectId: object.id, message: `${object.name} ist unter 5 mm hoch und für einen sicheren Automatik-Export zu klein.` });
    else if (object.name.startsWith("Zeichen") && objectBounds.height < 8) issues.push({ id: `letter-warning-${object.id}`, severity: "warning", code: "tiny-object", objectId: object.id, message: `${object.name} ist kleiner als 8 mm und sollte unbedingt probegestickt werden.` });
    const stitches = generateObjectStitches(object, transformed, settings, issues);
    if (!stitches.length) return;
    let block = blocks.at(-1);
    if (!block || block.color.toLowerCase() !== object.color.toLowerCase()) {
      block = { id: `block-${blocks.length}-${object.id}`, color: object.color, label: `Farbe ${blocks.length + 1}`, objectIds: [], stitches: [] };
      blocks.push(block);
    }
    addTrimCandidate(block, stitches[0], machine.trimThresholdMm, machine.trimMode !== "none", issues);
    block.objectIds.push(object.id);
    for (const stitch of stitches) block.stitches.push(stitch);
    progress?.((index + 1) / visible.length);
  });

  const baseIssues = validationIssues(blocks, settings);
  issues.push(...baseIssues);
  if (size.wasReduced) issues.push({ id: "fit-hoop", severity: "info", code: "hoop-overflow", message: "Das Motiv wurde automatisch an den sicheren Stickbereich angepasst." });
  const points = blocks.flatMap((block) => block.stitches);
  if (!points.length) throw new Error("Mit diesen Einstellungen konnten keine Stiche erzeugt werden.");
  if (points.length > MAX_STITCHES) throw new Error(`Das Motiv würde mehr als ${MAX_STITCHES.toLocaleString("de-DE")} Befehle erzeugen.`);
  return {
    blocks,
    bounds: boundsOf(points),
    stitchCount: points.filter((point) => point.command === "stitch").length,
    jumpCount: points.filter((point) => point.command === "jump").length,
    trimCount: points.filter((point) => point.command === "trim").length,
    colorChangeCount: Math.max(0, blocks.length - 1),
    warnings: issues.filter((issue) => issue.severity !== "info").map((issue) => issue.message),
    issues,
  };
}

export async function convertDesign(source: DesignSource, settings: ConversionSettings): Promise<ConversionResult> {
  const prepared = await prepareEmbroideryObjects(source);
  return convertObjects(prepared.objects, settings, prepared.warnings);
}
