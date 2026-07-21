// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createProject, parseProject, serializeProject } from "./project";
import type { ConversionSettings } from "../types";

const settings: ConversionSettings = { hoopPreset: "100x100", hoopWidthMm: 100, hoopHeightMm: 100, targetWidthMm: 50, targetHeightMm: 50, lockAspectRatio: true, stitchLengthMm: 2.5, rowSpacingMm: 0.45, fillAngleDeg: 45, marginMm: 4, minimumStitchMm: 0.5, satinMaxWidthMm: 12, fabricProfileId: "woven", machineProfileId: "generic-dst" };

describe("project documents", () => {
  it("round-trips a versioned local project", () => {
    const project = createProject("test", [], settings);
    expect(parseProject(serializeProject(project))).toMatchObject({ format: "franzistitch-project", version: 1, name: "test", settings });
  });

  it("migrates legacy StitchLite projects when opening them", () => {
    const legacy = JSON.stringify({ ...createProject("alt", [], settings), format: "stitchlite-project" });
    expect(parseProject(legacy)).toMatchObject({ format: "franzistitch-project", name: "alt" });
  });

  it("rejects unrelated JSON", () => {
    expect(() => parseProject('{"hello":"world"}')).toThrow(/kein gültiges/);
  });
});
