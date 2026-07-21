// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createDst, encodeDstRecord } from "./dst";
import type { ConversionResult } from "../types";

function decode(bytes: number[]) {
  const sign = (positive: boolean, negative: boolean, amount: number) => (positive ? amount : 0) - (negative ? amount : 0);
  const x = sign(Boolean(bytes[2] & 0x04), Boolean(bytes[2] & 0x08), 81) + sign(Boolean(bytes[1] & 0x04), Boolean(bytes[1] & 0x08), 27) + sign(Boolean(bytes[0] & 0x04), Boolean(bytes[0] & 0x08), 9) + sign(Boolean(bytes[1] & 0x01), Boolean(bytes[1] & 0x02), 3) + sign(Boolean(bytes[0] & 0x01), Boolean(bytes[0] & 0x02), 1);
  const y = sign(Boolean(bytes[2] & 0x20), Boolean(bytes[2] & 0x10), 81) + sign(Boolean(bytes[1] & 0x20), Boolean(bytes[1] & 0x10), 27) + sign(Boolean(bytes[0] & 0x20), Boolean(bytes[0] & 0x10), 9) + sign(Boolean(bytes[1] & 0x80), Boolean(bytes[1] & 0x40), 3) + sign(Boolean(bytes[0] & 0x80), Boolean(bytes[0] & 0x40), 1);
  return { x, y };
}

describe("DST encoder", () => {
  it("round-trips all valid record deltas", () => {
    for (let delta = -121; delta <= 121; delta += 1) {
      expect(decode(encodeDstRecord(delta, delta))).toEqual({ x: delta, y: delta });
    }
    expect(encodeDstRecord(10, 10, true)[2] & 0x80).toBe(0x80);
    expect(() => encodeDstRecord(122, 0)).toThrow();
  });

  it("writes a 512-byte header, long moves, color changes, and end marker", async () => {
    const result: ConversionResult = {
      blocks: [
        { id: "a", color: "#ff0000", label: "Rot", objectIds: ["a"], stitches: [{ x: -30, y: -30, command: "jump" }, { x: 30, y: 30, command: "stitch" }] },
        { id: "b", color: "#0000ff", label: "Blau", objectIds: ["b"], stitches: [{ x: 0, y: 0, command: "jump" }, { x: 1, y: 1, command: "stitch" }] },
      ],
      bounds: { minX: -30, minY: -30, maxX: 30, maxY: 30, width: 60, height: 60 },
      stitchCount: 2, jumpCount: 2, trimCount: 0, colorChangeCount: 1, warnings: [], issues: [],
    };
    const bytes = new Uint8Array(await createDst(result, "Ä Test").arrayBuffer());
    expect(bytes.length).toBeGreaterThan(512 + 15);
    expect(new TextDecoder().decode(bytes.slice(0, 20))).toContain("LA:A Test");
    expect(Array.from(bytes.slice(512)).some((_, index, data) => data[index] === 0 && data[index + 1] === 0 && data[index + 2] === 0xc3)).toBe(true);
    expect(Array.from(bytes.slice(-3))).toEqual([0, 0, 0xf3]);
  });

  it("encodes a trim candidate as three consecutive jump records", async () => {
    const result: ConversionResult = {
      blocks: [{ id: "a", color: "#000000", label: "Test", objectIds: ["a"], stitches: [
        { x: 0, y: 0, command: "jump" }, { x: 5, y: 0, command: "stitch" }, { x: 5, y: 0, command: "trim" }, { x: 20, y: 0, command: "jump" },
      ] }],
      bounds: { minX: 0, minY: 0, maxX: 20, maxY: 0, width: 20, height: 0 },
      stitchCount: 1, jumpCount: 2, trimCount: 1, colorChangeCount: 0, warnings: [], issues: [],
    };
    const data = Array.from(new Uint8Array(await createDst(result, "trim").arrayBuffer()).slice(512));
    const trimStart = data.findIndex((value, index) => value === 0x83 && data[index + 3] === 0x83 && data[index + 6] === 0x83);
    expect(trimStart).toBeGreaterThanOrEqual(2);
    const trimRecords = [
      data.slice(trimStart - 2, trimStart + 1),
      data.slice(trimStart + 1, trimStart + 4),
      data.slice(trimStart + 4, trimStart + 7),
    ];
    expect(trimRecords.map(decode)).toEqual([{ x: 2, y: 2 }, { x: -4, y: -4 }, { x: 2, y: 2 }]);
  });

  it("exports a large stitch plan without exhausting the call stack", async () => {
    const stitches = Array.from({ length: 180_000 }, (_, index) => ({
      x: (index % 1000) / 10,
      y: Math.floor(index / 1000) / 10,
      command: "stitch" as const,
    }));
    const result: ConversionResult = {
      blocks: [{ id: "large", color: "#000000", label: "Groß", objectIds: ["large"], stitches }],
      bounds: { minX: 0, minY: 0, maxX: 99.9, maxY: 17.9, width: 99.9, height: 17.9 },
      stitchCount: stitches.length, jumpCount: 0, trimCount: 0, colorChangeCount: 0, warnings: [], issues: [],
    };
    const bytes = new Uint8Array(await createDst(result, "gross").arrayBuffer());
    expect(bytes.length).toBeGreaterThan(512 + stitches.length * 3);
    expect(Array.from(bytes.slice(-3))).toEqual([0, 0, 0xf3]);
  });
});
