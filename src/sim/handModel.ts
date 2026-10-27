/**
 * A forward-kinematics hand model: bone lengths + per-joint curl angles -> 21 landmarks.
 *
 * Two jobs:
 *   1. Demo mode — a signing hand with no camera attached.
 *   2. Test fixtures — deterministic landmarks so the classifier, smoothing and commit
 *      logic can be exercised without a webcam.
 *
 * It is a *fixture generator, not ground truth*. Letters are described here anatomically
 * (joint angles), and the landmarks it produces go through the real canonicalisation ->
 * features -> rules path, so a bug anywhere in that chain still shows up. It cannot prove
 * real-world accuracy on a real hand: only the practice page on your own camera can do that.
 */
import { type FingerName, type HandFrame, type Vec3, LM } from '../vision/landmarks';

const DEG = Math.PI / 180;

export type Curl = readonly [number, number, number];

export interface HandShape {
  index: Curl;
  middle: Curl;
  ring: Curl;
  pinky: Curl;
  /**
   * Signed fan angle in degrees: positive rotates the finger toward the thumb (-x) side of
   * the palm, negative toward the pinky (+x) side. A V is index +18 / middle -18.
   */
  spread?: Partial<Record<FingerName, number>>;
  /** Longitudinal offset added toward the pinky (+) / thumb (-) side, for R. */
  cross?: { index: number; middle: number };
  thumb: { abductDeg: number; flexDeg: number; tipCurlDeg: number };
  /** Image-plane rotation of the whole hand, degrees. */
  rollDeg?: number;
}

const EXTENDED: Curl = [4, 6, 5];
const SLIGHT: Curl = [6, 10, 8];
const CURVED: Curl = [30, 36, 32];
const ROUNDED: Curl = [42, 52, 46];
const CURLED: Curl = [55, 80, 66];
const TIGHT: Curl = [68, 88, 74];
const HOOKED: Curl = [16, 44, 58];

const MCP: Record<FingerName, Vec3> = {
  index: { x: -0.22, y: 0.97, z: 0.01 },
  middle: { x: 0, y: 1.0, z: 0 },
  ring: { x: 0.2, y: 0.97, z: 0.01 },
  pinky: { x: 0.38, y: 0.9, z: 0.02 },
};

const BONES: Record<FingerName, readonly [number, number, number]> = {
  index: [0.44, 0.28, 0.2],
  middle: [0.46, 0.3, 0.21],
  ring: [0.42, 0.27, 0.19],
  pinky: [0.34, 0.22, 0.17],
};

const THUMB_CMC: Vec3 = { x: -0.28, y: 0.55, z: 0.08 };
const THUMB_BONES = [0.34, 0.28, 0.24] as const;

/** Rotate around the x axis, curling toward +z (the palm side). */
function rotX(v: Vec3, deg: number): Vec3 {
  const t = deg * DEG;
  return { x: v.x, y: v.y * Math.cos(t) - v.z * Math.sin(t), z: v.y * Math.sin(t) + v.z * Math.cos(t) };
}

/** Fan a finger within the palm plane. */
function rotZ(v: Vec3, deg: number): Vec3 {
  const t = deg * DEG;
  return { x: v.x * Math.cos(t) - v.y * Math.sin(t), y: v.x * Math.sin(t) + v.y * Math.cos(t), z: v.z };
}

function buildFinger(name: FingerName, curl: Curl, spreadDeg: number, crossOffset = 0): Vec3[] {
  const mcp = MCP[name];
  const bones = BONES[name];
  const points: Vec3[] = [mcp];

  let cursor = mcp;
  let acc = 0;
  for (let i = 0; i < 3; i++) {
    acc += curl[i]!;
    const dir = rotZ(rotX({ x: 0, y: 1, z: 0 }, acc), spreadDeg);
    const step = bones[i]!;
    cursor = {
      x: cursor.x + dir.x * step + crossOffset * step,
      y: cursor.y + dir.y * step,
      z: cursor.z + dir.z * step,
    };
    points.push(cursor);
  }
  return points;
}

function buildThumb(shape: HandShape['thumb']): Vec3[] {
  const a = shape.abductDeg * DEG;
  const f = shape.flexDeg * DEG;
  const base = { x: -Math.sin(a), y: Math.cos(a) * Math.cos(f), z: Math.cos(a) * Math.sin(f) };
  const tipDir = rotX(base, shape.tipCurlDeg);
  const dirs = [base, tipDir, rotX(tipDir, shape.tipCurlDeg * 0.6)];

  const points: Vec3[] = [THUMB_CMC];
  let cursor = THUMB_CMC;
  for (let i = 0; i < 3; i++) {
    const d = dirs[i]!;
    cursor = {
      x: cursor.x + d.x * THUMB_BONES[i]!,
      y: cursor.y + d.y * THUMB_BONES[i]!,
      z: cursor.z + d.z * THUMB_BONES[i]!,
    };
    points.push(cursor);
  }
  return points;
}

/** 21 landmarks in palm-length units: right hand, palm normal +z, fingers up +y. */
export function buildLocalHand(shape: HandShape): Vec3[] {
  const pts: Vec3[] = new Array(21);
  pts[LM.WRIST] = { x: 0, y: 0, z: 0 };

  const thumb = buildThumb(shape.thumb);
  pts[LM.THUMB_CMC] = thumb[0]!;
  pts[LM.THUMB_MCP] = thumb[1]!;
  pts[LM.THUMB_IP] = thumb[2]!;
  pts[LM.THUMB_TIP] = thumb[3]!;

  const layout: Array<[FingerName, Curl, readonly number[], number]> = [
    ['index', shape.index, [LM.INDEX_MCP, LM.INDEX_PIP, LM.INDEX_DIP, LM.INDEX_TIP], shape.spread?.index ?? 0],
    ['middle', shape.middle, [LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_DIP, LM.MIDDLE_TIP], shape.spread?.middle ?? 0],
    ['ring', shape.ring, [LM.RING_MCP, LM.RING_PIP, LM.RING_DIP, LM.RING_TIP], shape.spread?.ring ?? 0],
    ['pinky', shape.pinky, [LM.PINKY_MCP, LM.PINKY_PIP, LM.PINKY_DIP, LM.PINKY_TIP], shape.spread?.pinky ?? 0],
  ];

  for (const [name, curl, indices, spread] of layout) {
    const crossOffset = name === 'index' ? (shape.cross?.index ?? 0) : name === 'middle' ? (shape.cross?.middle ?? 0) : 0;
    const chain = buildFinger(name, curl, spread, crossOffset);
    indices.forEach((idx, i) => {
      pts[idx] = chain[i]!;
    });
  }
  return pts;
}

export interface PoseOptions {
  /** Image heights per palm length. */
  scale?: number;
  cx?: number;
  cy?: number;
  /** In-image rotation, degrees. */
  rollDeg?: number;
  /** Out-of-plane tilt so the palm is not perfectly facing the camera. */
  yawDeg?: number;
  pitchDeg?: number;
  aspect?: number;
  handedness?: 'left' | 'right';
  /** Gaussian landmark noise in normalised image units. */
  jitter?: number;
  seed?: number;
  timestampMs?: number;
  frameId?: number;
}

/** Deterministic PRNG so fixtures are reproducible. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x2f6e2b1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

export function projectHand(local: Vec3[], options: PoseOptions = {}): HandFrame {
  const aspect = options.aspect ?? 4 / 3;
  // 0.26 keeps a fully extended hand inside the frame: fingers reach ~1.9 palm lengths up
  // from the wrist, so a larger scale would push the fingertips off the top edge.
  const scale = options.scale ?? 0.26;
  const cx = options.cx ?? aspect / 2;
  const cy = options.cy ?? 0.56;
  const roll = (options.rollDeg ?? 0) * DEG;
  const yaw = (options.yawDeg ?? 0) * DEG;
  const pitch = (options.pitchDeg ?? 0) * DEG;
  const handedness = options.handedness ?? 'right';
  const mirror = handedness === 'left' ? -1 : 1;
  const random = makeRandom(options.seed ?? 7);
  const jitter = options.jitter ?? 0;

  // Tilt the hand in 3D, then project orthographically (a webcam sits far enough away
  // that perspective barely changes landmark geometry).
  const landmarks: Vec3[] = local.map((p) => {
    let { x, y, z } = { x: p.x * mirror, y: p.y, z: p.z };
    // yaw around the palm's long axis (turns the palm away from the camera)
    const x2 = x * Math.cos(yaw) + z * Math.sin(yaw);
    const z2 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    x = x2;
    z = z2;
    // pitch (tips the fingers toward/away from the camera)
    const y3 = y * Math.cos(pitch) - z * Math.sin(pitch);
    const z3 = y * Math.sin(pitch) + z * Math.cos(pitch);
    y = y3;
    z = z3;

    let ix = cx + scale * x;
    let iy = cy - scale * y;
    // image-plane roll
    const dx = ix - cx;
    const dy = iy - cy;
    ix = cx + dx * Math.cos(roll) - dy * Math.sin(roll);
    iy = cy + dx * Math.sin(roll) + dy * Math.cos(roll);

    const noise = () => (random() - 0.5) * 2 * jitter;
    return { x: ix / aspect + noise(), y: iy + noise(), z: (z * scale) / 2 + noise() };
  });

  return {
    landmarks,
    handedness,
    handednessScore: 0.97,
    timestampMs: options.timestampMs ?? 0,
    frameId: options.frameId ?? 0,
  };
}

const T: Record<string, HandShape> = {
  A: { index: CURLED, middle: CURLED, ring: CURLED, pinky: CURLED, thumb: { abductDeg: 22, flexDeg: 8, tipCurlDeg: 5 } },
  B: { index: SLIGHT, middle: SLIGHT, ring: SLIGHT, pinky: SLIGHT, spread: { index: 6, middle: 0, ring: 0, pinky: -6 }, thumb: { abductDeg: -18, flexDeg: 46, tipCurlDeg: 18 } },
  C: { index: CURVED, middle: CURVED, ring: CURVED, pinky: CURVED, thumb: { abductDeg: 16, flexDeg: 32, tipCurlDeg: 26 } },
  D: { index: EXTENDED, middle: [45, 65, 55], ring: CURLED, pinky: CURLED, thumb: { abductDeg: -2, flexDeg: 22, tipCurlDeg: 38 } },
  E: { index: [50, 72, 58], middle: [50, 72, 58], ring: [50, 72, 58], pinky: [50, 72, 58], thumb: { abductDeg: 0, flexDeg: 60, tipCurlDeg: 42 } },
  F: { index: [28, 34, 30], middle: EXTENDED, ring: EXTENDED, pinky: EXTENDED, spread: { index: 2, middle: -8, ring: -4, pinky: -12 }, thumb: { abductDeg: 4, flexDeg: 30, tipCurlDeg: 34 } },
  G: { index: EXTENDED, middle: CURLED, ring: CURLED, pinky: CURLED, thumb: { abductDeg: 30, flexDeg: 6, tipCurlDeg: 4 }, rollDeg: -90 },
  H: { index: EXTENDED, middle: EXTENDED, ring: CURLED, pinky: CURLED, spread: { index: 2, middle: -2 }, thumb: { abductDeg: 26, flexDeg: 8, tipCurlDeg: 5 }, rollDeg: -90 },
  // H is signed with the palm facing the body (edge-on to a front camera).
  I: { index: CURLED, middle: CURLED, ring: CURLED, pinky: EXTENDED, thumb: { abductDeg: -8, flexDeg: 40, tipCurlDeg: 24 } },
  J: { index: CURLED, middle: CURLED, ring: CURLED, pinky: EXTENDED, thumb: { abductDeg: -8, flexDeg: 40, tipCurlDeg: 24 } },
  K: { index: EXTENDED, middle: EXTENDED, ring: CURLED, pinky: CURLED, spread: { index: 16, middle: -16 }, thumb: { abductDeg: -6, flexDeg: 20, tipCurlDeg: 25 } },
  L: { index: EXTENDED, middle: CURLED, ring: CURLED, pinky: CURLED, thumb: { abductDeg: 58, flexDeg: 2, tipCurlDeg: 2 } },
  M: { index: [50, 78, 62], middle: [52, 80, 64], ring: [54, 82, 66], pinky: [58, 84, 68], thumb: { abductDeg: -40, flexDeg: 70, tipCurlDeg: 30 } },
  N: { index: [50, 78, 62], middle: [52, 80, 64], ring: [46, 72, 58], pinky: [52, 78, 64], thumb: { abductDeg: -18, flexDeg: 70, tipCurlDeg: 34 } },
  // O: the thumb tip comes up to meet the index/middle tips; the ring and pinky follow.
  O: { index: ROUNDED, middle: ROUNDED, ring: ROUNDED, pinky: ROUNDED, thumb: { abductDeg: 8, flexDeg: 20, tipCurlDeg: 30 } },
  P: { index: EXTENDED, middle: EXTENDED, ring: CURLED, pinky: CURLED, spread: { index: 16, middle: -16 }, thumb: { abductDeg: -6, flexDeg: 34, tipCurlDeg: 30 }, rollDeg: 180 },
  Q: { index: EXTENDED, middle: CURLED, ring: CURLED, pinky: CURLED, thumb: { abductDeg: 30, flexDeg: 6, tipCurlDeg: 4 }, rollDeg: 180 },
  R: { index: EXTENDED, middle: EXTENDED, ring: CURLED, pinky: CURLED, cross: { index: 0.45, middle: -0.02 }, thumb: { abductDeg: -2, flexDeg: 36, tipCurlDeg: 28 } },
  S: { index: TIGHT, middle: TIGHT, ring: TIGHT, pinky: TIGHT, thumb: { abductDeg: -14, flexDeg: 52, tipCurlDeg: 40 } },
  T: { index: [52, 80, 64], middle: [54, 82, 66], ring: CURLED, pinky: CURLED, thumb: { abductDeg: -4, flexDeg: 45, tipCurlDeg: 20 } },
  U: { index: EXTENDED, middle: EXTENDED, ring: CURLED, pinky: CURLED, spread: { index: 2, middle: -2 }, thumb: { abductDeg: -10, flexDeg: 42, tipCurlDeg: 30 } },
  V: { index: EXTENDED, middle: EXTENDED, ring: CURLED, pinky: CURLED, spread: { index: 18, middle: -18 }, thumb: { abductDeg: -10, flexDeg: 42, tipCurlDeg: 30 } },
  W: { index: EXTENDED, middle: EXTENDED, ring: EXTENDED, pinky: CURLED, spread: { index: 16, middle: 0, ring: -16 }, thumb: { abductDeg: -12, flexDeg: 40, tipCurlDeg: 30 } },
  X: { index: HOOKED, middle: CURLED, ring: CURLED, pinky: CURLED, thumb: { abductDeg: -6, flexDeg: 48, tipCurlDeg: 36 } },
  Y: { index: CURLED, middle: CURLED, ring: CURLED, pinky: EXTENDED, thumb: { abductDeg: 56, flexDeg: 2, tipCurlDeg: 2 } },
  Z: { index: EXTENDED, middle: CURLED, ring: CURLED, pinky: CURLED, thumb: { abductDeg: -8, flexDeg: 55, tipCurlDeg: 30 } },
};

export function shapeFor(letter: string): HandShape {
  const shape = T[letter.toUpperCase()];
  if (!shape) throw new Error(`No synthetic hand shape defined for "${letter}"`);
  return shape;
}

export function simulateLetter(letter: string, options: PoseOptions = {}): HandFrame {
  const shape = shapeFor(letter);
  const rollDeg = shape.rollDeg ?? 0;
  // Pointing down (P, Q) rotates the hand about the wrist, which would push the fingertips off
  // the bottom edge of the frame. A real signer simply holds their hand higher, so the fixture
  // does the same rather than being reported as "part of your hand is outside the frame".
  const cy = options.cy ?? (Math.abs(rollDeg) > 90 ? 0.4 : undefined);
  return projectHand(buildLocalHand(shape), {
    ...options,
    rollDeg,
    ...(cy !== undefined ? { cy } : {}),
  });
}

/** Prototype traces for the motion letters, in palm lengths, origin at the trace start. */
export const TRACE_PATHS: Record<'j' | 'z', Vec3[]> = {
  // Down, then hook back up toward the thumb side.
  j: [
    { x: 0, y: 0, z: 0 },
    { x: -0.04, y: -0.55, z: 0 },
    { x: -0.12, y: -1.1, z: 0 },
    { x: -0.45, y: -1.4, z: 0 },
    { x: -0.75, y: -1.25, z: 0 },
    { x: -0.85, y: -1.0, z: 0 },
  ],
  // Across, back diagonally, across again.
  z: [
    { x: 0, y: 0, z: 0 },
    { x: 0.5, y: 0, z: 0 },
    { x: 0.85, y: 0, z: 0 },
    { x: 0.3, y: -0.5, z: 0 },
    { x: -0.2, y: -0.95, z: 0 },
    { x: 0.3, y: -1.0, z: 0 },
    { x: 0.85, y: -1.0, z: 0 },
  ],
};

/**
 * A sequence of frames for a letter: `holdFrames` steady frames, optionally preceded by a
 * trace for J/Z so the motion matcher can see the path.
 */
export function simulateSequence(
  letter: string,
  options: PoseOptions & { holdFrames?: number; traceFrames?: number } = {},
): HandFrame[] {
  const letterUpper = letter.toUpperCase();
  const shape = shapeFor(letterUpper);
  const holdFrames = options.holdFrames ?? 12;
  const traceFrames = options.traceFrames ?? 0;
  const frames: HandFrame[] = [];
  const aspect = options.aspect ?? 4 / 3;
  const baseScale = options.scale ?? 0.26;
  const baseCx = options.cx ?? aspect / 2;
  const baseCy = options.cy ?? 0.56;

  if (traceFrames > 0) {
    const kind = letterUpper === 'J' ? 'j' : 'z';
    const path = TRACE_PATHS[kind];
    for (let i = 0; i < traceFrames; i++) {
      const t = (i / (traceFrames - 1)) * (path.length - 1);
      const i0 = Math.min(Math.floor(t), path.length - 2);
      const frac = t - i0;
      const a = path[i0]!;
      const b = path[i0 + 1]!;
      const offset = {
        x: a.x + (b.x - a.x) * frac,
        y: a.y + (b.y - a.y) * frac,
      };
      frames.push(
        projectHand(buildLocalHand(shape), {
          rollDeg: shape.rollDeg ?? 0,
          ...options,
          cx: baseCx + offset.x * baseScale,
          cy: baseCy - offset.y * baseScale,
          timestampMs: i * 33,
          frameId: i,
        }),
      );
    }
  }

  const start = frames.length;
  for (let i = 0; i < holdFrames; i++) {
    frames.push(
      projectHand(buildLocalHand(shape), {
        rollDeg: shape.rollDeg ?? 0,
        ...options,
        cx: baseCx,
        cy: baseCy,
        timestampMs: (start + i) * 33,
        frameId: start + i,
      }),
    );
  }
  return frames;
}
