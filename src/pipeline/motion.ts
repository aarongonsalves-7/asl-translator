/**
 * Motion letters: J and Z are the only two signs in the alphabet that are defined by movement
 * rather than a still handshape, so a single frame can never identify them. This module takes
 * the path the fingertip actually drew and compares it against J and Z prototypes.
 *
 * Paths are recorded in image space, offset from where the trace began and scaled by the palm
 * length — that makes the match independent of how big the hand is and where it is on screen,
 * while keeping the motion (which is the whole signal) intact.
 */
import type { Vec3 } from '../vision/landmarks';

/** A path point in image-normalised-ish units: x right, y down, one unit = one palm length. */
export interface PathPoint {
  x: number;
  y: number;
}

const RESAMPLE_POINTS = 16;
/** Total path length (palm lengths) below which nothing was really drawn. */
const MIN_PATH_LENGTH = 0.75;
/** Normalised mean point distance to accept a match. */
const MAX_MATCH_DISTANCE = 0.19;

/**
 * Prototypes in image coordinates (y grows downward, so "down" is positive y). These describe
 * the shape a signer draws in front of themselves, which is what a front-facing camera sees.
 */
export const TRACE_TEMPLATES: Record<'j' | 'z', PathPoint[]> = {
  // Start at the top, draw down, then hook around toward the thumb side and back up.
  j: [
    { x: 0, y: 0 },
    { x: -0.04, y: 0.55 },
    { x: -0.12, y: 1.1 },
    { x: -0.45, y: 1.4 },
    { x: -0.75, y: 1.25 },
    { x: -0.85, y: 1.0 },
  ],
  // Across, back diagonally, across again.
  z: [
    { x: 0, y: 0 },
    { x: 0.5, y: 0 },
    { x: 0.85, y: 0 },
    { x: 0.3, y: 0.5 },
    { x: -0.2, y: 0.95 },
    { x: 0.3, y: 1.0 },
    { x: 0.85, y: 1.0 },
  ],
};

function pathLength(path: PathPoint[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  }
  return total;
}

/** Resample by arc length so two paths of different point counts can be compared. */
export function resample(path: PathPoint[], count = RESAMPLE_POINTS): PathPoint[] {
  if (path.length === 0) return [];
  if (path.length === 1) return Array.from({ length: count }, () => ({ ...path[0]! }));

  const total = pathLength(path);
  if (total === 0) return Array.from({ length: count }, () => ({ ...path[0]! }));

  const step = total / (count - 1);
  const out: PathPoint[] = [{ ...path[0]! }];
  let cursor = 1;
  let carried = 0;
  let prev = path[0]!;

  while (out.length < count && cursor < path.length) {
    const next = path[cursor]!;
    const segment = Math.hypot(next.x - prev.x, next.y - prev.y);
    if (segment === 0) {
      cursor++;
      continue;
    }
    const remaining = step - carried;
    if (segment >= remaining) {
      const t = remaining / segment;
      const point = { x: prev.x + (next.x - prev.x) * t, y: prev.y + (next.y - prev.y) * t };
      out.push(point);
      prev = point;
      carried = 0;
      // Re-walk the same segment for the next sample.
      path = path.slice(0, cursor).concat([point], path.slice(cursor));
      cursor++;
    } else {
      carried += segment;
      prev = next;
      cursor++;
    }
  }
  while (out.length < count) out.push({ ...path[path.length - 1]! });
  return out;
}

/** Centre on the centroid and scale to unit RMS radius, so only shape is compared. */
export function normalizePath(path: PathPoint[]): PathPoint[] {
  if (path.length === 0) return [];
  const cx = path.reduce((s, p) => s + p.x, 0) / path.length;
  const cy = path.reduce((s, p) => s + p.y, 0) / path.length;
  const centred = path.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  const rms = Math.sqrt(centred.reduce((s, p) => s + p.x * p.x + p.y * p.y, 0) / centred.length) || 1;
  return centred.map((p) => ({ x: p.x / rms, y: p.y / rms }));
}

function meanDistance(a: PathPoint[], b: PathPoint[]): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    total += Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y);
  }
  return total / a.length;
}

export interface TraceMatch {
  letter: 'J' | 'Z';
  distance: number;
  /** Normalised path shape, handy for drawing the trace in the UI. */
  normalized: PathPoint[];
}

/**
 * Match a recorded trace against the J and Z prototypes. Both a mirrored and an unmirrored
 * version are tried so left-handed signing (and a hand rotated the other way) still matches.
 */
export function matchTrace(path: PathPoint[]): TraceMatch | null {
  if (path.length < 3) return null;
  if (pathLength(path) < MIN_PATH_LENGTH) return null;

  const observed = normalizePath(resample(path));
  const mirrored = observed.map((p) => ({ x: -p.x, y: p.y }));

  let best: TraceMatch | null = null;
  for (const letter of ['J', 'Z'] as const) {
    const template = normalizePath(resample(TRACE_TEMPLATES[letter.toLowerCase() as 'j' | 'z']));
    const distance = Math.min(
      meanDistance(observed, template),
      meanDistance(mirrored, template),
    );
    if (distance <= MAX_MATCH_DISTANCE && (!best || distance < best.distance)) {
      best = { letter, distance, normalized: observed };
    }
  }
  return best;
}

/** Samples the path in the canonical frame into the image-space trace the matcher expects. */
export function tracePointFromTip(tip: Vec3, origin: Vec3, scale: number): PathPoint {
  const s = scale || 1e-6;
  return { x: (tip.x - origin.x) / s, y: (tip.y - origin.y) / s };
}

export const MOTION_GATE = {
  /** The J gate is the I handshape; Z starts from a pointing index. */
  j: 'I',
  z: 'Z',
} as const;

export { MAX_MATCH_DISTANCE, MIN_PATH_LENGTH, RESAMPLE_POINTS };
