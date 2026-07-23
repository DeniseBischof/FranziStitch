import type { ConversionResult, EmbroideryFormat } from "../types";
import { createDst } from "./dst";
import { createExp } from "./exp";
import { createJef } from "./jef";

export function createEmbroideryFile(result: ConversionResult, name: string, format: EmbroideryFormat) {
  if (format === "exp") return createExp(result);
  if (format === "jef") return createJef(result);
  return createDst(result, name);
}
