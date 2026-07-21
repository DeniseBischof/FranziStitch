import { describe, expect, it } from "vitest";
import { parsePathData, parseSvg, parseTransform } from "./svg";

describe("SVG parser", () => {
  it("parses lines, curves, arcs, and closed subpaths", () => {
    const paths = parsePathData("M0 0 L10 0 C10 0 10 10 20 10 A5 5 0 0 1 25 15 Z M30 30 q5 10 10 0");
    expect(paths).toHaveLength(2);
    expect(paths[0].closed).toBe(true);
    expect(paths[0].points.length).toBeGreaterThan(10);
    expect(paths[1].closed).toBe(false);
  });

  it("reads transformed, filled, stroked, and multicolor shapes", () => {
    const design = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <g transform="translate(10 5)"><rect width="20" height="10" fill="#ff0000"/></g>
      <path d="M0 50 L90 50" fill="none" stroke="#0000ff"/>
      <circle cx="70" cy="25" r="10" fill="#00ff00"/>
    </svg>`);
    expect(design.shapes).toHaveLength(3);
    expect(new Set(design.shapes.map((shape) => shape.color)).size).toBe(3);
    expect(design.bounds.maxX).toBe(90);
  });

  it("applies nested matrix transformations", () => {
    const design = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(10 20)"><line x1="0" y1="0" x2="10" y2="0" stroke="black"/></g></svg>`);
    expect(design.bounds.minX).toBe(10);
    expect(design.bounds.minY).toBe(20);
    expect(design.bounds.maxX).toBe(20);
  });

  it("warns about unsupported raster and mask content", () => {
    const design = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/><image href="x.png"/><mask id="m"/></svg>`);
    expect(design.warnings.join(" ")).toContain("image");
    expect(design.warnings.join(" ")).toContain("mask");
  });

  it("rejects files without supported vectors", () => {
    expect(() => parseSvg(`<svg xmlns="http://www.w3.org/2000/svg"><image href="x.png"/></svg>`)).toThrow(/Keine unterstützten/);
    expect(() => parseSvg("not svg")).toThrow(/leer oder beschädigt/);
  });

  it("parses common transform syntax", () => {
    expect(parseTransform("matrix(1 0 0 1 4 5)")).toEqual([1, 0, 0, 1, 4, 5]);
    expect(parseTransform("translate(4 5)")).toEqual([1, 0, 0, 1, 4, 5]);
  });
});
