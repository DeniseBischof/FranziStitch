// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ConversionResult } from "../types";
import { createExp } from "./exp";

const signed = (value: number) => value > 127 ? value - 256 : value;

function fixture(): ConversionResult {
  return {
    blocks: [
      { id: "red", color: "#ff0000", label: "Rot", objectIds: ["red"], stitches: [
        { x: -30, y: 15, command: "jump" },
        { x: 5, y: -10, command: "stitch" },
        { x: 5, y: -10, command: "trim" },
      ] },
      { id: "blue", color: "#0000ff", label: "Blau", objectIds: ["blue"], stitches: [
        { x: 20, y: 20, command: "jump" },
        { x: 21, y: 21, command: "stitch" },
      ] },
    ],
    bounds: { minX: -30, minY: -10, maxX: 21, maxY: 21, width: 51, height: 31 },
    stitchCount: 2,
    jumpCount: 2,
    trimCount: 1,
    colorChangeCount: 1,
    warnings: [],
    issues: [],
  };
}

describe("EXP encoder", () => {
  it("writes bounded movements, jumps, trims and color changes", async () => {
    const bytes = Array.from(new Uint8Array(await createExp(fixture()).arrayBuffer()));
    let x = 0;
    let y = 0;
    let colors = 0;
    let trims = 0;
    let index = 0;
    while (index < bytes.length) {
      if (bytes[index] === 0x80 && bytes[index + 1] === 0x01) {
        colors += 1;
        index += 4;
      } else if (bytes[index] === 0x80 && bytes[index + 1] === 0x80) {
        expect(bytes.slice(index, index + 4)).toEqual([0x80, 0x80, 0x07, 0x00]);
        trims += 1;
        index += 4;
      } else if (bytes[index] === 0x80 && bytes[index + 1] === 0x04) {
        const dx = signed(bytes[index + 2]);
        const dy = -signed(bytes[index + 3]);
        expect(Math.abs(dx)).toBeLessThanOrEqual(127);
        expect(Math.abs(dy)).toBeLessThanOrEqual(127);
        x += dx;
        y += dy;
        index += 4;
      } else {
        const dx = signed(bytes[index]);
        const dy = -signed(bytes[index + 1]);
        expect(Math.abs(dx)).toBeLessThanOrEqual(127);
        expect(Math.abs(dy)).toBeLessThanOrEqual(127);
        x += dx;
        y += dy;
        index += 2;
      }
    }
    expect({ x, y }).toEqual({ x: 210, y: 210 });
    expect(colors).toBe(1);
    expect(trims).toBe(1);
  });
});
