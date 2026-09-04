import type { DesignNode, Project, RoutingMode } from "../types";

export interface Pt {
  x: number;
  y: number;
}

/** Stroke width of a drawn line (world units). */
export const LINE_WIDTH = 4;
/** Perpendicular distance between the centres of two parallel lines. */
export const SPACING = 8;
/** Corner rounding radius at line bends. */
export const CORNER_RADIUS = 16;
/** White casing width around each line so parallel lines read as separate. */
export const CASING_WIDTH = LINE_WIDTH + 3;

export interface LineGeom {
  /** full render polyline (includes octilinear bend points) */
  points: Pt[];
  /** rendered position of each stop (one entry per stop) */
  stopPoints: Pt[];
  /** index into `points` for each stop */
  stopIndex: number[];
}

interface Seg {
  p1: Pt;
  p2: Pt;
}

const segKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}
function len(v: Pt): number {
  return Math.hypot(v.x, v.y);
}
function midpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

const DEG = Math.PI / 180;
const SNAP_TOL = 12 * DEG;

/** Octilinear route A→B: straight if already near 0/45/90°, else one bend. */
function octiRoute(A: Pt, B: Pt): Pt[] {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < 1e-6 && ady < 1e-6) return [{ ...A }, { ...B }];

  const angle = Math.atan2(ady, adx); // 0..90°
  if (
    angle < SNAP_TOL ||
    angle > Math.PI / 2 - SNAP_TOL ||
    Math.abs(angle - Math.PI / 4) < SNAP_TOL
  ) {
    return [{ ...A }, { ...B }];
  }

  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  // diagonal segment first (from A), then an axis-aligned segment into B
  const bend: Pt =
    adx > ady
      ? { x: A.x + sx * ady, y: B.y }
      : { x: B.x, y: A.y + sy * adx };
  return [{ ...A }, bend, { ...B }];
}

/** Shift a polyline sideways by `off` (perpendicular), keeping vertex count. */
function offsetPolyline(pts: Pt[], off: number): Pt[] {
  if (pts.length < 2) return pts.map((p) => ({ ...p }));
  const segs: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    let dx = pts[i + 1].x - pts[i].x;
    let dy = pts[i + 1].y - pts[i].y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const ox = -dy * off;
    const oy = dx * off;
    segs.push({
      p1: { x: pts[i].x + ox, y: pts[i].y + oy },
      p2: { x: pts[i + 1].x + ox, y: pts[i + 1].y + oy },
    });
  }
  const out: Pt[] = [segs[0].p1];
  for (let i = 1; i < segs.length; i++) {
    out.push(intersect(segs[i - 1], segs[i]) ?? midpoint(segs[i - 1].p2, segs[i].p1));
  }
  out.push(segs[segs.length - 1].p2);
  return out;
}

/**
 * Slot order of the lines sharing edge a–b, chosen to reduce crossings: lines
 * are sorted by the direction their route continues at each end of the edge, so
 * a line that peels off to one side keeps to that side through the shared trunk.
 */
function orderLinesOnEdge(
  lineIds: string[],
  a: string,
  b: string,
  nodeById: Map<string, DesignNode>,
  stopsById: Map<string, string[]>
): string[] {
  const A = nodeById.get(a)!;
  const B = nodeById.get(b)!;
  let dx = B.x - A.x;
  let dy = B.y - A.y;
  const dl = Math.hypot(dx, dy) || 1;
  dx /= dl;
  dy /= dl;

  const signedAngle = (ux: number, uy: number): number => {
    const ul = Math.hypot(ux, uy);
    if (ul < 1e-9) return 0;
    ux /= ul;
    uy /= ul;
    return Math.atan2(dx * uy - dy * ux, dx * ux + dy * uy);
  };

  const key = (lineId: string): number => {
    const stops = stopsById.get(lineId)!;
    let ia = -1;
    let ib = -1;
    for (let i = 0; i < stops.length - 1; i++) {
      const p = stops[i];
      const q = stops[i + 1];
      if ((p === a && q === b) || (p === b && q === a)) {
        if (p === a) {
          ia = i;
          ib = i + 1;
        } else {
          ia = i + 1;
          ib = i;
        }
        break;
      }
    }
    if (ia < 0) return 0;
    const beforeA = ia < ib ? stops[ia - 1] : stops[ia + 1];
    const afterB = ia < ib ? stops[ib + 1] : stops[ib - 1];
    let k = 0;
    // which side each end of the line leans toward: `afterB` points onward from
    // B, `beforeA` points back from A toward where the line came from — both
    // measured the same way so a line entering from the north and one leaving to
    // the north land on the same side of the bundle.
    const P = beforeA ? nodeById.get(beforeA) : undefined;
    if (P) k += signedAngle(P.x - A.x, P.y - A.y);
    const C = afterB ? nodeById.get(afterB) : undefined;
    if (C) k += signedAngle(C.x - B.x, C.y - B.y);
    return k;
  };

  return [...lineIds]
    .map((id) => ({ id, k: key(id) }))
    .sort((p, q) => p.k - q.k || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))
    .map((x) => x.id);
}

/**
 * One render polyline per line. Lines sharing a segment run in evenly spaced
 * parallel slots; with routing "octilinear" each edge is bent to 0/45/90°.
 */
export function computeLineGeometry(project: Project): Map<string, LineGeom> {
  const nodeById = new Map(project.nodes.map((n) => [n.id, n] as const));
  const stopsById = new Map(project.lines.map((l) => [l.id, l.stops] as const));
  const routing: RoutingMode = project.routing ?? "direct";

  const edgeLines = new Map<string, string[]>();
  for (const line of project.lines) {
    for (let i = 0; i < line.stops.length - 1; i++) {
      const a = line.stops[i];
      const b = line.stops[i + 1];
      if (a === b || !nodeById.has(a) || !nodeById.has(b)) continue;
      const k = segKey(a, b);
      let arr = edgeLines.get(k);
      if (!arr) {
        arr = [];
        edgeLines.set(k, arr);
      }
      if (!arr.includes(line.id)) arr.push(line.id);
    }
  }

  interface Edge {
    a: string;
    route: Pt[];
    order: string[];
  }
  const edges = new Map<string, Edge>();
  for (const [k, lineIds] of edgeLines) {
    const [a, b] = k.split("|");
    const A = nodeById.get(a)!;
    const B = nodeById.get(b)!;
    const route =
      routing === "octilinear"
        ? octiRoute(A, B)
        : [
            { x: A.x, y: A.y },
            { x: B.x, y: B.y },
          ];
    edges.set(k, {
      a,
      route,
      order: orderLinesOnEdge(lineIds, a, b, nodeById, stopsById),
    });
  }

  const result = new Map<string, LineGeom>();

  for (const line of project.lines) {
    const resolved = line.stops.map((id) => nodeById.get(id));
    if (line.stops.length < 2 || resolved.some((n) => !n)) {
      const pts = resolved
        .filter((n): n is DesignNode => !!n)
        .map((n) => ({ x: n.x, y: n.y }));
      result.set(line.id, {
        points: pts,
        stopPoints: pts.map((p) => ({ ...p })),
        stopIndex: pts.map((_, i) => i),
      });
      continue;
    }

    const stopNodes = resolved as DesignNode[];
    /** manual platform position for a stop, or null */
    const ovr = (si: number): Pt | null => {
      const o = line.stopOverrides?.[si];
      if (!o) return null;
      const nd = stopNodes[si];
      return { x: nd.x + o.dx, y: nd.y + o.dy };
    };

    // offset route per edge, oriented so index 0 sits at stops[i]
    const edgeRoutes: Pt[][] = [];
    const edgeCounts: number[] = [];
    for (let i = 0; i < line.stops.length - 1; i++) {
      const a = line.stops[i];
      const b = line.stops[i + 1];
      const edge = edges.get(segKey(a, b))!;
      const count = edge.order.length;
      const slot = edge.order.indexOf(line.id);
      const off = (slot - (count - 1) / 2) * SPACING;
      let r = offsetPolyline(edge.route, off);
      if (edge.a !== a) r = r.reverse();
      edgeRoutes.push(r);
      edgeCounts.push(count);
    }

    const first = ovr(0) ?? { ...edgeRoutes[0][0] };
    if (ovr(0)) edgeRoutes[0][0] = { ...first };
    const points: Pt[] = [{ ...first }];
    const stopIndex: number[] = [0];
    const stopPoints: Pt[] = [{ ...first }];

    for (let e = 0; e < edgeRoutes.length; e++) {
      const r = edgeRoutes[e];
      for (let j = 1; j < r.length - 1; j++) points.push(r[j]);

      if (e < edgeRoutes.length - 1) {
        const si = e + 1;
        const rn = edgeRoutes[e + 1];
        const cIn = edgeCounts[e];
        const cOut = edgeCounts[e + 1];
        let v = ovr(si);
        if (!v) {
          if (cIn !== cOut) {
            // the bundle width changes at this stop: pin the line to the slot of
            // the *bigger* bundle (that side is the most constrained) and let the
            // thinner edge absorb the lateral difference along its length.
            v = cIn > cOut ? { ...r[r.length - 1] } : { ...rn[0] };
          } else {
            v =
              intersect(
                { p1: r[r.length - 2], p2: r[r.length - 1] },
                { p1: rn[0], p2: rn[1] }
              ) ?? midpoint(r[r.length - 1], rn[0]);
          }
        }
        points.push(v);
        stopIndex.push(points.length - 1);
        stopPoints.push(v);
        edgeRoutes[e + 1] = [v, ...rn.slice(1)];
      } else {
        const last = ovr(e + 1) ?? { ...r[r.length - 1] };
        points.push(last);
        stopIndex.push(points.length - 1);
        stopPoints.push(last);
      }
    }

    result.set(line.id, { points, stopPoints, stopIndex });
  }

  return result;
}

/** Infinite-line intersection of two segments; null / clamped on degeneracy. */
function intersect(s1: Seg, s2: Seg): Pt | null {
  const { x: x1, y: y1 } = s1.p1;
  const { x: x2, y: y2 } = s1.p2;
  const { x: x3, y: y3 } = s2.p1;
  const { x: x4, y: y4 } = s2.p2;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-6) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const p = { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  if (len(sub(p, s1.p2)) > SPACING * 14) return midpoint(s1.p2, s2.p1);
  return p;
}

/** SVG path string through the points, with rounded corners at each bend. */
export function roundedPath(input: Pt[], radius = CORNER_RADIUS): string {
  const p = dedupe(input);
  if (p.length === 0) return "";
  if (p.length === 1) return `M ${f(p[0].x)} ${f(p[0].y)}`;
  if (p.length === 2)
    return `M ${f(p[0].x)} ${f(p[0].y)} L ${f(p[1].x)} ${f(p[1].y)}`;

  let d = `M ${f(p[0].x)} ${f(p[0].y)}`;
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1];
    const c = p[i];
    const b = p[i + 1];
    const v1 = sub(a, c);
    const v2 = sub(b, c);
    const l1 = len(v1) || 1;
    const l2 = len(v2) || 1;
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const e1 = { x: c.x + (v1.x / l1) * r, y: c.y + (v1.y / l1) * r };
    const e2 = { x: c.x + (v2.x / l2) * r, y: c.y + (v2.y / l2) * r };
    d += ` L ${f(e1.x)} ${f(e1.y)} Q ${f(c.x)} ${f(c.y)} ${f(e2.x)} ${f(e2.y)}`;
  }
  const last = p[p.length - 1];
  d += ` L ${f(last.x)} ${f(last.y)}`;
  return d;
}

export interface Station {
  /** centre of the marker */
  x: number;
  y: number;
  /** rotation of the marker (radians) — long axis runs across the tracks */
  angle: number;
  /** half-extent across the tracks (long axis) */
  halfLen: number;
  /** half-extent along the tracks (short axis); grows when lines fan out */
  halfWid: number;
  interchange: boolean;
}

/** A station tick/bar per node, spanning whatever lines pass through it. */
export function computeStations(
  project: Project,
  geometry: Map<string, LineGeom>
): Station[] {
  const out: Station[] = [];

  for (const node of project.nodes) {
    if (node.kind === "via") continue; // waypoints get no station marker

    const hits: Pt[] = [];
    const dirs: Pt[] = [];

    for (const line of project.lines) {
      const geom = geometry.get(line.id);
      if (!geom || geom.points.length < 2) continue;
      line.stops.forEach((sid, si) => {
        if (sid !== node.id) return;
        const pIdx = geom.stopIndex[si];
        if (pIdx == null) return;
        const p = geom.points[pIdx];
        if (!p) return;
        hits.push(p);
        const before = geom.points[pIdx - 1];
        const after = geom.points[pIdx + 1];
        // track direction at this stop; at a terminus use the single edge
        let d: Pt | null = null;
        if (before && after) d = sub(after, before);
        else if (after) d = sub(after, p);
        else if (before) d = sub(p, before);
        if (d) {
          const dl = len(d) || 1;
          dirs.push({ x: d.x / dl, y: d.y / dl });
        }
      });
    }

    if (hits.length === 0) continue;

    let ax = 0;
    let ay = 0;
    for (const d of dirs) {
      if (ax * d.x + ay * d.y < 0) {
        ax -= d.x;
        ay -= d.y;
      } else {
        ax += d.x;
        ay += d.y;
      }
    }
    let al = Math.hypot(ax, ay);
    if (al < 1e-6) {
      ax = 1;
      ay = 0;
      al = 1;
    }
    ax /= al;
    ay /= al;
    const perp = { x: -ay, y: ax };

    // spread of the connection points across the tracks (perp) and along them
    let mn = 0;
    let mx = 0;
    let mnA = 0;
    let mxA = 0;
    for (const h of hits) {
      const rx = h.x - node.x;
      const ry = h.y - node.y;
      const pr = rx * perp.x + ry * perp.y;
      const al2 = rx * ax + ry * ay;
      mn = Math.min(mn, pr);
      mx = Math.max(mx, pr);
      mnA = Math.min(mnA, al2);
      mxA = Math.max(mxA, al2);
    }
    const m = LINE_WIDTH;

    out.push({
      x:
        node.x +
        (perp.x * (mn + mx)) / 2 +
        (ax * (mnA + mxA)) / 2,
      y:
        node.y +
        (perp.y * (mn + mx)) / 2 +
        (ay * (mnA + mxA)) / 2,
      angle: Math.atan2(perp.y, perp.x),
      halfLen: Math.max((mx - mn) / 2 + m, LINE_WIDTH * 1.3),
      halfWid: Math.max((mxA - mnA) / 2 + m, LINE_WIDTH * 0.7),
      interchange: hits.length >= 2,
    });
  }

  return out;
}

function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(prev.x - p.x, prev.y - p.y) > 0.01) out.push(p);
  }
  return out;
}

const f = (n: number) => Math.round(n * 100) / 100;
