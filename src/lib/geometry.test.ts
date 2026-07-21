import { describe, expect, it } from "vitest";
import { addTieStitches, filterShortStitches, offsetPaths, resamplePolyline, runningStitches, satinStitches, tatamiStitches, transformPaths, underlayStitches } from "./geometry";

describe("geometry", () => {
  it("resamples an open path at the requested maximum length", () => {
    const points = resamplePolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 2.5);
    expect(points).toHaveLength(5);
    expect(points.at(-1)).toEqual({ x: 10, y: 0 });
  });

  it("marks the first point of each running path as a jump", () => {
    const stitches = runningStitches([
      { closed: false, points: [{ x: 0, y: 0 }, { x: 5, y: 0 }] },
      { closed: false, points: [{ x: 10, y: 0 }, { x: 15, y: 0 }] },
    ], 2.5);
    expect(stitches.filter((point) => point.command === "jump")).toHaveLength(2);
  });

  it("creates serpentine tatami rows and respects holes", () => {
    const outer = { closed: true, points: [{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }] };
    const hole = { closed: true, points: [{ x: -3, y: -3 }, { x: 3, y: -3 }, { x: 3, y: 3 }, { x: -3, y: 3 }] };
    const stitches = tatamiStitches([outer, hole], 2.5, 1, 0);
    expect(stitches.length).toBeGreaterThan(100);
    expect(stitches.filter((point) => point.command === "jump").length).toBeGreaterThan(20);
    expect(stitches.some((point) => Math.abs(point.y) < 3 && Math.abs(point.x) < 3)).toBe(false);
  });

  it("centers and scales transformed paths", () => {
    const transformed = transformPaths([{ closed: true, points: [{ x: 10, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 40 }] }], { minX: 10, minY: 20, maxX: 30, maxY: 40, width: 20, height: 20 }, 100, 50);
    expect(transformed[0].points[0]).toEqual({ x: -50, y: -25 });
    expect(transformed[0].points[2]).toEqual({ x: 50, y: 25 });
  });

  it("creates a satin zigzag for a narrow column", () => {
    const column = { closed: true, points: [{ x: -3, y: -10 }, { x: 3, y: -10 }, { x: 3, y: 10 }, { x: -3, y: 10 }] };
    const satin = satinStitches([column], 0.5, 0);
    expect(satin.branched).toBe(false);
    expect(satin.maximumWidth).toBeCloseTo(6);
    expect(satin.stitches.length).toBeGreaterThan(30);
    expect(new Set(satin.stitches.slice(1).map((point) => Math.sign(point.x))).size).toBe(2);
  });

  it("generates edge, center, and tatami underlays", () => {
    const shape = [{ closed: true, points: [{ x: -10, y: -5 }, { x: 10, y: -5 }, { x: 10, y: 5 }, { x: -10, y: 5 }] }];
    for (const type of ["edge", "center", "tatami"] as const) {
      expect(underlayStitches(shape, { enabled: true, type, insetMm: 1, stitchLengthMm: 3, rowSpacingMm: 2 }, 45).length).toBeGreaterThan(2);
    }
    expect(offsetPaths(shape, 1)[0].points[0].x).toBeLessThan(-10);
  });

  it("filters short stitches and adds deterministic tie stitches", () => {
    const source = [
      { x: 0, y: 0, command: "jump" as const },
      { x: 0.1, y: 0, command: "stitch" as const },
      { x: 2, y: 0, command: "stitch" as const },
    ];
    expect(filterShortStitches(source, 0.5)).toHaveLength(2);
    expect(addTieStitches(source).length).toBeGreaterThan(source.length);
  });
});
