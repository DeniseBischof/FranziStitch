import { describe, expect, it } from "vitest";
import { parseSvg } from "./lib/svg";
import { EXAMPLE_DESIGNS } from "./examples";

describe("example designs", () => {
  it.each(EXAMPLE_DESIGNS)("parses $id as a colorful vector design", (example) => {
    const parsed = parseSvg(example.svg);
    expect(parsed.shapes.length).toBeGreaterThan(3);
    expect(new Set(parsed.shapes.map((shape) => shape.color)).size).toBeGreaterThan(1);
    expect(parsed.bounds.width).toBeGreaterThan(20);
    expect(parsed.bounds.height).toBeGreaterThan(20);
  });
});
