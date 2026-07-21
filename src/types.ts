export type Point = { x: number; y: number };

export type StitchCommand = "stitch" | "jump" | "trim" | "stop" | "color-change" | "end";

export type StitchPoint = Point & { command: StitchCommand; objectId?: string };

export type StitchBlock = {
  id: string;
  color: string;
  label: string;
  objectIds: string[];
  stitches: StitchPoint[];
};

export type HoopPreset = "100x100" | "130x180" | "200x200" | "custom";
export type FabricProfileId = "woven" | "stretch" | "terry";
export type MachineProfileId = "generic-dst" | "dst-auto-trim";
export type StitchStyleType = "auto" | "running" | "tatami" | "satin";
export type UnderlayType = "none" | "center" | "edge" | "tatami";

export type UnderlaySettings = {
  enabled: boolean;
  type: UnderlayType;
  insetMm: number;
  stitchLengthMm: number;
  rowSpacingMm: number;
};

export type RunningStyle = { type: "running"; stitchLengthMm: number };
export type TatamiStyle = { type: "tatami"; stitchLengthMm: number; rowSpacingMm: number; angleDeg: number };
export type SatinStyle = { type: "satin"; densityMm: number; angleDeg: number; maxWidthMm: number };
export type AutoStyle = { type: "auto" };
export type StitchStyle = RunningStyle | TatamiStyle | SatinStyle | AutoStyle;

export type ObjectTransform = {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
};

export type EmbroideryObject = {
  id: string;
  name: string;
  sourceIndex: number;
  color: string;
  visible: boolean;
  geometryKind: "fill" | "stroke";
  paths: Polyline[];
  style: StitchStyle;
  underlay: UnderlaySettings;
  pullCompensationMm: number | null;
  entryPoint: Point | null;
  exitPoint: Point | null;
  transform: ObjectTransform;
};

export type FabricProfile = {
  id: FabricProfileId;
  name: string;
  rowSpacingMm: number;
  pullCompensationMm: number;
  underlay: UnderlaySettings;
  minimumStitchMm: number;
};

export type MachineProfile = {
  id: MachineProfileId;
  name: string;
  trimMode: "none" | "three-jump";
  trimThresholdMm: number;
  maximumJumpMm: number;
};

export type ConversionSettings = {
  hoopPreset: HoopPreset;
  hoopWidthMm: number;
  hoopHeightMm: number;
  targetWidthMm: number;
  targetHeightMm: number;
  lockAspectRatio: boolean;
  stitchLengthMm: number;
  rowSpacingMm: number;
  fillAngleDeg: number;
  marginMm: number;
  minimumStitchMm: number;
  satinMaxWidthMm: number;
  fabricProfileId: FabricProfileId;
  machineProfileId: MachineProfileId;
};

export type SvgDesignSource = { kind: "svg"; name: string; content: string };
export type TextFont = "noto-sans" | "noto-serif" | "pacifico" | "montserrat" | "playfair" | "lobster" | "bungee";
export type TextDesignSource = { kind: "text"; name: string; text: string; font: TextFont; color: string };
export type DesignSource = SvgDesignSource | TextDesignSource;

export type DesignBounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };

export type ValidationIssue = {
  id: string;
  severity: "info" | "warning" | "error";
  code: "hoop-overflow" | "tiny-object" | "dense-design" | "long-jump" | "wide-satin" | "unsupported";
  message: string;
  objectId?: string;
};

export type ConversionResult = {
  blocks: StitchBlock[];
  bounds: DesignBounds;
  stitchCount: number;
  jumpCount: number;
  trimCount: number;
  colorChangeCount: number;
  warnings: string[];
  issues: ValidationIssue[];
};

export type StitchPlan = ConversionResult & {
  version: 1;
  generatedAt: string;
  objectCount: number;
};

export type Polyline = { points: Point[]; closed: boolean };
export type VectorShape = { id: string; kind: "fill" | "stroke"; color: string; paths: Polyline[] };
export type ParsedVectorDesign = { shapes: VectorShape[]; bounds: DesignBounds; warnings: string[] };

export type ProjectDocument = {
  format: "franzistitch-project";
  version: 1;
  name: string;
  settings: ConversionSettings;
  objects: EmbroideryObject[];
  createdAt: string;
  updatedAt: string;
};

export type WorkerRequest = {
  id: string;
  objects: EmbroideryObject[];
  settings: ConversionSettings;
};

export type WorkerResponse =
  | { id: string; type: "progress"; progress: number }
  | { id: string; type: "result"; result: ConversionResult }
  | { id: string; type: "error"; message: string };
