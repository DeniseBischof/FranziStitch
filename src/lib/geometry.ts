import type { DesignBounds, ObjectTransform, Point, Polyline, StitchPoint, UnderlaySettings } from "../types";

export const EPSILON = 1e-7;

export function boundsOf(points: Point[]): DesignBounds {
  if (!points.length) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function boundsOfPolylines(paths: Polyline[]) {
  const points: Point[] = [];
  for (const path of paths) {
    for (const point of path.points) points.push(point);
  }
  return boundsOf(points);
}

export function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function resamplePolyline(points: Point[], stitchLength: number, closed = false): Point[] {
  if (points.length < 2) return points;
  const source = closed && distance(points[0], points[points.length - 1]) > EPSILON
    ? [...points, points[0]]
    : points;
  const output: Point[] = [{ ...source[0] }];
  for (let index = 1; index < source.length; index += 1) {
    const start = source[index - 1];
    const end = source[index];
    const length = distance(start, end);
    const steps = Math.max(1, Math.ceil(length / stitchLength));
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      output.push({
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      });
    }
  }
  return output;
}

export function runningStitches(paths: Polyline[], stitchLength: number): StitchPoint[] {
  const stitches: StitchPoint[] = [];
  for (const path of paths) {
    const sampled = resamplePolyline(path.points, stitchLength, path.closed);
    sampled.forEach((point, index) => {
      stitches.push({ ...point, command: index === 0 ? "jump" : "stitch" });
    });
  }
  return stitches;
}

export function rotate(point: Point, radians: number): Point {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  };
}

export function applyObjectTransform(paths: Polyline[], transform: ObjectTransform): Polyline[] {
  const radians = (transform.rotationDeg * Math.PI) / 180;
  return paths.map((path) => ({
    ...path,
    points: path.points.map((point) => {
      const scaled = { x: point.x * transform.scaleX, y: point.y * transform.scaleY };
      const rotated = rotate(scaled, radians);
      return { x: rotated.x + transform.translateX, y: rotated.y + transform.translateY };
    }),
  }));
}

function centroid(points: Point[]): Point {
  if (!points.length) return { x: 0, y: 0 };
  return points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
}

export function offsetPaths(paths: Polyline[], amountMm: number): Polyline[] {
  return paths.map((path) => {
    const center = centroid(path.points);
    return {
      ...path,
      points: path.points.map((point) => {
        const dx = point.x - center.x; const dy = point.y - center.y;
        const length = Math.hypot(dx, dy);
        if (length < EPSILON) return point;
        const factor = Math.max(0.05, (length + amountMm) / length);
        return { x: center.x + dx * factor, y: center.y + dy * factor };
      }),
    };
  });
}

export function filterShortStitches(stitches: StitchPoint[], minimumLengthMm: number): StitchPoint[] {
  if (stitches.length < 3 || minimumLengthMm <= 0) return stitches;
  const result: StitchPoint[] = [];
  for (let index = 0; index < stitches.length; index += 1) {
    const point = stitches[index];
    if (point.command !== "stitch" || !result.length || index === stitches.length - 1 || stitches[index + 1]?.command !== "stitch") {
      result.push(point); continue;
    }
    if (distance(result[result.length - 1], point) >= minimumLengthMm) result.push(point);
  }
  return result;
}

function tieSequence(point: StitchPoint, direction: Point, reverse = false): StitchPoint[] {
  const length = Math.max(Math.hypot(direction.x, direction.y), EPSILON);
  const unit = { x: direction.x / length, y: direction.y / length };
  const sign = reverse ? -1 : 1;
  return [0.7, 0.15, 0.7].map((offset) => ({
    x: point.x + unit.x * offset * sign,
    y: point.y + unit.y * offset * sign,
    command: "stitch" as const,
    objectId: point.objectId,
  }));
}

export function addTieStitches(stitches: StitchPoint[]): StitchPoint[] {
  const result: StitchPoint[] = [];
  let segment: StitchPoint[] = [];
  const flush = () => {
    if (!segment.length) return;
    if (segment.length >= 2) {
      const first = segment[0]; const second = segment[1]; const last = segment[segment.length - 1]; const beforeLast = segment[segment.length - 2];
      result.push(first, ...tieSequence(first, { x: second.x - first.x, y: second.y - first.y }), ...segment.slice(1), ...tieSequence(last, { x: last.x - beforeLast.x, y: last.y - beforeLast.y }, true));
    } else result.push(...segment);
    segment = [];
  };
  for (const stitch of stitches) {
    if (stitch.command === "jump") { flush(); segment = [stitch]; }
    else segment.push(stitch);
  }
  flush();
  return result;
}

export function underlayStitches(paths: Polyline[], settings: UnderlaySettings, angleDegrees: number): StitchPoint[] {
  if (!settings.enabled || settings.type === "none") return [];
  const inset = offsetPaths(paths, -Math.abs(settings.insetMm));
  if (settings.type === "edge") return runningStitches(inset, settings.stitchLengthMm);
  if (settings.type === "tatami") return tatamiStitches(inset, settings.stitchLengthMm, settings.rowSpacingMm, angleDegrees + 90);
  const stitches: StitchPoint[] = [];
  for (const path of inset) {
    const bounds = boundsOf(path.points);
    const horizontal = bounds.width >= bounds.height;
    const start = horizontal ? { x: bounds.minX, y: bounds.minY + bounds.height / 2 } : { x: bounds.minX + bounds.width / 2, y: bounds.minY };
    const end = horizontal ? { x: bounds.maxX, y: start.y } : { x: start.x, y: bounds.maxY };
    stitches.push(...runningStitches([{ closed: false, points: [start, end] }], settings.stitchLengthMm));
  }
  return stitches;
}

function intersectionsAtY(paths: Polyline[], y: number): number[] {
  const intersections: number[] = [];
  for (const path of paths) {
    const points = path.points;
    if (points.length < 3) continue;
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const crosses = (a.y <= y && b.y > y) || (b.y <= y && a.y > y);
      if (!crosses) continue;
      const ratio = (y - a.y) / (b.y - a.y);
      intersections.push(a.x + (b.x - a.x) * ratio);
    }
  }
  return intersections.sort((a, b) => a - b);
}

export function tatamiStitches(
  paths: Polyline[],
  stitchLength: number,
  rowSpacing: number,
  angleDegrees: number,
): StitchPoint[] {
  const closedPaths = paths.filter((path) => path.closed && path.points.length >= 3);
  if (!closedPaths.length) return [];
  const radians = (-angleDegrees * Math.PI) / 180;
  const rotatedPaths = closedPaths.map((path) => ({
    closed: true,
    points: path.points.map((point) => rotate(point, radians)),
  }));
  const bounds = boundsOfPolylines(rotatedPaths);
  const rows = Math.max(1, Math.ceil(bounds.height / rowSpacing));
  const output: StitchPoint[] = [];
  let reverse = false;

  for (let row = 0; row <= rows; row += 1) {
    const y = Math.min(bounds.maxY - EPSILON, bounds.minY + row * rowSpacing);
    const intersections = intersectionsAtY(rotatedPaths, y);
    const runs: [number, number][] = [];
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      if (intersections[index + 1] - intersections[index] > EPSILON) {
        runs.push([intersections[index], intersections[index + 1]]);
      }
    }
    if (reverse) runs.reverse();
    for (const [left, right] of runs) {
      const start = reverse ? right : left;
      const end = reverse ? left : right;
      const length = Math.abs(end - start);
      const steps = Math.max(1, Math.ceil(length / stitchLength));
      for (let step = 0; step <= steps; step += 1) {
        const ratio = step / steps;
        const point = rotate({ x: start + (end - start) * ratio, y }, -radians);
        output.push({ ...point, command: step === 0 ? "jump" : "stitch" });
      }
    }
    reverse = !reverse;
  }
  return output;
}

export function satinStitches(
  paths: Polyline[],
  densityMm: number,
  angleDegrees: number,
): { stitches: StitchPoint[]; maximumWidth: number; branched: boolean } {
  const closedPaths = paths.filter((path) => path.closed && path.points.length >= 3);
  if (!closedPaths.length) return { stitches: [], maximumWidth: 0, branched: false };
  const radians = (-angleDegrees * Math.PI) / 180;
  const rotatedPaths = closedPaths.map((path) => ({ closed: true, points: path.points.map((point) => rotate(point, radians)) }));
  const bounds = boundsOfPolylines(rotatedPaths);
  const rows = Math.max(1, Math.ceil(bounds.height / Math.max(densityMm, 0.2)));
  const output: StitchPoint[] = [];
  let maximumWidth = 0; let branched = false; let side = false; let activeRun = false;
  for (let row = 0; row <= rows; row += 1) {
    const y = Math.min(bounds.maxY - EPSILON, bounds.minY + row * densityMm);
    const intersections = intersectionsAtY(rotatedPaths, y);
    if (intersections.length > 2) branched = true;
    if (intersections.length < 2) { activeRun = false; continue; }
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const left = intersections[index]; const right = intersections[index + 1];
      maximumWidth = Math.max(maximumWidth, right - left);
      const endpoint = side ? right : left;
      const point = rotate({ x: endpoint, y }, -radians);
      output.push({ ...point, command: activeRun ? "stitch" : "jump" });
      activeRun = true; side = !side;
    }
  }
  return { stitches: output, maximumWidth, branched };
}

export function pathsOverlap(a: Polyline[], b: Polyline[]) {
  const first = boundsOfPolylines(a); const second = boundsOfPolylines(b);
  return first.minX < second.maxX && first.maxX > second.minX && first.minY < second.maxY && first.maxY > second.minY;
}

export function transformPaths(
  paths: Polyline[],
  sourceBounds: DesignBounds,
  targetWidth: number,
  targetHeight: number,
): Polyline[] {
  const scaleX = targetWidth / Math.max(sourceBounds.width, EPSILON);
  const scaleY = targetHeight / Math.max(sourceBounds.height, EPSILON);
  const centerX = sourceBounds.minX + sourceBounds.width / 2;
  const centerY = sourceBounds.minY + sourceBounds.height / 2;
  return paths.map((path) => ({
    ...path,
    points: path.points.map((point) => ({
      x: (point.x - centerX) * scaleX,
      y: (point.y - centerY) * scaleY,
    })),
  }));
}
