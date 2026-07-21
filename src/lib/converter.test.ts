// @vitest-environment node
import { describe, expect, it } from "vitest";
import { convertObjects } from "./converter";
import type { ConversionSettings, EmbroideryObject } from "../types";

const settings: ConversionSettings = {
  hoopPreset: "100x100", hoopWidthMm: 100, hoopHeightMm: 100, targetWidthMm: 80, targetHeightMm: 80,
  lockAspectRatio: true, stitchLengthMm: 2.5, rowSpacingMm: 0.45, fillAngleDeg: 45, marginMm: 4,
  minimumStitchMm: 0.5, satinMaxWidthMm: 12, fabricProfileId: "woven", machineProfileId: "generic-dst",
};

function object(id: string, sourceIndex: number, color: string, x: number, width = 10): EmbroideryObject {
  return {
    id, name: id, sourceIndex, color, visible: true, geometryKind: "fill",
    paths: [{ closed: true, points: [{ x, y: 0 }, { x: x + width, y: 0 }, { x: x + width, y: 10 }, { x, y: 10 }] }],
    style: { type: "tatami", stitchLengthMm: 2.5, rowSpacingMm: 1, angleDeg: 0 },
    underlay: { enabled: false, type: "none", insetMm: 1, stitchLengthMm: 3, rowSpacingMm: 2 },
    pullCompensationMm: 0, entryPoint: null, exitPoint: null,
    transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotationDeg: 0 },
  };
}

describe("object conversion", () => {
  it("preserves non-contiguous color and layer order", () => {
    const result = convertObjects([object("red-back", 0, "#ff0000", 0), object("blue", 1, "#0000ff", 5), object("red-front", 2, "#ff0000", 10)], settings);
    expect(result.blocks.map((block) => block.color)).toEqual(["#ff0000", "#0000ff", "#ff0000"]);
    expect(result.blocks.map((block) => block.objectIds[0])).toEqual(["red-back", "blue", "red-front"]);
  });

  it("adds trim candidates only for the opted-in machine profile", () => {
    const objects = [object("one", 0, "#ff0000", 0), object("two", 1, "#ff0000", 40)];
    expect(convertObjects(objects, settings).trimCount).toBe(0);
    expect(convertObjects(objects, { ...settings, machineProfileId: "dst-auto-trim" }).trimCount).toBeGreaterThan(0);
  });

  it("reports hoop overflow after manual object movement", () => {
    const moved = object("moved", 0, "#000000", 0);
    moved.transform.translateX = 70;
    const result = convertObjects([moved], settings);
    expect(result.issues.some((issue) => issue.code === "hoop-overflow" && issue.severity === "error")).toBe(true);
  });

  it("falls back from satin for wide shapes", () => {
    const wide = object("wide", 0, "#000000", 0, 40);
    wide.style = { type: "satin", densityMm: 0.4, angleDeg: 0, maxWidthMm: 8 };
    const result = convertObjects([wide], settings);
    expect(result.issues.some((issue) => issue.code === "wide-satin")).toBe(true);
    expect(result.stitchCount).toBeGreaterThan(20);
  });

  it("converts a large object set within the stitch limit", () => {
    const objects = Array.from({ length: 100 }, (_, index) => object(`o-${index}`, index, index % 2 ? "#222222" : "#111111", index * 12));
    const started = performance.now(); const result = convertObjects(objects, settings);
    expect(result.stitchCount).toBeLessThan(250_000);
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it("keeps a near-250k stitch plan responsive", () => {
    const large = object("large", 0, "#111111", 0, 100);
    large.paths[0].points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    large.style = { type: "tatami", stitchLengthMm: 1, rowSpacingMm: 0.4, angleDeg: 0 };
    const largeSettings = { ...settings, hoopPreset: "custom" as const, hoopWidthMm: 300, hoopHeightMm: 300, targetWidthMm: 290, targetHeightMm: 290, stitchLengthMm: 1, rowSpacingMm: 0.4 };
    const started = performance.now(); const result = convertObjects([large], largeSettings);
    expect(result.stitchCount).toBeGreaterThan(180_000);
    expect(result.stitchCount).toBeLessThan(250_000);
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
