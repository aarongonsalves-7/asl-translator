/**
 * The vocabulary: 26 letters, A-Z.
 *
 * Each letter is a *weighted list of soft constraints over the feature vector*, not a hard
 * branch. That choice is what makes the app able to explain itself: a letter's score is the
 * geometric mean of the constraints below, so the UI can point at the exact constraint that
 * failed ("thumb is not across the palm") instead of showing an opaque confidence number.
 *
 * J and Z are the two motion letters. They are listed here with a low prior so they surface
 * as candidates, but they can only be committed after the trajectory matcher in
 * ../pipeline/motion.ts sees the actual movement.
 */
import { band, clamp01, ramp, type FingerName } from '../vision/landmarks';
import type { HandFeatures } from './features';

export type Letter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';

export interface Constraint {
  id: string;
  /** Plain-language statement shown in the "why" panel. */
  label: string;
  /** 0..1 degree of match. */
  value: number;
  weight: number;
}

export interface LetterRule {
  letter: Letter;
  /** One-line description for the alphabet chart. */
  handshape: string;
  /** How to form it, for the chart. */
  tip: string;
  prior: number;
  motion?: 'j' | 'z';
  build(f: HandFeatures): Constraint[];
}

const c = (id: string, label: string, value: number, weight = 1): Constraint => ({
  id,
  label,
  value: clamp01(value),
  weight,
});

const ext = (f: HandFeatures, name: FingerName, weight = 2): Constraint =>
  c(`ext-${name}`, `${name} extended`, f.finger[name].extension, weight);

const curl = (f: HandFeatures, name: FingerName, weight = 2): Constraint =>
  c(`curl-${name}`, `${name} curled`, 1 - f.finger[name].extension, weight);

const together = (f: HandFeatures, a: 'im' | 'mr' | 'rp', weight = 2): Constraint =>
  c(`together-${a}`, 'fingers held together', 1 - f.spread[a], weight);

const apart = (f: HandFeatures, a: 'im' | 'mr' | 'rp', weight = 2): Constraint =>
  c(`apart-${a}`, 'fingers spread apart', f.spread[a], weight);

const thumbAcross = (f: HandFeatures, weight = 2): Constraint =>
  c('thumb-across', 'thumb folded across the palm', ramp(f.thumb.across, 0.15, 0.6), weight);

const thumbNotAcross = (f: HandFeatures, weight = 1.5): Constraint =>
  c('thumb-out', 'thumb not folded across the palm', 1 - ramp(f.thumb.across, 0.2, 0.6), weight);

const thumbInFront = (f: HandFeatures, weight = 2): Constraint =>
  c('thumb-in-front', 'thumb tucked in front of the fingers', f.thumb.lift, weight);

const noContact = (f: HandFeatures, weight = 1.5): Constraint => {
  const worst = Math.max(f.contacts.index, f.contacts.middle, f.contacts.ring, f.contacts.pinky);
  return c('no-contact', 'thumb clear of the fingertips', 1 - worst, weight);
};

const contact = (f: HandFeatures, name: FingerName, weight = 2): Constraint =>
  c(`contact-${name}`, `thumb touches ${name} fingertip`, f.contacts[name], weight);

// The pointing direction is only meaningful when a long finger is actually extended.
const pointingUp = (f: HandFeatures, weight = 2): Constraint =>
  c('point-up', 'fingers point up', f.pointDirValid ? 1 - ramp(Math.abs(f.pointDirDeg), 25, 70) : 0, weight);

const pointingSideways = (f: HandFeatures, weight = 2): Constraint =>
  c(
    'point-sideways',
    'hand turned so fingers point sideways',
    f.pointDirValid ? band(Math.abs(f.pointDirDeg), 55, 125, 25) : 0,
    weight,
  );

const pointingDown = (f: HandFeatures, weight = 2): Constraint =>
  c(
    'point-down',
    'hand turned so fingers point down',
    f.pointDirValid ? band(Math.abs(f.pointDirDeg), 120, 180, 20) : 0,
    weight,
  );

const meanExt = (f: HandFeatures): number =>
  (f.finger.index.extension +
    f.finger.middle.extension +
    f.finger.ring.extension +
    f.finger.pinky.extension) /
  4;

/** Mean bend at the PIP joints: E folds the fingers flat onto the palm, O rounds them. */
const meanPipBend = (f: HandFeatures): number =>
  (f.finger.index.pipBendDeg +
    f.finger.middle.pipBendDeg +
    f.finger.ring.pipBendDeg +
    f.finger.pinky.pipBendDeg) /
  4;

// K can be foreshortened into an apparent U: the opposed, raised thumb is
// stronger evidence than a large image-plane V. Keep that evidence shared.
const raisedThumb = (f: HandFeatures): number =>
  f.thumbBetweenKnuckles * ramp(f.thumb.tipY, 0.85, 1.08) *
  Math.max(f.spread.im, ramp(f.indexMiddleAngleDeg, 5, 13));

export const LETTER_ORDER: Letter[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

export const LETTERS: Record<Letter, LetterRule> = {
  A: {
    letter: 'A',
    handshape: 'Fist, thumb alongside the index',
    tip: 'Curl all four fingers into a fist and rest the thumb against the side of the index finger — not across the front.',
    prior: 1,
    build: (f) => [
      curl(f, 'index'), curl(f, 'middle'), curl(f, 'ring'), curl(f, 'pinky'),
      thumbNotAcross(f, 2.2),
      c('thumb-alongside', 'thumb straight alongside the index', f.thumb.extension, 1.5),
      c('thumb-low-lift', 'thumb in the plane of the palm', 1 - f.thumb.lift, 1.2),
      // In A the thumb points up alongside the index. Without this the shape is also matched
      // by a fist whose thumb hangs down (which is the thumbs-down gesture, not a letter).
      c('thumb-points-up', 'thumb tip above the index, pointing up', ramp(f.thumb.tipY - f.finger.index.tip.y, 0.1, 0.45), 2),
      noContact(f),
    ],
  },
  B: {
    letter: 'B',
    handshape: 'Four fingers up and together, thumb across the palm',
    tip: 'Hold four fingers straight up and pressed together, then fold the thumb across the palm.',
    prior: 1,
    build: (f) => [
      c('flat-hand', 'four fingers straight', meanExt(f), 2.5),
      together(f, 'im'), together(f, 'mr'), together(f, 'rp'),
      thumbAcross(f, 2.5),
      pointingUp(f, 1.2),
      noContact(f),
    ],
  },
  C: {
    letter: 'C',
    handshape: 'Curved hand, thumb opposite the fingertips',
    tip: 'Curve all four fingers and the thumb toward each other, leaving a gap — the shape of a C.',
    prior: 1,
    build: (f) => [
      // Every finger individually has to be mid-curve: a hand with one finger extended and
      // three curled has the same *average* extension but is not a C.
      c('c-curve-index', 'index curved, not straight or curled', band(f.finger.index.extension, 0.22, 0.72, 0.14), 1.5),
      c('c-curve-middle', 'middle curved, not straight or curled', band(f.finger.middle.extension, 0.22, 0.72, 0.14), 1.5),
      c('c-curve-ring', 'ring curved, not straight or curled', band(f.finger.ring.extension, 0.22, 0.72, 0.14), 1.5),
      c('c-curve-pinky', 'pinky curved, not straight or curled', band(f.finger.pinky.extension, 0.22, 0.72, 0.14), 1.5),
      c('thumb-opposed', 'thumb curved toward the fingertips', band(f.thumb.abductDeg, 10, 70, 20), 2),
      noContact(f, 2.2),
      c('thumb-not-across', 'thumb not folded into the palm', 1 - ramp(f.thumb.across, 0.25, 0.7), 1.5),
    ],
  },
  D: {
    letter: 'D',
    handshape: 'Index up, thumb touches the middle finger',
    tip: 'Point the index finger up and bring the thumb across to touch the tip of the middle finger; ring and pinky curled.',
    prior: 1,
    build: (f) => [
      ext(f, 'index', 2.5),
      curl(f, 'middle'), curl(f, 'ring'), curl(f, 'pinky'),
      // Squared: D needs a real touch, not "thumb happened to be nearby" (which is what a
      // pointing index with tucked fingers also produces).
      c('contact-middle', 'thumb pressed to the middle fingertip', f.contacts.middle ** 2, 2.5),
      // D's thumb climbs to meet that fingertip; a tucked thumb that merely happens to be
      // nearby (a pointing index, as in Z) sits lower.
      c('thumb-tip-high', 'thumb tip raised to the middle fingertip', ramp(f.thumb.tipY, 0.95, 1.2), 1.5),
      pointingUp(f, 1.5),
      // No `thumbAcross` here: D's thumb reaches *up* to the middle fingertip, so its tip
      // never travels across the palm. Requiring that (as an earlier version did) made D
      // impossible to commit — no real D satisfies it.
    ],
  },
  E: {
    letter: 'E',
    handshape: 'Fingers curled, tips resting on the thumb',
    tip: 'Curl the fingers until the tips rest on the thumb, and tuck the thumb in front of the palm.',
    prior: 1,
    build: (f) => [
      curl(f, 'index', 2.2), curl(f, 'middle', 2.2), curl(f, 'ring', 1.8), curl(f, 'pinky', 1.8),
      thumbInFront(f, 2.5),
      // E folds the fingers flat onto the palm; O (which also points the tips at the thumb)
      // leaves the knuckles open and rounds the fingers instead.
      c('fingers-folded-flat', 'fingers folded flat onto the palm', ramp(meanPipBend(f), 58, 80), 2),
      c('thumb-at-index-base', 'thumb beside the base of the index', band(f.thumb.across, -0.45, 0.14, 0.14), 2),
      c('thumb-tip-low', 'thumb tip low in the palm', 1 - ramp(f.thumb.tipY, 0.5, 0.85), 2.5),
      c('thumb-tucked', 'thumb tucked against the palm', 1 - f.thumb.extension, 1.2),
    ],
  },
  F: {
    letter: 'F',
    handshape: 'Thumb and index tips touch, three fingers up',
    tip: 'Touch the thumb and index fingertips together and fan the other three fingers straight up.',
    prior: 1,
    build: (f) => [
      contact(f, 'index', 3),
      ext(f, 'middle', 2), ext(f, 'ring', 2), ext(f, 'pinky', 2),
      // "Extended" alone is not enough: a C hand's fingers are three-quarters straight, which
      // scored as an F. F really does hold those three fingers straight.
      c(
        'fingers-straight',
        'middle, ring and pinky straight',
        ramp(Math.min(f.finger.middle.extension, f.finger.ring.extension, f.finger.pinky.extension), 0.82, 0.96),
        2.5,
      ),
      c('no-other-contact', 'thumb clear of the other fingertips', 1 - Math.max(f.contacts.middle, f.contacts.ring, f.contacts.pinky), 1.5),
      pointingUp(f, 1.2),
    ],
  },
  G: {
    letter: 'G',
    handshape: 'Index points sideways, thumb parallel',
    tip: 'Make a fist, then extend the index and thumb so they point sideways, parallel to each other.',
    prior: 1,
    build: (f) => [
      ext(f, 'index', 2),
      curl(f, 'middle'), curl(f, 'ring'), curl(f, 'pinky'),
      pointingSideways(f, 2.2),
      c('thumb-parallel', 'thumb extended alongside the index', f.thumb.extension, 2),
      noContact(f),
    ],
  },
  H: {
    letter: 'H',
    handshape: 'Index and middle point sideways, together',
    tip: 'Extend the index and middle fingers together and turn the hand so they point sideways.',
    prior: 1,
    build: (f) => [
      ext(f, 'index'), ext(f, 'middle'),
      together(f, 'im', 2.5),
      curl(f, 'ring'), curl(f, 'pinky'),
      pointingSideways(f, 2.5),
    ],
  },
  I: {
    letter: 'I',
    handshape: 'Pinky up, others curled',
    tip: 'Curl the index, middle and ring fingers into the palm and raise the pinky straight up.',
    prior: 1,
    build: (f) => [
      ext(f, 'pinky', 2.5),
      curl(f, 'index', 2.2), curl(f, 'middle', 2.2), curl(f, 'ring', 2.2),
      c('thumb-over', 'thumb resting over the curled fingers', band(f.thumb.across, 0.15, 0.75, 0.18), 1.2),
      pointingUp(f, 1),
    ],
  },
  J: {
    letter: 'J',
    handshape: 'Pinky up, draws a J in the air',
    tip: 'Start from I (pinky up), then draw a J — down, then hook to the left.',
    prior: 1,
    motion: 'j',
    build: (f) => [
      ext(f, 'pinky', 2.5),
      curl(f, 'index', 2.2), curl(f, 'middle', 2.2), curl(f, 'ring', 2.2),
      c('thumb-over', 'thumb resting over the curled fingers', band(f.thumb.across, 0.15, 0.75, 0.18), 1.2),
      pointingUp(f, 1),
    ],
  },
  K: {
    letter: 'K',
    handshape: 'Index and middle up and spread, thumb between them',
    tip: 'Extend the index and middle fingers into a V and press the thumb against the base between them.',
    prior: 1,
    build: (f) => [
      ext(f, 'index'), ext(f, 'middle'),
      c('spread-or-thumb', 'fingers separated or thumb raised between them', Math.max(f.spread.im, raisedThumb(f)), 2.2),
      c('k-finger-direction', 'middle finger separated or angled forward from the index', Math.max(f.spread.im, ramp(f.indexMiddleAngleDeg, 5, 13)), 2),
      c('not-crossed', 'fingers not crossed', 1 - f.crossedIM, 2),
      curl(f, 'ring'), curl(f, 'pinky'),
      c('thumb-between', 'thumb pressed between the index and middle fingers', ramp(f.thumbBetweenKnuckles, 0.55, 0.85) ** 2, 2.5),
      c('thumb-raised', 'thumb tip raised between the fingers', ramp(f.thumb.tipY, 0.92, 1.08), 2),
      pointingUp(f, 1.5),
    ],
  },
  L: {
    letter: 'L',
    handshape: 'Index up, thumb out at a right angle',
    tip: 'Raise the index finger and stick the thumb straight out to the side, making an L.',
    prior: 1,
    build: (f) => [
      ext(f, 'index', 2.2),
      c('thumb-out', 'thumb straight, not bent', f.thumb.extension, 2.5),
      c('thumb-angled', 'thumb angled well out from the index', band(f.thumb.abductDeg, 30, 85, 15), 2.4),
      curl(f, 'middle'), curl(f, 'ring'), curl(f, 'pinky'),
      // L is an upright index; without this, G (sideways) and Q (down) match L's shape exactly.
      pointingUp(f, 2),
      noContact(f, 2),
    ],
  },
  M: {
    letter: 'M',
    handshape: 'Three fingers over the thumb',
    tip: 'Fold the index, middle and ring fingers down over the thumb, pinky curled — the thumb reaches the ring finger.',
    prior: 1,
    build: (f) => [
      curl(f, 'index', 2), curl(f, 'middle', 2), curl(f, 'ring', 2), curl(f, 'pinky', 1.2),
      c('thumb-reaches-ring', 'thumb tucked under three fingers', ramp(f.thumb.across, 0.55, 0.95), 2.8),
      c('thumb-under', 'thumb hidden under the fingers, not lifted', 1 - f.thumb.lift, 2),
      c('thumb-not-extended', 'thumb not extended out', 1 - f.thumb.extension, 1.2),
    ],
  },
  N: {
    letter: 'N',
    handshape: 'Two fingers over the thumb',
    tip: 'Fold the index and middle fingers down over the thumb so only two fingers cover it.',
    prior: 1,
    build: (f) => [
      curl(f, 'index', 2), curl(f, 'middle', 2),
      curl(f, 'ring', 1.2), curl(f, 'pinky', 1.2),
      c('thumb-reaches-middle', 'thumb tucked under two fingers', band(f.thumb.across, 0.12, 0.58, 0.14), 2.8),
      c('thumb-not-extended', 'thumb not extended out', 1 - f.thumb.extension, 1.2),
      // S is the pair's confusable twin: same fist, but the thumb rides at knuckle height.
      c('thumb-low', 'thumb tip low, buried under the folded fingers', 1 - ramp(f.thumb.tipY, 0.5, 0.58), 3),
    ],
  },
  O: {
    letter: 'O',
    handshape: 'All fingertips meet the thumb',
    tip: 'Bring all four fingertips to meet the thumb tip, forming an O.',
    prior: 1,
    build: (f) => [
      // The thumb opposes the index and middle tips; the ring and pinky tuck in behind them.
      // Do not require four simultaneous point contacts from noisy tracked landmarks.
      contact(f, 'index', 2.5), contact(f, 'middle', 2.5),
      // Thumb height helps distinguish O from E. Rounded rather than tightly folded
      // fingers also distinguish an opposed thumb from the tucked thumb of T.
      c('thumb-tip-high', 'thumb tip up at fingertip height', ramp(f.thumb.tipY, 0.6, 1.05), 2.5),
      c('rounded-fingers', 'fingers rounded rather than folded into a fist', band(meanPipBend(f), 30, 85, 15), 2),
      // In a closed fist the thumb tip happens to land near the curled fingertips, so contact
      // alone would read an I (pinky up, thumb across the fingers) as an O. The pinky is the
      // reliable difference: O curls it to the thumb, I extends it.
      c('pinky-curled', 'pinky curled to the thumb', 1 - f.finger.pinky.extension, 2),
      c('not-a-fist', 'fingers curled toward the thumb, not straight', 1 - ramp(meanExt(f), 0.55, 0.9), 1.2),
    ],
  },
  P: {
    letter: 'P',
    handshape: 'K turned so fingers point down',
    tip: 'Make a K, then turn the hand so the fingers point down toward the floor.',
    prior: 1,
    build: (f) => [
      ext(f, 'index'), ext(f, 'middle'),
      apart(f, 'im', 2),
      curl(f, 'ring'), curl(f, 'pinky'),
      pointingDown(f, 2.5),
      c('thumb-between', 'thumb between the index and middle fingers', f.thumbBetweenKnuckles, 1.8),
    ],
  },
  Q: {
    letter: 'Q',
    handshape: 'G turned so fingers point down',
    tip: 'Make a G, then turn the hand so the index and thumb point down.',
    prior: 1,
    build: (f) => [
      ext(f, 'index', 2),
      curl(f, 'middle'), curl(f, 'ring'), curl(f, 'pinky'),
      pointingDown(f, 2.8),
      c('thumb-parallel', 'thumb extended alongside the index', f.thumb.extension, 1.8),
      noContact(f),
    ],
  },
  R: {
    letter: 'R',
    handshape: 'Index and middle crossed',
    tip: 'Raise the index and middle fingers and cross the index over the middle one.',
    prior: 1,
    build: (f) => [
      ext(f, 'index', 2), ext(f, 'middle', 2),
      c('crossed', 'index crossed over the middle finger', f.crossedIM, 3),
      curl(f, 'ring'), curl(f, 'pinky'),
      pointingUp(f, 1.2),
    ],
  },
  S: {
    letter: 'S',
    handshape: 'Fist with the thumb across the front',
    tip: 'Make a fist and lay the thumb across the front of the curled fingers.',
    prior: 1,
    build: (f) => [
      curl(f, 'index', 2.2), curl(f, 'middle', 2.2), curl(f, 'ring', 2.2), curl(f, 'pinky', 2.2),
      c('thumb-across-front', 'thumb laid across the front of the fingers', band(f.thumb.across, 0.2, 0.8, 0.16), 2.5),
      c('thumb-in-front', 'thumb lifted off the palm', f.thumb.lift, 2.2),
      c('thumb-high', 'thumb tip up at knuckle height, not under the fingers', band(f.thumb.tipY, 0.58, 0.9, 0.06), 3),
    ],
  },
  T: {
    letter: 'T',
    handshape: 'Thumb pokes up between index and middle',
    tip: 'Make a fist and push the thumb up between the index and middle fingers.',
    prior: 1,
    build: (f) => [
      c('closed-knuckles', 'fingers folded into a fist', ramp(meanPipBend(f), 85, 105), 2),
      curl(f, 'index', 2.2), curl(f, 'middle', 2.2), curl(f, 'ring', 1.8), curl(f, 'pinky', 1.8),
      c('thumb-high', 'thumb tip poking up between the knuckles', ramp(f.thumb.tipY, 0.62, 0.95), 2.8),
      c('thumb-between', 'thumb between the index and middle fingers', band(f.thumb.across, 0.02, 0.5, 0.15), 2),
      c('thumb-not-under', 'thumb in front of the palm', f.thumb.lift, 1),
    ],
  },
  U: {
    letter: 'U',
    handshape: 'Index and middle up, held together',
    tip: 'Raise the index and middle fingers straight up and keep them pressed together.',
    prior: 1,
    build: (f) => [
      ext(f, 'index', 2), ext(f, 'middle', 2),
      c('straight-pair', 'index and middle straight rather than curved', ramp(Math.min(f.finger.index.extension, f.finger.middle.extension), 0.75, 0.95), 2),
      together(f, 'im', 2.8),
      c('thumb-tucked', 'thumb tucked below the extended fingers', 1 - ramp(raisedThumb(f), 0.25, 0.7), 2.5),
      c('not-crossed', 'fingers together, not crossed', 1 - f.crossedIM, 2),
      curl(f, 'ring'), curl(f, 'pinky'),
      pointingUp(f, 1.5),
    ],
  },
  V: {
    letter: 'V',
    handshape: 'Index and middle up, spread apart',
    tip: 'Raise the index and middle fingers and spread them into a V.',
    prior: 1,
    build: (f) => [
      ext(f, 'index', 2), ext(f, 'middle', 2),
      apart(f, 'im', 2.8),
      curl(f, 'ring'), curl(f, 'pinky'),
      // K and V share the V shape; they differ in the thumb. K presses it up between the
      // two fingers, V keeps it low and tucked over the palm.
      c('thumb-away', 'thumb tucked away, not between the fingers', 1 - ramp(f.thumbBetweenKnuckles, 0.5, 0.8), 1),
      c('thumb-tip-low', 'thumb tip low, tucked over the palm', 1 - ramp(f.thumb.tipY, 0.88, 1.05), 2),
      c('not-crossed', 'fingers not crossed', 1 - f.crossedIM, 1.5),
      pointingUp(f, 1.5),
    ],
  },
  W: {
    letter: 'W',
    handshape: 'Three fingers up and spread',
    tip: 'Raise the index, middle and ring fingers and spread them apart; thumb holds the pinky down.',
    prior: 1,
    build: (f) => [
      ext(f, 'index', 2), ext(f, 'middle', 2), ext(f, 'ring', 2),
      apart(f, 'im', 2), apart(f, 'mr', 2),
      curl(f, 'pinky', 1.8),
      pointingUp(f, 1.2),
    ],
  },
  X: {
    letter: 'X',
    handshape: 'Index hooked, others curled',
    tip: 'Curl the index finger into a hook (bent at the tip, open at the knuckle); the other fingers stay curled.',
    prior: 1,
    build: (f) => [
      c('hooked', 'index hooked at the tip', f.finger.index.hooked, 3),
      c('index-raised', 'index base more open than the other curled fingers', ramp((f.finger.middle.mcpBendDeg + f.finger.ring.mcpBendDeg + f.finger.pinky.mcpBendDeg) / 3 - f.finger.index.mcpBendDeg, 8, 25), 3),
      c('index-not-straight', 'index not straight', 1 - ramp(f.finger.index.extension, 0.7, 0.98), 1.5),
      curl(f, 'middle'), curl(f, 'ring'), curl(f, 'pinky'),
      c('index-open-knuckle', 'index base knuckle stays open', 1 - ramp(f.finger.index.mcpBendDeg, 35, 80), 1.5),
    ],
  },
  Y: {
    letter: 'Y',
    handshape: 'Thumb and pinky out',
    tip: 'Extend the thumb and pinky; curl the index, middle and ring fingers.',
    prior: 1,
    build: (f) => [
      ext(f, 'pinky', 2), 
      c('thumb-out', 'thumb extended out', f.thumb.extension, 2.8),
      curl(f, 'index', 2.2), curl(f, 'middle', 2.2), curl(f, 'ring', 2.2),
      noContact(f, 1.5),
    ],
  },
  Z: {
    letter: 'Z',
    handshape: 'Index up, draws a Z in the air',
    tip: 'Point the index finger up and trace a Z in the air.',
    prior: 1,
    motion: 'z',
    build: (f) => [
      ext(f, 'index', 2.5),
      curl(f, 'middle', 2.2), curl(f, 'ring', 2.2), curl(f, 'pinky', 2.2),
      c('thumb-clear', 'thumb out of the way', 1 - f.thumb.extension, 1.2),
      pointingUp(f, 1.5),
    ],
  },
};

export const LETTER_LIST = LETTER_ORDER.map((letter) => LETTERS[letter]);
