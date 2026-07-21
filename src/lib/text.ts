import { parse, type Font, type Glyph, type PathCommand } from "opentype.js";
import notoSansUrl from "@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff?url";
import notoSerifUrl from "@fontsource/noto-serif/files/noto-serif-latin-700-normal.woff?url";
import pacificoUrl from "@fontsource/pacifico/files/pacifico-latin-400-normal.woff?url";
import montserratUrl from "@fontsource/montserrat/files/montserrat-latin-800-normal.woff?url";
import playfairUrl from "@fontsource/playfair-display/files/playfair-display-latin-800-normal.woff?url";
import lobsterUrl from "@fontsource/lobster/files/lobster-latin-400-normal.woff?url";
import bungeeUrl from "@fontsource/bungee/files/bungee-latin-400-normal.woff?url";
import { boundsOfPolylines } from "./geometry";
import { parsePathData } from "./svg";
import type { ParsedVectorDesign, TextDesignSource, TextFont, VectorShape } from "../types";

const FONT_URL: Record<TextFont, string> = {
  "noto-sans": notoSansUrl,
  "noto-serif": notoSerifUrl,
  pacifico: pacificoUrl,
  montserrat: montserratUrl,
  playfair: playfairUrl,
  lobster: lobsterUrl,
  bungee: bungeeUrl,
};

const fontCache = new Map<TextFont, Promise<Font>>();

async function loadFont(font: TextFont) {
  if (!fontCache.has(font)) {
    fontCache.set(font, fetch(FONT_URL[font]).then(async (response) => {
      if (!response.ok) throw new Error("Die eingebettete Schrift konnte nicht geladen werden.");
      return parse(await response.arrayBuffer());
    }));
  }
  return fontCache.get(font)!;
}

function commandValue(command: PathCommand, key: "x" | "y" | "x1" | "y1" | "x2" | "y2") {
  return key in command ? Number(command[key as keyof PathCommand]) : 0;
}

function pathData(commands: PathCommand[]) {
  return commands.map((command) => {
    if (command.type === "Z") return "Z";
    if (command.type === "M" || command.type === "L") return `${command.type}${commandValue(command, "x")} ${commandValue(command, "y")}`;
    if (command.type === "Q") return `Q${commandValue(command, "x1")} ${commandValue(command, "y1")} ${commandValue(command, "x")} ${commandValue(command, "y")}`;
    if (command.type === "C") return `C${commandValue(command, "x1")} ${commandValue(command, "y1")} ${commandValue(command, "x2")} ${commandValue(command, "y2")} ${commandValue(command, "x")} ${commandValue(command, "y")}`;
    return "";
  }).join(" ");
}

function glyphAdvance(font: Font, glyph: Glyph, next: Glyph | undefined, fontSize: number) {
  const scale = fontSize / font.unitsPerEm;
  const kerning = next ? font.getKerningValue(glyph, next) * scale : 0;
  return (glyph.advanceWidth ?? font.unitsPerEm) * scale + kerning;
}

export async function textToVectorDesign(source: TextDesignSource): Promise<ParsedVectorDesign> {
  const text = source.text.trim();
  if (!text) throw new Error("Bitte gib zuerst einen Schriftzug ein.");
  const font = await loadFont(source.font);
  const glyphs = font.stringToGlyphs(text);
  const missingCharacters = Array.from(text).filter((character) => !/\s/.test(character) && font.charToGlyph(character).index === 0);
  if (missingCharacters.length) {
    throw new Error(`Die gewählte Schrift enthält folgende Zeichen nicht: ${[...new Set(missingCharacters)].join(" ")}`);
  }
  const shapes: VectorShape[] = [];
  const fontSize = 1000;
  let x = 0;
  glyphs.forEach((glyph, index) => {
    const commands = glyph.getPath(x, 0, fontSize).commands;
    const paths = parsePathData(pathData(commands));
    if (paths.length) shapes.push({ id: `glyph-${index}`, kind: "fill", color: source.color, paths });
    x += glyphAdvance(font, glyph, glyphs[index + 1], fontSize);
  });
  if (!shapes.length) throw new Error("Der Text enthält keine darstellbaren Zeichen.");
  return { shapes, bounds: boundsOfPolylines(shapes.flatMap((shape) => shape.paths)), warnings: [] };
}
