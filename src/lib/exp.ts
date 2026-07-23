import type { ConversionResult, StitchPoint } from "../types";

const UNITS_PER_MM = 10;
const MAX_DELTA = 127;

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
  if (value < -127 || value > 127) throw new Error("EXP-Bewegung liegt außerhalb des gültigen Bereichs.");
  return value & 0xff;
}

export function createExp(result: ConversionResult): Blob {
  const data: number[] = [];
  let currentX = 0;
  let currentY = 0;

  const writePoint = (point: StitchPoint) => {
    if (point.command === "trim") {
      data.push(0x80, 0x80, 0x07, 0x00);
      return;
    }
    if (point.command === "stop") {
      data.push(0x80, 0x01, 0x00, 0x00);
      return;
    }
    if (point.command !== "stitch" && point.command !== "jump") return;

    const targetX = Math.round(point.x * UNITS_PER_MM);
    const targetY = Math.round(point.y * UNITS_PER_MM);
    for (const part of splitMovement(targetX - currentX, targetY - currentY)) {
      const dx = signedByte(part.x);
      const dy = signedByte(-part.y);
      if (point.command === "jump") data.push(0x80, 0x04, dx, dy);
      else data.push(dx, dy);
      currentX += part.x;
      currentY += part.y;
    }
  };

  result.blocks.forEach((block, index) => {
    if (index > 0) data.push(0x80, 0x01, 0x00, 0x00);
    block.stitches.forEach(writePoint);
  });

  return new Blob([new Uint8Array(data)], { type: "application/octet-stream" });
}
