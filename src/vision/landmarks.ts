/**
 * Hand geometry primitives.
 *
 * Everything downstream of this file works in a *canonical palm frame*: the wrist is the
 * origin, one unit is the palm length (wrist -> middle MCP), and the palm plane is the
 * XY plane. That makes every feature invariant to where the hand is, how big it is, how
 * far it is rotated in the image, and which hand the user is signing with — which is what
 * lets one set of letter rules serve every user and every camera distance.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec = {
  sub: (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  add: (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  scale: (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  dot: (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z,
  cross: (a: Vec3, b: Vec3): Vec3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }),
  len: (a: Vec3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  dist: (a: Vec3, b: Vec3): number => vec.len(vec.sub(a, b)),
  /** 2D distance in the image plane (xy only); depth from a single camera is too noisy to mix in. */
  dist2d: (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y),
  normalize: (a: Vec3): Vec3 => {
    const l = vec.len(a) || 1e-6;
    return { x: a.x / l, y: a.y / l, z: a.z / l };
  },
};

/** MediaPipe hand landmark indices. */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export type FingerName = 'index' | 'middle' | 'ring' | 'pinky';

export interface FingerJoints {
  name: FingerName;
  mcp: number;
  pip: number;
  dip: number;
  tip: number;
}

export const FINGERS: readonly FingerJoints[] = [
  { name: 'index', mcp: LM.INDEX_MCP, pip: LM.INDEX_PIP, dip: LM.INDEX_DIP, tip: LM.INDEX_TIP },
  { name: 'middle', mcp: LM.MIDDLE_MCP, pip: LM.MIDDLE_PIP, dip: LM.MIDDLE_DIP, tip: LM.MIDDLE_TIP },
  { name: 'ring', mcp: LM.RING_MCP, pip: LM.RING_PIP, dip: LM.RING_DIP, tip: LM.RING_TIP },
  { name: 'pinky', mcp: LM.PINKY_MCP, pip: LM.PINKY_PIP, dip: LM.PINKY_DIP, tip: LM.PINKY_TIP },
];

/** One tracked hand for one video frame. */
export interface HandFrame {
  /** 21 landmarks in normalised image coords (x, y in 0..1; z is relative depth). */
  landmarks: Vec3[];
  /** 21 landmarks in metres, hand-centred. Optional: only used for thumb-depth refinement. */
  world?: Vec3[];
  /** The signer's actual hand (already un-swapped from MediaPipe's selfie convention). */
  handedness: 'left' | 'right';
  handednessScore: number;
  timestampMs: number;
  frameId: number;
}

export type PalmFacing = 'toward-camera' | 'away-from-camera' | 'edge-on';

export interface CanonicalHand {
  /** 21 landmarks in the canonical palm frame, in units of palm length. */
  pts: Vec3[];
  /** 21 landmarks in aspect-corrected image space (used for drawing and trajectory tracing). */
  imagePts: Vec3[];
  handedness: 'left' | 'right';
  /** Wrist -> middle MCP distance in aspect-corrected image units; drives the distance gate. */
  palmLength: number;
  /** |index MCP -> pinky MCP| in palm lengths; normalises lateral (across-palm) features. */
  palmWidth: number;
  /** Wrist -> middle MCP direction vs straight up in the image, degrees (-180..180). */
  rotationDeg: number;
  /**
   * Projected palm chirality, normalised so +1 always means "palm is facing the camera"
   * regardless of which hand signed. Near 0 means the hand is edge-on.
   */
  palmFacing: number;
  facing: PalmFacing;
  /** Mean landmark displacement vs the previous frame, in palm lengths (motion veto input). */
  motion: number;
}

/** Depth of a landmark along the palm normal, in palm lengths (negative = nearer the camera). */
export function palmDepth(pts: Vec3[], index: number): number {
  const p = pts[index];
  return p ? p.z : 0;
}

function angleDegBetween(a: Vec3, b: Vec3): number {
  const cos = vec.dot(a, b) / ((vec.len(a) || 1e-6) * (vec.len(b) || 1e-6));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/**
 * Builds the palm frame basis (palm-plane axes from wrist/index-MCP/pinky-MCP) and
 * projects all 21 landmarks into it. `aspect` is videoWidth / videoHeight, needed because
 * MediaPipe normalises x and y independently and angle features would otherwise be skewed.
 */
export function canonicalize(
  frame: HandFrame,
  aspect: number,
  previous?: CanonicalHand | null,
): CanonicalHand {
  const imagePts = frame.landmarks.map((p) => ({ x: p.x * aspect, y: p.y, z: p.z }));
  const wrist = imagePts[LM.WRIST]!;
  const indexMcp = imagePts[LM.INDEX_MCP]!;
  const middleMcp = imagePts[LM.MIDDLE_MCP]!;
  const pinkyMcp = imagePts[LM.PINKY_MCP]!;

  const toMcp = vec.sub(middleMcp, wrist);
  const palmLength = vec.len(toMcp) || 1e-6;
  const yAxis = vec.normalize(toMcp);
  // Across-the-palm axis, orthogonalised against the palm's long axis.
  const across = vec.sub(pinkyMcp, indexMcp);
  const acrossOrtho = vec.sub(across, vec.scale(yAxis, vec.dot(across, yAxis)));
  const xAxis = vec.normalize(acrossOrtho);
  const zAxis = vec.cross(xAxis, yAxis);

  // Chirality in image space: >0 for a right hand with the palm toward the camera
  // (verified by the synthetic-hand property test; see handModel tests).
  const chirality = vec.cross(vec.sub(indexMcp, wrist), vec.sub(pinkyMcp, wrist)).z;
  const handednessSign = frame.handedness === 'right' ? 1 : -1;
  const rawFacingStrength = chirality / (palmLength * palmLength);
  const palmFacing = clamp(rawFacingStrength * handednessSign * 4, -1, 1);

  // No x mirroring is needed: the basis is built from the hand's own anatomy
  // (index MCP -> pinky MCP), so the thumb always lands on -X whichever hand signs.
  // Mirroring here as well would cancel that out and flip the thumb side.
  // The z axis, however, does flip with handedness (mirrored basis), so normalise it.
  const depthSign = handednessSign;

  const pts = imagePts.map((p) => {
    const rel = vec.sub(p, wrist);
    return {
      x: vec.dot(rel, xAxis) / palmLength,
      y: vec.dot(rel, yAxis) / palmLength,
      z: (vec.dot(rel, zAxis) / palmLength) * depthSign,
    };
  });

  const palmWidth = Math.abs(pts[LM.PINKY_MCP]!.x - pts[LM.INDEX_MCP]!.x) || 1e-6;

  const rotationDeg = (Math.atan2(toMcp.x, -toMcp.y) * 180) / Math.PI;

  // Motion has to be measured in image space: the palm frame is translation-invariant by
  // design, so a hand sweeping across the frame would otherwise look perfectly still.
  let motion = 0;
  if (previous) {
    let total = 0;
    for (let i = 0; i < imagePts.length; i++) {
      total += vec.dist2d(imagePts[i]!, previous.imagePts[i]!);
    }
    motion = total / imagePts.length / palmLength;
  }

  const facing: PalmFacing =
    palmFacing > 0.35 ? 'toward-camera' : palmFacing < -0.35 ? 'away-from-camera' : 'edge-on';

  return {
    pts,
    imagePts,
    handedness: frame.handedness,
    palmLength,
    palmWidth,
    rotationDeg,
    palmFacing,
    facing,
    motion,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** Rising ramp: 0 at `lo`, 1 at `hi`. Tolerates lo > hi (falls instead). */
export function ramp(value: number, lo: number, hi: number): number {
  if (lo === hi) return value >= hi ? 1 : 0;
  return clamp01((value - lo) / (hi - lo));
}

export function smoothstep(value: number, lo: number, hi: number): number {
  const t = ramp(value, lo, hi);
  return t * t * (3 - 2 * t);
}

/** Soft band: 1 inside [lo, hi], falling off over `falloff` on each side. */
export function band(value: number, lo: number, hi: number, falloff = 0.12): number {
  return smoothstep(value, lo - falloff, lo) * (1 - smoothstep(value, hi, hi + falloff));
}

export function angleBetweenDeg(a: Vec3, b: Vec3): number {
  return angleDegBetween(a, b);
}
