/**
 * Turns the canonical palm frame into the feature vector the letter rules read.
 *
 * Every feature is a 0..1 "how much of this is true" score rather than a boolean, because
 * the classifier multiplies many of them together: a soft score keeps a near-miss visible
 * (and explainable) instead of collapsing it to nothing. The same soft values are what the
 * UI shows as "what I see" — the thing the competitor's status labels never expose.
 */
import {
  type CanonicalHand,
  type FingerName,
  FINGERS,
  LM,
  angleBetweenDeg,
  clamp01,
  ramp,
  vec,
} from '../vision/landmarks';

export interface FingerFeatures {
  name: FingerName;
  /** 0 = fully curled, 1 = straight. */
  extension: number;
  pipBendDeg: number;
  dipBendDeg: number;
  /** X-like hook: the knuckle stays open while the tip curls in. */
  hooked: number;
  /** Fan angle to the neighbour on the thumb side, degrees (0 = parallel). */
  spreadDeg: number;
  spreadToThumb: number;
  tip: { x: number; y: number; z: number };
}

export interface ThumbFeatures {
  /** How far the tip reaches from the thumb MCP, in palm lengths (extended ~1). */
  extension: number;
  /** Signed angle from the palm's long axis toward the thumb side, degrees. */
  abductDeg: number;
  /** -1 = out past the index; 0 = at the index MCP; 1 = at/past the pinky MCP. */
  across: number;
  /** 1 = the tip is lifted off the palm plane (in front of the palm), 0 = flat in it (A). */
  lift: number;
  /** Height along the palm: 0 at the wrist, 1 at the MCP row, > 1 beyond the knuckles. */
  tipY: number;      /** 1 when the thumb points up past the index MCP (thumbs-up). */
  upAlong: number;
  /** Bend at the thumb's IP joint, degrees — high means a visibly hooked thumb. */
  ipBendDeg: number;
  /** Straight-line reach of the thumb's two distal bones, in palm lengths (max ~0.52). */
  reach: number;
  /** Thumb pointing up / down in *image* space, gated by the fingers being curled. */
  thumbsUp: number;
  thumbsDown: number;
}

export interface HandFeatures {
  hand: CanonicalHand;
  finger: Record<FingerName, FingerFeatures>;
  fingers: FingerFeatures[];
  thumb: ThumbFeatures;
  /** 1 = the thumb tip is touching that fingertip (F, O, D). */
  contacts: Record<FingerName, number>;
  /** 1 = the index is straight (D, I-like), low = curled toward the palm (C, O, E). */
  indexStraightness: number;
  /** 0 = index/middle/ring/pinky parallel, 1 = well fanned. */
  spread: { im: number; mr: number; rp: number; thumbIndex: number };    /** 1 = the index crosses over the middle finger (R). 0 unless both fingers are extended. */
  crossedIM: number;
  /** Thumb tip sitting between the index and middle knuckles (K, T). */
  thumbBetweenKnuckles: number;
  extendedCount: number;
  /** Mean extension of the four fingers: 0 = fist, 1 = open hand. */
  openness: number;
  /** Image-space direction of the most-extended long finger: 0 up, +/-90 sideways, +/-180 down. */
  pointDirDeg: number;
  /** False when no long finger is extended, in which case pointDirDeg means nothing. */
  pointDirValid: boolean;
  /** Which way the palm's long axis points in the image. */
  palmFacing: 'toward-camera' | 'away-from-camera' | 'edge-on';
}

function fingerFeatures(hand: CanonicalHand, index: number): FingerFeatures {
  const f = FINGERS[index]!;
  const mcp = hand.pts[f.mcp]!;
  const pip = hand.pts[f.pip]!;
  const dip = hand.pts[f.dip]!;
  const tip = hand.pts[f.tip]!;

  const bones = vec.dist(mcp, pip) + vec.dist(pip, dip) + vec.dist(dip, tip);
  const straightness = bones > 1e-6 ? vec.dist(mcp, tip) / bones : 0;

  const pipBendDeg = angleBetweenDeg(vec.sub(pip, mcp), vec.sub(dip, pip));
  const dipBendDeg = angleBetweenDeg(vec.sub(dip, pip), vec.sub(tip, dip));

  // Straightness and joint bend measure the same thing from different angles; blending them
  // makes the score robust when a fingertip is occluded or foreshortened.
  const extStraight = ramp(straightness, 0.55, 0.9);
  const extBend = 1 - ramp(pipBendDeg + dipBendDeg, 55, 145);
  const extension = clamp01(0.6 * extStraight + 0.4 * extBend);

  // A hook bends late (at the DIP) while the knuckle stays open.
  const hooked = clamp01((1 - ramp(pipBendDeg, 30, 72)) * ramp(dipBendDeg, 38, 82));

  return {
    name: f.name,
    extension,
    pipBendDeg,
    dipBendDeg,
    hooked,
    spreadDeg: 0,
    spreadToThumb: 0,
    tip: { x: tip.x, y: tip.y, z: tip.z },
  };
}

function spreadAngle(a: FingerFeatures, b: FingerFeatures): number {
  const va = vec.normalize({ x: a.tip.x, y: a.tip.y, z: 0 });
  const vb = vec.normalize({ x: b.tip.x, y: b.tip.y, z: 0 });
  return angleBetweenDeg(va, vb);
}

export function extractFeatures(hand: CanonicalHand): HandFeatures {
  const fingers = FINGERS.map((_, i) => fingerFeatures(hand, i));
  const [index, middle, ring, pinky] = fingers as [
    FingerFeatures,
    FingerFeatures,
    FingerFeatures,
    FingerFeatures,
  ];

  // Fan angle between neighbouring fingertips (parallel fingers are ~0 degrees).
  index.spreadDeg = spreadAngle(index, middle);
  middle.spreadDeg = spreadAngle(index, middle);
  ring.spreadDeg = spreadAngle(middle, ring);
  pinky.spreadDeg = spreadAngle(ring, pinky);

  const thumbCmc = hand.pts[LM.THUMB_CMC]!;
  const thumbMcp = hand.pts[LM.THUMB_MCP]!;
  const thumbTip = hand.pts[LM.THUMB_TIP]!;
  const indexMcp = hand.pts[LM.INDEX_MCP]!;
  const middleMcp = hand.pts[LM.MIDDLE_MCP]!;

  const width = hand.palmWidth || 1e-6;
  const thumbReach = vec.dist(thumbTip, thumbMcp);
  // How straight the thumb is: the bend at its IP joint. Measuring reach against a fixed
  // distance does not work — the thumb's own two distal bones only span ~0.5 palm lengths,
  // so an extended thumb can never reach a palm-length-scale threshold.
  const thumbIpBendDeg = angleBetweenDeg(
    vec.sub(hand.pts[LM.THUMB_IP]!, thumbMcp),
    vec.sub(thumbTip, hand.pts[LM.THUMB_IP]!),
  );
  // Measured CMC -> tip (the whole thumb's direction), not MCP -> tip: a flexed thumb's
  // distal segment points sideways no matter where the thumb as a whole is pointing.
  const reachXY = { x: thumbTip.x - thumbCmc.x, y: thumbTip.y - thumbCmc.y, z: 0 };
  // Positive when the thumb angles toward the -X (thumb) side of the palm.
  const abductDeg = (Math.atan2(-reachXY.x, reachXY.y) * 180) / Math.PI;

  // Everything in the palm frame is already in palm-length units, so these distances are
  // directly comparable between users and camera distances.
  const contacts = {
    index: 0,
    middle: 0,
    ring: 0,
    pinky: 0,
  } as Record<FingerName, number>;
  for (const f of fingers) {
    contacts[f.name] = 1 - ramp(vec.dist(thumbTip, f.tip), 0.3, 0.62);
  }

  const imageIndexMcp = hand.imagePts[LM.INDEX_MCP]!;
  const imageIndexTip = hand.imagePts[LM.INDEX_TIP]!;
  const imageMiddleMcp = hand.imagePts[LM.MIDDLE_MCP]!;
  const imageMiddleTip = hand.imagePts[LM.MIDDLE_TIP]!;
  const imageThumbMcp = hand.imagePts[LM.THUMB_MCP]!;
  const imageThumbTip = hand.imagePts[LM.THUMB_TIP]!;

  // Direction of the most-extended long finger. A curled finger's tip curls back toward
  // the palm, so its direction is meaningless — the pointing constraints are gated on this.
  const reaching = [index, middle, ring, pinky].reduce((best, f) =>
    f.extension > best.extension ? f : best,
  );
  const pointDirValid = reaching.extension >= 0.45;
  const pointSource =
    reaching === middle ? { mcp: imageMiddleMcp, tip: imageMiddleTip } : { mcp: imageIndexMcp, tip: imageIndexTip };
  const pointVec = vec.sub(pointSource.tip, pointSource.mcp);
  const pointDirDeg = (Math.atan2(pointVec.x, -pointVec.y) * 180) / Math.PI;

  const thumbVec = vec.sub(imageThumbTip, imageThumbMcp);
  const thumbLen = vec.len(thumbVec) || 1e-6;
  const verticality = Math.abs(thumbVec.y) / thumbLen;
  const openness = (index.extension + middle.extension + ring.extension + pinky.extension) / 4;
  const fistness = 1 - openness;

  const across = (thumbTip.x - indexMcp.x) / width;
  const tipY = thumbTip.y;
  const thumbExtension = clamp01(
    0.65 * (1 - ramp(thumbIpBendDeg, 18, 58)) + 0.35 * ramp(thumbReach / 0.52, 0.72, 0.97),
  );

  // The canonical frame's z points away from the camera, and "the palm side" flips with the
  // hand's facing, so normalise by it: lift > 0 always means "off the palm, toward the palm side".
  const palmSide = hand.palmFacing < 0 ? -1 : 1;
  const lift = clamp01((-thumbTip.z * palmSide) / 0.55);

  const knuckleGap = vec.dist(indexMcp, middleMcp);
  // Lateral only: "between the knuckles" is a relationship in the palm plane, and the thumb
  // is almost always lifted off that plane, which would otherwise dominate the distance.
  const thumbBetween = 1 - ramp(vec.dist2d(thumbTip, indexMcp), 0.35, 0.8);

  // Crossing test: the index tip's signed offset from the middle finger's axis. Spreading the
  // fingers moves the index away from that axis (same sign as normal); crossing it reverses it.
  // Only meaningful while the middle finger actually points somewhere: a curled middle finger's
  // axis points back down into the palm, which would make every pointing hand look crossed.
  const middleAxis =
    middle.extension >= 0.45
      ? vec.normalize({ x: middle.tip.x - middleMcp.x, y: middle.tip.y - middleMcp.y, z: 0 })
      : null;
  const lateralOffset = middleAxis
    ? (middleAxis.x * (index.tip.y - middleMcp.y) - middleAxis.y * (index.tip.x - middleMcp.x)) / width
    : 0;

  return {
    hand,
    finger: { index, middle, ring, pinky },
    fingers,
    thumb: {
      extension: thumbExtension,
      abductDeg,
      across,
      lift,
      tipY,
      upAlong: clamp01(ramp(thumbTip.y - indexMcp.y, 0.05, 0.5) * ramp(-thumbTip.x, 0.3, 0.95)),
      ipBendDeg: thumbIpBendDeg,
      reach: thumbReach,
      thumbsUp: clamp01(fistness * ramp(verticality, 0.55, 0.85) * ramp(-thumbVec.y / thumbLen, 0.4, 0.8)),
      thumbsDown: clamp01(
        fistness * ramp(verticality, 0.55, 0.85) * ramp(thumbVec.y / thumbLen, 0.4, 0.8),
      ),
    },
    contacts,
    indexStraightness: index.extension,
    spread: {
      im: ramp(index.spreadDeg, 8, 26),
      mr: ramp(middle.spreadDeg, 8, 26),
      rp: ramp(ring.spreadDeg, 8, 26),
      thumbIndex: ramp(Math.abs(abductDeg), 20, 55),
    },
    crossedIM: middleAxis ? clamp01(ramp(-lateralOffset, 0.02, 0.22)) : 0,
    thumbBetweenKnuckles: clamp01(0.5 * thumbBetween + 0.5 * ramp(knuckleGap, 0, 0.4)),
    extendedCount:
      (index.extension > 0.5 ? 1 : 0) +
      (middle.extension > 0.5 ? 1 : 0) +
      (ring.extension > 0.5 ? 1 : 0) +
      (pinky.extension > 0.5 ? 1 : 0),
    openness,
    pointDirDeg,
    pointDirValid,
    palmFacing: hand.facing,
  };
}

/** Human-readable finger state for the "what I see" panel. */
export function describeFinger(f: FingerFeatures): string {
  if (f.hooked > 0.5) return 'hooked';
  if (f.extension > 0.75) return 'straight';
  if (f.extension > 0.45) return 'curved';
  if (f.extension > 0.2) return 'curling';
  return 'curled';
}

/** Human-readable thumb state for the "what I see" panel. */
export function describeThumb(t: ThumbFeatures): string {
  if (t.thumbsUp > 0.5) return 'pointing up';
  if (t.thumbsDown > 0.5) return 'pointing down';
  if (t.across > 0.5) return 'across the palm';
  if (t.across > 0.2) return 'toward the middle';
  if (t.lift > 0.5 && t.extension < 0.6) return 'tucked in front';
  if (t.extension > 0.6) return 'extended out';
  return 'alongside';
}
