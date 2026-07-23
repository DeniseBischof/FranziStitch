import type { ConversionResult, StitchPoint } from "../types";

const UNITS_PER_MM = 10;
const MAX_DELTA = 127;

// Janome's built-in JEF thread palette. Index zero is reserved by the format.
const JEF_COLORS = [
  null,
  0x000000, 0xffffff, 0xffff17, 0xff6600, 0x2f5933, 0x237336, 0x65c2c8, 0xab5a96, 0xf669a0,
  0xff0000, 0xb1704e, 0x0b2f84, 0xe4c35d, 0x481a05, 0xac9cc7, 0xfcf294, 0xf999b7, 0xfab381, 0xc9a480,
  0x970533, 0xa0b8cc, 0x7fc21c, 0xe5e5e5, 0x889b9b, 0x98d6bd, 0xb2e1e3, 0x368ba0, 0x4f83ab, 0x386a91,
  0x071650, 0xf999a2, 0xf9676b, 0xe3311f, 0xe2a188, 0xb59474, 0xe4cf99, 0xffcb00, 0xe1add4, 0xc3007e,
  0x80004b, 0x540571, 0xb10525, 0xcae0c0, 0x899856, 0x5c941a, 0x003114, 0x5dae94, 0x4cbf8f, 0x007772,
  0x595b61, 0xfffff2, 0xb15818, 0xcb8a07, 0x986c80, 0x98692d, 0x4d3419, 0x4c330b, 0x33200a, 0x523a97,
  0x0d217e, 0x1e77ac, 0xb2dd53, 0xf33689, 0xde649e, 0x984161, 0x4c5612, 0x4c881f, 0xe4de79, 0xcb8a1a,
  0xcba21c, 0xff9805, 0xfcb257, 0xffe505, 0xf0331f, 0x1a842d, 0x386cae, 0xe3c4b4, 0xe3ac81,
] as const;

function splitMovement(dx: number, dy: number) {
  const count = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_DELTA));
  const parts: { x: number; y: number }[] = [];
  let previousX = 0;
  let previousY = 0;
  for (let index = 1; index <= count; index += 1) {
    const nextX = Math.round((dx * index) / count);
    const nextY = Math.round((dy * index) / count);
    parts.push({ x: nextX - previousX, y: nextY - previousY });
    previousX = nextX;
    previousY = nextY;
  }
  return parts;
}

function signedByte(value: number) {
  if (value < -127 || value > 127) throw new Error("JEF-Bewegung liegt außerhalb des gültigen Bereichs.");
  return value & 0xff;
}

function pushInt32(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function dateStamp(value: Date) {
  const part = (number: number) => String(number).padStart(2, "0");
  return `${value.getFullYear()}${part(value.getMonth() + 1)}${part(value.getDate())}${part(value.getHours())}${part(value.getMinutes())}${part(value.getSeconds())}`;
}

function rgb(value: number) {
  return { r: (value >>> 16) & 0xff, g: (value >>> 8) & 0xff, b: value & 0xff };
}

export function nearestJefColorIndex(color: string) {
  const parsed = Number.parseInt(color.replace(/^#/, ""), 16);
  if (!Number.isFinite(parsed)) return 1;
  const source = rgb(parsed);
  let bestIndex = 1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < JEF_COLORS.length; index += 1) {
    const candidate = rgb(JEF_COLORS[index] ?? 0);
    const distance = (source.r - candidate.r) ** 2 + (source.g - candidate.g) ** 2 + (source.b - candidate.b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function hoopCode(width: number, height: number) {
  if (width <= 500 && height <= 500) return 1;
  if (width <= 1260 && height <= 1100) return 3;
  if (width <= 1400 && height <= 2000) return 2;
  if (width <= 2000 && height <= 2000) return 4;
  return 0;
}

function pushHoopDistance(bytes: number[], horizontal: number, vertical: number) {
  if (horizontal < 0 || vertical < 0) {
    for (let index = 0; index < 4; index += 1) pushInt32(bytes, -1);
    return;
  }
  pushInt32(bytes, horizontal);
  pushInt32(bytes, vertical);
  pushInt32(bytes, horizontal);
  pushInt32(bytes, vertical);
}

export function createJef(result: ConversionResult, createdAt = new Date()): Blob {
  const stitches: number[] = [];
  let currentX = 0;
  let currentY = 0;

  const writePoint = (point: StitchPoint) => {
    if (point.command === "trim") {
      stitches.push(0x80, 0x02, 0x00, 0x00, 0x80, 0x02, 0x00, 0x00, 0x80, 0x02, 0x00, 0x00);
      return;
    }
    if (point.command === "stop") {
      stitches.push(0x80, 0x01, 0x00, 0x00);
      return;
    }
    if (point.command !== "stitch" && point.command !== "jump") return;

    const targetX = Math.round(point.x * UNITS_PER_MM);
    const targetY = Math.round(point.y * UNITS_PER_MM);
    for (const part of splitMovement(targetX - currentX, targetY - currentY)) {
      const dx = signedByte(part.x);
      const dy = signedByte(-part.y);
      if (point.command === "jump") stitches.push(0x80, 0x02, dx, dy);
      else stitches.push(dx, dy);
      currentX += part.x;
      currentY += part.y;
    }
  };

  result.blocks.forEach((block, index) => {
    if (index > 0) stitches.push(0x80, 0x01, 0x00, 0x00);
    block.stitches.forEach(writePoint);
  });
  stitches.push(0x80, 0x10);

  const colorCount = Math.max(1, result.blocks.length);
  const stitchOffset = 0x74 + colorCount * 8;
  const width = Math.round(result.bounds.width * UNITS_PER_MM);
  const height = Math.round(result.bounds.height * UNITS_PER_MM);
  const halfWidth = Math.round(width / 2);
  const halfHeight = Math.round(height / 2);
  const header: number[] = [];

  pushInt32(header, stitchOffset);
  pushInt32(header, 0x14);
  header.push(...new TextEncoder().encode(dateStamp(createdAt)), 0, 0);
  pushInt32(header, colorCount);
  pushInt32(header, stitches.length / 2);
  pushInt32(header, hoopCode(width, height));
  pushInt32(header, halfWidth);
  pushInt32(header, halfHeight);
  pushInt32(header, halfWidth);
  pushInt32(header, halfHeight);
  pushHoopDistance(header, 550 - halfWidth, 550 - halfHeight);
  pushHoopDistance(header, 250 - halfWidth, 250 - halfHeight);
  pushHoopDistance(header, 700 - halfWidth, 1000 - halfHeight);
  pushHoopDistance(header, 700 - halfWidth, 1000 - halfHeight);

  if (result.blocks.length) {
    for (const block of result.blocks) pushInt32(header, nearestJefColorIndex(block.color));
  } else {
    pushInt32(header, 1);
  }
  for (let index = 0; index < colorCount; index += 1) pushInt32(header, 0x0d);

  if (header.length !== stitchOffset) throw new Error("Der JEF-Header konnte nicht korrekt aufgebaut werden.");
  return new Blob([new Uint8Array(header), new Uint8Array(stitches)], { type: "application/octet-stream" });
}
