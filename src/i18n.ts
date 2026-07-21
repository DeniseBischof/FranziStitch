import type { EmbroideryObject, ValidationIssue } from "./types";

export type Language = "de" | "en";

export const COPY = {
  de: {
    openProject: "Projekt öffnen", saveProject: "Projekt speichern", local: "100 % lokal",
    kicker: "AUTO-DIGITALISIERER · VERSION 2", headlineA: "Vom Motiv zur", headlineB: "sauberen Stickdatei.",
    intro: "Unterlage, Zugausgleich, Satin, Stoffprofile und Qualitätsprüfung – weiterhin vollständig lokal.",
    featureObject: "Objektbasiert", featureFabric: "Stoffprofile", featureDst: "DST-Export",
    motif: "MOTIV", sourceProject: "Quelle & Projekt", svgFile: "SVG-Datei", lettering: "Schriftzug",
    dropTitle: "SVG hier ablegen", dropMeta: "Maximal 5 MB · Verarbeitung lokal", examples: "ODER BEISPIEL AUSWÄHLEN",
    yourText: "Dein Text", font: "Schrift", color: "Farbe", createText: "Vektorschrift erzeugen",
    production: "PRODUKTION", setup: "Rahmen, Stoff & Maschine", hoop: "Rahmen", customSize: "Eigene Größe",
    width: "Breite", height: "Höhe", designWidth: "Motivbreite", designHeight: "Motivhöhe", fabric: "Stoff", machine: "Maschine",
    lockAspect: "Seitenverhältnis beibehalten", stitchLength: "Stichlänge", density: "Dichte", fillAngle: "Füllwinkel",
    objects: "OBJEKTE", areas: "Stickbereiche", visible: "Objekt sichtbar", objectEdit: "OBJEKT EINSTELLEN", duplicate: "Duplizieren",
    stitchType: "Stichart", underlay: "Unterlage", pullComp: "Zugausgleich", rotation: "Drehung", scale: "Skalierung",
    automatic: "Automatisch", running: "Laufstich", tatami: "Tatami", satin: "Satin", none: "Keine", center: "Mittellauf", edge: "Kantenlauf",
    objectStitchLength: "Objekt-Stichlänge", objectDensity: "Objekt-Dichte", objectAngle: "Objekt-Winkel", satinDensity: "Satin-Dichte", satinAngle: "Satin-Winkel",
    startX: "Start X", startY: "Start Y", endX: "Ende X", endY: "Ende Y", mirrorH: "Horizontal spiegeln", mirrorV: "Vertikal spiegeln",
    previewExport: "STICHSIMULATION & EXPORT", noDesign: "Noch kein Motiv", checked: "Geprüft", waiting: "Wartet",
    previewTitle: "Dein Stichbild erscheint hier", previewHint: "SVG laden, Beispiel wählen oder Vektorschrift erzeugen.", calculating: "Qualitätsplan wird berechnet",
    play: "Abspielen", pause: "Pause", stitches: "STICHE", jumps: "SPRÜNGE", trims: "SCHNITTE", size: "GRÖSSE",
    legendStitch: "Farbige Linien: echte Stiche", legendJump: "Grau gestrichelt: Sprungstiche", legendHint: "Nadel oben – diese Wege werden nicht gestickt.",
    quality: "QUALITÄTSPRÜFUNG", notices: "Hinweise", noIssues: "Keine Qualitätsprobleme erkannt.", filename: "Dateiname", download: "DST herunterladen",
    footer: "Automatische Digitalisierung bleibt eine Ausgangsbasis. Vor Produktion immer probesticken.", privacy: "Keine Uploads · Keine Cloud",
    copySuffix: "Kopie", area: "Fläche", outline: "Kontur", character: "Zeichen",
    selectSvg: "Bitte wähle eine SVG-Datei aus.", tooLarge: "Die SVG-Datei ist größer als 5 MB.", sourceError: "Die Quelldatei konnte nicht gelesen werden.", projectError: "Das Projekt konnte nicht geöffnet werden.", conversionError: "Das Motiv konnte nicht verarbeitet werden.",
    fabricWoven: "Webware", fabricStretch: "Dehnbarer Stoff", fabricTerry: "Frottee", machineGeneric: "Generisches DST", machineTrim: "DST mit 3-Sprung-Schnitt",
  },
  en: {
    openProject: "Open project", saveProject: "Save project", local: "100% local",
    kicker: "AUTO-DIGITIZER · VERSION 2", headlineA: "From artwork to a", headlineB: "clean stitch file.",
    intro: "Underlay, pull compensation, satin, fabric profiles and quality checks – still completely local.",
    featureObject: "Object-based", featureFabric: "Fabric profiles", featureDst: "DST export",
    motif: "DESIGN", sourceProject: "Source & project", svgFile: "SVG file", lettering: "Lettering",
    dropTitle: "Drop SVG here", dropMeta: "Up to 5 MB · processed locally", examples: "OR PICK AN EXAMPLE",
    yourText: "Your text", font: "Font", color: "Color", createText: "Create vector lettering",
    production: "PRODUCTION", setup: "Hoop, fabric & machine", hoop: "Hoop", customSize: "Custom size",
    width: "Width", height: "Height", designWidth: "Design width", designHeight: "Design height", fabric: "Fabric", machine: "Machine",
    lockAspect: "Keep aspect ratio", stitchLength: "Stitch length", density: "Density", fillAngle: "Fill angle",
    objects: "OBJECTS", areas: "stitch areas", visible: "Object visible", objectEdit: "EDIT OBJECT", duplicate: "Duplicate",
    stitchType: "Stitch type", underlay: "Underlay", pullComp: "Pull compensation", rotation: "Rotation", scale: "Scale",
    automatic: "Automatic", running: "Running", tatami: "Tatami", satin: "Satin", none: "None", center: "Center walk", edge: "Edge walk",
    objectStitchLength: "Object stitch length", objectDensity: "Object density", objectAngle: "Object angle", satinDensity: "Satin density", satinAngle: "Satin angle",
    startX: "Start X", startY: "Start Y", endX: "End X", endY: "End Y", mirrorH: "Mirror horizontally", mirrorV: "Mirror vertically",
    previewExport: "STITCH SIMULATION & EXPORT", noDesign: "No design yet", checked: "Checked", waiting: "Waiting",
    previewTitle: "Your stitch preview appears here", previewHint: "Load an SVG, pick an example or create vector lettering.", calculating: "Building quality stitch plan",
    play: "Play", pause: "Pause", stitches: "STITCHES", jumps: "JUMPS", trims: "TRIMS", size: "SIZE",
    legendStitch: "Colored lines: sewn stitches", legendJump: "Gray dashed: jump stitches", legendHint: "Needle up – these paths are not sewn.",
    quality: "QUALITY CHECK", notices: "notices", noIssues: "No quality issues detected.", filename: "File name", download: "Download DST",
    footer: "Automatic digitizing is a starting point. Always run a test sew before production.", privacy: "No uploads · No cloud",
    copySuffix: "copy", area: "Area", outline: "Outline", character: "Character",
    selectSvg: "Please select an SVG file.", tooLarge: "The SVG file is larger than 5 MB.", sourceError: "The source file could not be read.", projectError: "The project could not be opened.", conversionError: "The design could not be processed.",
    fabricWoven: "Woven fabric", fabricStretch: "Stretch fabric", fabricTerry: "Terry cloth", machineGeneric: "Generic DST", machineTrim: "DST with 3-jump trim",
  },
} as const;

export function objectDisplayName(object: EmbroideryObject, language: Language) {
  if (language === "de") return object.name;
  const number = object.sourceIndex + 1;
  if (object.id.startsWith("text-")) return `${COPY.en.character} ${number}`;
  return `${object.geometryKind === "fill" ? COPY.en.area : COPY.en.outline} ${number}`;
}

export function translatedIssue(issue: ValidationIssue, language: Language, objects: EmbroideryObject[]) {
  if (language === "de") return issue.message;
  const object = issue.objectId ? objects.find((entry) => entry.id === issue.objectId) : undefined;
  const name = object ? objectDisplayName(object, "en") : "This object";
  if (issue.id.startsWith("wide-satin")) return `${name} is too wide or branched for satin and was generated as tatami.`;
  if (issue.id.startsWith("long-jump")) return "A long jump stitch was detected; consider enabling the compatible trim profile.";
  if (issue.id === "fit-hoop") return "The design was automatically fitted to the safe hoop area.";
  if (issue.code === "hoop-overflow") return "The design exceeds the safe stitching area of the hoop.";
  if (issue.id.startsWith("letter-error")) return `${name} is under 5 mm high and too small for safe automatic export.`;
  if (issue.id.startsWith("letter-warning")) return `${name} is smaller than 8 mm and should be test-sewn.`;
  if (issue.code === "tiny-object") return `${name} contains details smaller than 1 mm.`;
  if (issue.code === "dense-design") return "This design has a very high stitch count and may be slow on weaker devices.";
  if (issue.code === "unsupported") return "An unsupported SVG element or effect was ignored.";
  return issue.message;
}

export function translatedError(message: string, language: Language, fallback: string) {
  if (language === "de") return message || fallback;
  if (message.includes("Bitte gib zuerst")) return "Please enter some lettering first.";
  if (message.includes("enthält folgende Zeichen nicht")) return `The selected font does not contain: ${message.split(":").slice(1).join(":").trim()}`;
  if (message.includes("eingebettete Schrift")) return "The embedded font could not be loaded.";
  if (message.includes("keine darstellbaren Zeichen")) return "The text contains no printable characters.";
  if (message.includes("keine sichtbaren Stickobjekte")) return "There are no visible embroidery objects.";
  if (message.includes("Rahmen")) return "The design does not fit inside the selected hoop.";
  return fallback;
}
