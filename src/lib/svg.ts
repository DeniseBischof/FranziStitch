import { boundsOfPolylines } from "./geometry";
import type { ParsedVectorDesign, Point, Polyline, VectorShape } from "../types";

type Matrix = [number, number, number, number, number, number];
type StyleState = { fill: string; stroke: string; display: string; visibility: string; opacity: number };

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const GEOMETRY_TAGS = new Set(["path", "line", "polyline", "polygon", "rect", "circle", "ellipse"]);
const UNSUPPORTED_TAGS = ["image", "script", "use", "filter", "mask", "pattern", "foreignObject"];

function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function applyMatrix(point: Point, matrix: Matrix): Point {
  return {
    x: point.x * matrix[0] + point.y * matrix[2] + matrix[4],
    y: point.x * matrix[1] + point.y * matrix[3] + matrix[5],
  };
}

function numbers(value: string) {
  return (value.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
}

export function parseTransform(value: string | null): Matrix {
  if (!value) return IDENTITY;
  let result: Matrix = IDENTITY;
  const expression = /([a-z]+)\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(value))) {
    const args = numbers(match[2]);
    let next: Matrix = IDENTITY;
    switch (match[1].toLowerCase()) {
      case "matrix":
        if (args.length >= 6) next = args.slice(0, 6) as Matrix;
        break;
      case "translate":
        next = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
        break;
      case "scale":
        next = [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0];
        break;
      case "rotate": { // SVG transform functions are applied in their listed order.
        const radians = ((args[0] ?? 0) * Math.PI) / 180;
        const rotation: Matrix = [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
        if (args.length >= 3) {
          next = multiply(multiply([1, 0, 0, 1, args[1], args[2]], rotation), [1, 0, 0, 1, -args[1], -args[2]]);
        } else next = rotation;
        break;
      }
      case "skewx":
        next = [1, 0, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case "skewy":
        next = [1, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    result = multiply(result, next);
  }
  return result;
}

function parseStyle(element: Element, inherited: StyleState): StyleState {
  const inline = Object.fromEntries(
    (element.getAttribute("style") ?? "")
      .split(";")
      .map((part) => part.split(":").map((value) => value.trim()))
      .filter((entry) => entry.length === 2),
  );
  const value = (name: string, fallback: string) => element.getAttribute(name) ?? inline[name] ?? fallback;
  return {
    fill: value("fill", inherited.fill),
    stroke: value("stroke", inherited.stroke),
    display: value("display", inherited.display),
    visibility: value("visibility", inherited.visibility),
    opacity: Number(value("opacity", String(inherited.opacity))),
  };
}

function normalizeColor(color: string) {
  const value = color.trim().toLowerCase();
  if (value === "none" || value === "transparent" || value.startsWith("url(")) return "none";
  const probe = document.createElement("span");
  probe.style.color = value;
  document.body.appendChild(probe);
  const normalized = getComputedStyle(probe).color;
  probe.remove();
  const rgb = normalized.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
  if (!rgb || rgb.length < 3) return value || "#111111";
  return `#${rgb.map((part) => Math.round(part).toString(16).padStart(2, "0")).join("")}`;
}

function pointList(value: string | null): Point[] {
  const values = numbers(value ?? "");
  const result: Point[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) result.push({ x: values[index], y: values[index + 1] });
  return result;
}

function cubic(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt ** 3 * a.x + 3 * mt ** 2 * t * b.x + 3 * mt * t ** 2 * c.x + t ** 3 * d.x,
    y: mt ** 3 * a.y + 3 * mt ** 2 * t * b.y + 3 * mt * t ** 2 * c.y + t ** 3 * d.y,
  };
}

function quadratic(a: Point, b: Point, c: Point, t: number): Point {
  const mt = 1 - t;
  return { x: mt ** 2 * a.x + 2 * mt * t * b.x + t ** 2 * c.x, y: mt ** 2 * a.y + 2 * mt * t * b.y + t ** 2 * c.y };
}

function sampleArc(start: Point, rxInput: number, ryInput: number, rotation: number, largeArc: number, sweep: number, end: Point): Point[] {
  let rx = Math.abs(rxInput);
  let ry = Math.abs(ryInput);
  if (!rx || !ry || (start.x === end.x && start.y === end.y)) return [end];
  const phi = (rotation * Math.PI) / 180;
  const cosine = Math.cos(phi);
  const sine = Math.sin(phi);
  const dx = (start.x - end.x) / 2;
  const dy = (start.y - end.y) / 2;
  const x1 = cosine * dx + sine * dy;
  const y1 = -sine * dx + cosine * dy;
  const lambda = x1 ** 2 / rx ** 2 + y1 ** 2 / ry ** 2;
  if (lambda > 1) { const scale = Math.sqrt(lambda); rx *= scale; ry *= scale; }
  const numerator = Math.max(0, rx ** 2 * ry ** 2 - rx ** 2 * y1 ** 2 - ry ** 2 * x1 ** 2);
  const denominator = rx ** 2 * y1 ** 2 + ry ** 2 * x1 ** 2;
  const sign = largeArc === sweep ? -1 : 1;
  const coefficient = denominator ? sign * Math.sqrt(numerator / denominator) : 0;
  const cx1 = coefficient * (rx * y1) / ry;
  const cy1 = coefficient * (-ry * x1) / rx;
  const cx = cosine * cx1 - sine * cy1 + (start.x + end.x) / 2;
  const cy = sine * cx1 + cosine * cy1 + (start.y + end.y) / 2;
  const vectorAngle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot / Math.max(length, 1e-9))));
    return ux * vy - uy * vx < 0 ? -angle : angle;
  };
  const ux = (x1 - cx1) / rx;
  const uy = (y1 - cy1) / ry;
  const vx = (-x1 - cx1) / rx;
  const vy = (-y1 - cy1) / ry;
  let theta = vectorAngle(1, 0, ux, uy);
  let delta = vectorAngle(ux, uy, vx, vy);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;
  const steps = Math.max(6, Math.ceil(Math.abs(delta) / (Math.PI / 12)));
  return Array.from({ length: steps }, (_, index) => {
    theta += delta / steps;
    return { x: cx + cosine * rx * Math.cos(theta) - sine * ry * Math.sin(theta), y: cy + sine * rx * Math.cos(theta) + cosine * ry * Math.sin(theta) };
  });
}

export function parsePathData(data: string): Polyline[] {
  const tokens = data.match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? [];
  let index = 0;
  let command = "";
  let current: Point = { x: 0, y: 0 };
  let subpathStart: Point = { x: 0, y: 0 };
  let previousControl: Point | null = null;
  const paths: Polyline[] = [];
  let active: Polyline | null = null;
  const isCommand = (token: string) => /^[a-zA-Z]$/.test(token);
  const read = () => Number(tokens[index++]);
  const hasNumbers = () => index < tokens.length && !isCommand(tokens[index]);
  const ensurePath = () => { if (!active) { active = { points: [{ ...current }], closed: false }; paths.push(active); } return active; };
  const nextPoint = (relative: boolean): Point => { const x = read(); const y = read(); return relative ? { x: current.x + x, y: current.y + y } : { x, y }; };

  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++];
    if (!command) throw new Error("Ungültiger SVG-Pfad.");
    const relative = command === command.toLowerCase();
    const type = command.toUpperCase();
    if (type === "Z") {
      if (active) active.closed = true;
      current = { ...subpathStart };
      active = null;
      previousControl = null;
      command = "";
      continue;
    }
    if (!hasNumbers()) continue;
    if (type === "M") {
      current = nextPoint(relative);
      subpathStart = { ...current };
      active = { points: [{ ...current }], closed: false };
      paths.push(active);
      command = relative ? "l" : "L";
      previousControl = null;
      continue;
    }
    const path = ensurePath();
    if (type === "L") {
      current = nextPoint(relative); path.points.push({ ...current }); previousControl = null;
    } else if (type === "H") {
      const x = read(); current = { x: relative ? current.x + x : x, y: current.y }; path.points.push({ ...current }); previousControl = null;
    } else if (type === "V") {
      const y = read(); current = { x: current.x, y: relative ? current.y + y : y }; path.points.push({ ...current }); previousControl = null;
    } else if (type === "C") {
      const start = current; const c1 = nextPoint(relative); const c2 = nextPoint(relative); const end = nextPoint(relative);
      const length = Math.hypot(c1.x - start.x, c1.y - start.y) + Math.hypot(c2.x - c1.x, c2.y - c1.y) + Math.hypot(end.x - c2.x, end.y - c2.y);
      const steps = Math.max(6, Math.ceil(length / 8));
      for (let step = 1; step <= steps; step += 1) path.points.push(cubic(start, c1, c2, end, step / steps));
      current = end; previousControl = c2;
    } else if (type === "S") {
      const start = current; const c1 = previousControl ? { x: 2 * current.x - previousControl.x, y: 2 * current.y - previousControl.y } : current;
      const c2 = nextPoint(relative); const end = nextPoint(relative);
      for (let step = 1; step <= 12; step += 1) path.points.push(cubic(start, c1, c2, end, step / 12));
      current = end; previousControl = c2;
    } else if (type === "Q") {
      const start = current; const control = nextPoint(relative); const end = nextPoint(relative);
      for (let step = 1; step <= 12; step += 1) path.points.push(quadratic(start, control, end, step / 12));
      current = end; previousControl = control;
    } else if (type === "T") {
      const start = current; const control: Point = previousControl ? { x: 2 * current.x - previousControl.x, y: 2 * current.y - previousControl.y } : current; const end = nextPoint(relative);
      for (let step = 1; step <= 12; step += 1) path.points.push(quadratic(start, control, end, step / 12));
      current = end; previousControl = control;
    } else if (type === "A") {
      const rx = read(); const ry = read(); const rotation = read(); const largeArc = read(); const sweep = read(); const end = nextPoint(relative);
      path.points.push(...sampleArc(current, rx, ry, rotation, largeArc, sweep, end)); current = end; previousControl = null;
    } else throw new Error(`Nicht unterstützter Pfadbefehl: ${type}`);
  }
  return paths.filter((path) => path.points.length > 1);
}

function geometryPaths(element: Element): Polyline[] {
  const tag = element.tagName.toLowerCase();
  const n = (name: string, fallback = 0) => Number(element.getAttribute(name) ?? fallback);
  if (tag === "path") return parsePathData(element.getAttribute("d") ?? "");
  if (tag === "line") return [{ closed: false, points: [{ x: n("x1"), y: n("y1") }, { x: n("x2"), y: n("y2") }] }];
  if (tag === "polyline" || tag === "polygon") return [{ closed: tag === "polygon", points: pointList(element.getAttribute("points")) }];
  if (tag === "rect") {
    const x = n("x"); const y = n("y"); const width = n("width"); const height = n("height");
    return [{ closed: true, points: [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }] }];
  }
  if (tag === "circle" || tag === "ellipse") {
    const cx = n("cx"); const cy = n("cy"); const rx = tag === "circle" ? n("r") : n("rx"); const ry = tag === "circle" ? n("r") : n("ry");
    return [{ closed: true, points: Array.from({ length: 64 }, (_, i) => ({ x: cx + rx * Math.cos((i / 64) * Math.PI * 2), y: cy + ry * Math.sin((i / 64) * Math.PI * 2) })) }];
  }
  return [];
}

export function parseSvg(content: string): ParsedVectorDesign {
  const documentNode = new DOMParser().parseFromString(content, "image/svg+xml");
  if (documentNode.querySelector("parsererror") || documentNode.documentElement.tagName.toLowerCase() !== "svg") {
    throw new Error("Die SVG-Datei ist leer oder beschädigt.");
  }
  const root = documentNode.documentElement;
  const warnings: string[] = [];
  for (const tag of UNSUPPORTED_TAGS) {
    if (root.querySelector(tag)) warnings.push(`${tag}-Elemente werden aus Sicherheits- oder Qualitätsgründen ignoriert.`);
  }
  if (root.querySelector("[clip-path]")) warnings.push("Clipping-Pfade werden in Version 1 nicht ausgewertet.");
  const shapes: VectorShape[] = [];
  let shapeIndex = 0;
  const visit = (element: Element, parentMatrix: Matrix, inheritedStyle: StyleState) => {
    const matrix = multiply(parentMatrix, parseTransform(element.getAttribute("transform")));
    const style = parseStyle(element, inheritedStyle);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity <= 0) return;
    const tag = element.tagName.toLowerCase();
    if (GEOMETRY_TAGS.has(tag)) {
      try {
        const paths = geometryPaths(element).map((path) => ({ ...path, points: path.points.map((point) => applyMatrix(point, matrix)) }));
        if (paths.some((path) => path.points.length > 1)) {
          const fill = normalizeColor(style.fill);
          const stroke = normalizeColor(style.stroke);
          if (fill !== "none" && paths.some((path) => path.closed)) shapes.push({ id: `shape-${shapeIndex++}`, kind: "fill", color: fill, paths: paths.filter((path) => path.closed) });
          if (stroke !== "none") shapes.push({ id: `shape-${shapeIndex++}`, kind: "stroke", color: stroke, paths });
        }
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Eine Form konnte nicht gelesen werden.");
      }
    }
    for (const child of Array.from(element.children)) {
      if (!UNSUPPORTED_TAGS.includes(child.tagName.toLowerCase())) visit(child, matrix, style);
    }
  };
  visit(root, IDENTITY, { fill: "#111111", stroke: "none", display: "inline", visibility: "visible", opacity: 1 });
  if (!shapes.length) throw new Error("Keine unterstützten Vektorpfade gefunden. Eingebettete Bilder werden nicht umgewandelt.");
  return { shapes, bounds: boundsOfPolylines(shapes.flatMap((shape) => shape.paths)), warnings: [...new Set(warnings)] };
}
