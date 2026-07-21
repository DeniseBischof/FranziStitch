import type { FabricProfile, FabricProfileId, MachineProfile, MachineProfileId } from "../types";

export const FABRIC_PROFILES: Record<FabricProfileId, FabricProfile> = {
  woven: {
    id: "woven", name: "Webware", rowSpacingMm: 0.45, pullCompensationMm: 0.2, minimumStitchMm: 0.5,
    underlay: { enabled: true, type: "edge", insetMm: 1, stitchLengthMm: 2.8, rowSpacingMm: 2.2 },
  },
  stretch: {
    id: "stretch", name: "Dehnbarer Stoff", rowSpacingMm: 0.4, pullCompensationMm: 0.4, minimumStitchMm: 0.55,
    underlay: { enabled: true, type: "tatami", insetMm: 1.2, stitchLengthMm: 3, rowSpacingMm: 2 },
  },
  terry: {
    id: "terry", name: "Frottee", rowSpacingMm: 0.38, pullCompensationMm: 0.5, minimumStitchMm: 0.6,
    underlay: { enabled: true, type: "tatami", insetMm: 1.4, stitchLengthMm: 3.2, rowSpacingMm: 1.8 },
  },
};

export const MACHINE_PROFILES: Record<MachineProfileId, MachineProfile> = {
  "generic-dst": { id: "generic-dst", name: "Generisches DST", trimMode: "none", trimThresholdMm: 4, maximumJumpMm: 12.1 },
  "dst-auto-trim": { id: "dst-auto-trim", name: "DST mit 3-Sprung-Schnitt", trimMode: "three-jump", trimThresholdMm: 4, maximumJumpMm: 12.1 },
};

export const fabricProfile = (id: FabricProfileId) => FABRIC_PROFILES[id];
export const machineProfile = (id: MachineProfileId) => MACHINE_PROFILES[id];
