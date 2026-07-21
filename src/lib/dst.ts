import type { ConversionResult, StitchPoint } from "../types";

const DST_UNITS_PER_MM = 10;
const MAX_DELTA = 121;

function addBalanced(value: number, amount: number, lowerRange: number, positive: [number, number], negative: [number, number], bytes: number[]) {
  if (value > lowerRange) { bytes[positive[0]] |= positive[1]; value -= amount; }
  else if (value < -lowerRange) { bytes[negative[0]] |= negative[1]; value += amount; }
  return value;
}

export function encodeDstRecord(dx: number, dy: number, jump = false): number[] {
  if (Math.abs(dx) > MAX_DELTA || Math.abs(dy) > MAX_DELTA) throw new Error("DST-Bewegung liegt außerhalb des gültigen Bereichs.");
  const bytes = [0, 0, jump ? 0x83 : 0x03];
  let x = Math.round(dx); let y = Math.round(dy);
  x = addBalanced(x, 81, 40, [2, 0x04], [2, 0x08], bytes);
  x = addBalanced(x, 27, 13, [1, 0x04], [1, 0x08], bytes);
  x = addBalanced(x, 9, 4, [0, 0x04], [0, 0x08], bytes);
  x = addBalanced(x, 3, 1, [1, 0x01], [1, 0x02], bytes);
  addBalanced(x, 1, 0, [0, 0x01], [0, 0x02], bytes);
  y = addBalanced(y, 81, 40, [2, 0x20], [2, 0x10], bytes);
  y = addBalanced(y, 27, 13, [1, 0x20], [1, 0x10], bytes);
  y = addBalanced(y, 9, 4, [0, 0x20], [0, 0x10], bytes);
  y = addBalanced(y, 3, 1, [1, 0x80], [1, 0x40], bytes);
  addBalanced(y, 1, 0, [0, 0x80], [0, 0x40], bytes);
  return bytes;
}

function splitMovement(dx: number, dy: number) {
  const count = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_DELTA));
  const parts: { x: number; y: number }[] = [];
  let previousX = 0; let previousY = 0;
  for (let index = 1; index <= count; index += 1) {
    const nextX = Math.round((dx * index) / count); const nextY = Math.round((dy * index) / count);
    parts.push({ x: nextX - previousX, y: nextY - previousY });
    previousX = nextX; previousY = nextY;
  }
  return parts;
}

function label(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 16) || "FRANZISTITCH";
}

function createHeader(name: string, recordCount: number, colorChanges: number, coordinates: { x: number; y: number }[]) {
  let minX = 0; let maxX = 0; let minY = 0; let maxY = 0;
  for (const point of coordinates) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  const last = coordinates.at(-1) ?? { x: 0, y: 0 };
  const line = (key: string, value: string) => `${key}:${value}\r`;
  const text =
    line("LA", label(name).padEnd(16)) +
    line("ST", String(recordCount).padStart(7)) +
    line("CO", String(colorChanges).padStart(3)) +
    line("+X", String(maxX).padStart(5)) +
    line("-X", String(Math.abs(minX)).padStart(5)) +
    line("+Y", String(maxY).padStart(5)) +
    line("-Y", String(Math.abs(minY)).padStart(5)) +
    line("AX", String(last.x).padStart(6)) +
    line("AY", String(last.y).padStart(6)) +
    line("MX", "     0") + line("MY", "     0") + line("PD", "******");
  const header = new Uint8Array(512).fill(0x20);
  const encoded = new TextEncoder().encode(text);
  header.set(encoded.slice(0, 511));
  header[Math.min(encoded.length, 511)] = 0x1a;
  return header;
}

export function createDst(result: ConversionResult, name: string): Blob {
  const data: number[] = [];
  const coordinates: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  let currentX = 0; let currentY = 0; let records = 0;
  const moveTo = (point: StitchPoint) => {
    if (point.command === "trim") {
      data.push(...encodeDstRecord(2, 2, true), ...encodeDstRecord(-4, -4, true), ...encodeDstRecord(2, 2, true));
      records += 3;
      return;
    }
    if (point.command === "color-change" || point.command === "end") return;
    if (point.command === "stop") {
      data.push(0, 0, 0xc3);
      records += 1;
      return;
    }
    const targetX = Math.round(point.x * DST_UNITS_PER_MM);
    const targetY = Math.round(-point.y * DST_UNITS_PER_MM);
    for (const part of splitMovement(targetX - currentX, targetY - currentY)) {
      data.push(...encodeDstRecord(part.x, part.y, point.command === "jump")); records += 1;
      currentX += part.x; currentY += part.y; coordinates.push({ x: currentX, y: currentY });
    }
  };
  result.blocks.forEach((block, index) => {
    if (index > 0) { data.push(0, 0, 0xc3); records += 1; }
    block.stitches.forEach(moveTo);
  });
  data.push(0, 0, 0xf3);
  const header = createHeader(name, records, Math.max(0, result.blocks.length - 1), coordinates);
  return new Blob([header, new Uint8Array(data)], { type: "application/octet-stream" });
}
