// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ConversionResult } from "../types";
import { createJef, nearestJefColorIndex } from "./jef";

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

describe("JEF encoder", () => {
  it("writes a structured header, thread palette and decodable commands", async () => {
    const bytes = new Uint8Array(await createJef(fixture(), new Date(2026, 6, 23, 12, 34, 56)).arrayBuffer());
    const view = new DataView(bytes.buffer);
    const stitchOffset = view.getUint32(0, true);
    expect(stitchOffset).toBe(0x74 + 2 * 8);
    expect(view.getUint32(4, true)).toBe(0x14);
    expect(new TextDecoder().decode(bytes.slice(8, 22))).toBe("20260723123456");
    expect(view.getUint32(24, true)).toBe(2);
    expect(view.getUint32(32, true)).toBe(3);
    expect(view.getUint32(116, true)).toBe(10);
    expect(view.getUint32(120, true)).toBe(nearestJefColorIndex("#0000ff"));
    expect(Array.from(bytes.slice(-2))).toEqual([0x80, 0x10]);
    expect(view.getUint32(28, true)).toBe((bytes.length - stitchOffset) / 2);

    let x = 0;
    let y = 0;
    let colors = 0;
    let zeroJumps = 0;
    let index = stitchOffset;
    while (index < bytes.length) {
      if (bytes[index] === 0x80 && bytes[index + 1] === 0x10) break;
      if (bytes[index] === 0x80 && bytes[index + 1] === 0x01) {
        colors += 1;
        index += 4;
        continue;
      }
      if (bytes[index] === 0x80 && bytes[index + 1] === 0x02) {
        const dx = signed(bytes[index + 2]);
        const dy = -signed(bytes[index + 3]);
        if (dx === 0 && dy === 0) zeroJumps += 1;
        expect(Math.abs(dx)).toBeLessThanOrEqual(127);
        expect(Math.abs(dy)).toBeLessThanOrEqual(127);
        x += dx;
        y += dy;
        index += 4;
        continue;
      }
      const dx = signed(bytes[index]);
      const dy = -signed(bytes[index + 1]);
      expect(Math.abs(dx)).toBeLessThanOrEqual(127);
      expect(Math.abs(dy)).toBeLessThanOrEqual(127);
      x += dx;
      y += dy;
      index += 2;
    }
    expect({ x, y }).toEqual({ x: 210, y: 210 });
    expect(colors).toBe(1);
    expect(zeroJumps).toBe(3);
  });

  it("maps exact standard colors to their JEF palette entries", () => {
    expect(nearestJefColorIndex("#000000")).toBe(1);
    expect(nearestJefColorIndex("#ffffff")).toBe(2);
    expect(nearestJefColorIndex("#ff0000")).toBe(10);
    expect(nearestJefColorIndex("#0b2f84")).toBe(12);
  });
});
