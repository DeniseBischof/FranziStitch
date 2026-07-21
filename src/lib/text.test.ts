// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { textToVectorDesign } from "./text";
import type { TextFont } from "../types";

beforeAll(() => {
  const files: Record<TextFont, Buffer> = {
    "noto-sans": readFileSync(resolve(process.cwd(), "node_modules/@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff")),
    "noto-serif": readFileSync(resolve(process.cwd(), "node_modules/@fontsource/noto-serif/files/noto-serif-latin-700-normal.woff")),
    pacifico: readFileSync(resolve(process.cwd(), "node_modules/@fontsource/pacifico/files/pacifico-latin-400-normal.woff")),
    montserrat: readFileSync(resolve(process.cwd(), "node_modules/@fontsource/montserrat/files/montserrat-latin-800-normal.woff")),
    playfair: readFileSync(resolve(process.cwd(), "node_modules/@fontsource/playfair-display/files/playfair-display-latin-800-normal.woff")),
    lobster: readFileSync(resolve(process.cwd(), "node_modules/@fontsource/lobster/files/lobster-latin-400-normal.woff")),
    bungee: readFileSync(resolve(process.cwd(), "node_modules/@fontsource/bungee/files/bungee-latin-400-normal.woff")),
  };
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: string | URL | Request) => {
    const url = String(input);
    const font = url.includes("noto-serif") ? files["noto-serif"]
      : url.includes("pacifico") ? files.pacifico
      : url.includes("montserrat") ? files.montserrat
      : url.includes("playfair") ? files.playfair
      : url.includes("lobster") ? files.lobster
      : url.includes("bungee") ? files.bungee
      : files["noto-sans"];
    const arrayBuffer = font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) as ArrayBuffer;
    return new Response(arrayBuffer);
  }));
});

describe("vector text conversion", () => {
  it.each<TextFont>(["noto-sans", "noto-serif", "pacifico", "montserrat", "playfair", "lobster", "bungee"])("creates reproducible vector glyphs with %s", async (font) => {
    const result = await textToVectorDesign({ kind: "text", name: "umlaute", text: "ÄÖÜ äöü ß", font, color: "#000000" });
    expect(result.shapes.length).toBeGreaterThan(6);
    expect(result.shapes.every((shape) => shape.paths.length > 0)).toBe(true);
    expect(result.bounds.width).toBeGreaterThan(1000);
  });

  it.each<TextFont>(["noto-sans", "noto-serif", "pacifico", "montserrat", "playfair", "lobster", "bungee"])("uses real %s outlines instead of .notdef boxes", async (font) => {
    const result = await textToVectorDesign({ kind: "text", name: "franzi", text: "Franzi", font, color: "#e24b2d" });
    const glyphWidths = result.shapes.map((shape) => {
      const bounds = shape.paths.flatMap((path) => path.points).map((point) => point.x);
      return Math.round(Math.max(...bounds) - Math.min(...bounds));
    });
    expect(new Set(glyphWidths).size).toBeGreaterThan(2);
    expect(result.shapes.some((shape) => shape.paths.some((path) => path.points.length > 8))).toBe(true);
  });
});
