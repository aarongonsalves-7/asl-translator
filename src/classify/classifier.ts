/**
 * Scores every letter against the current frame and reports *why*, which is the whole
 * point of this app. Two outputs matter to the UI:
 *   - `ranked`: the top candidates with their probabilities (the "M 46% / N 41%" readout)
 *   - `failing`: the constraints the winner actually missed (the "turn your palm toward
 *     the camera" tip)
 */
import type { HandFeatures } from './features';
import { type Constraint, type Letter, type LetterRule, LETTER_LIST, LETTER_ORDER } from './letters';

export interface LetterScore {
  letter: Letter;
  rule: LetterRule;
  /** Weighted geometric mean of the letter's constraints, scaled by the letter's prior. */
  score: number;
  /** Normalised across all 26 letters; comparable between frames. */
  probability: number;
  constraints: Constraint[];
  /** Constraints of the winning letter that did not match — the actionable part. */
  failing: Constraint[];
  matched: Constraint[];
}

export interface MotionSuggestion {
  letter: Letter;
  /** How well the hand matches that motion letter's *starting* shape (0..1). */
  score: number;
  /** Instruction for the signer, e.g. "trace a J in the air". */
  instruction: string;
}

export interface ClassificationResult {
  /** Static letters, best first. J and Z are excluded — they cannot be read from one frame. */
  ranked: LetterScore[];
  /** Every letter including the motion ones, best first (used for diagnostics/tests). */
  allRanked: LetterScore[];
  letter: Letter;
  probability: number;
  /** probability(top1) - probability(top2); small means "genuinely ambiguous". */
  margin: number;
  /** Confusion-pair coaching for the top two candidates, when they are close. */
  hint: string | null;
  /**
   * J/Z offered as an alternative when the hand matches their starting shape. They are never
   * committed from a still frame — the trajectory matcher has to see the movement first.
   */
  motionSuggestion: MotionSuggestion | null;
}

export interface ClassifierOptions {
  /** Softmax temperature. Lower = more decisive. */
  temperature?: number;
  /** Score floor so one bad constraint cannot zero a letter out. */
  floor?: number;
  /** How many candidates to rank. */
  limit?: number;
}

const CONSTRAINT_FLOOR = 0.02;

/** Weighted geometric mean: every constraint has to hold, but softly. */
function geometricMean(constraints: Constraint[], floor: number): number {
  let weightedLog = 0;
  let totalWeight = 0;
  for (const item of constraints) {
    const value = Math.max(item.value, floor);
    weightedLog += item.weight * Math.log(value);
    totalWeight += item.weight;
  }
  return totalWeight === 0 ? 0 : Math.exp(weightedLog / totalWeight);
}

export function classify(
  features: HandFeatures,
  options: ClassifierOptions = {},
): ClassificationResult {
  const temperature = options.temperature ?? 0.35;
  const floor = options.floor ?? CONSTRAINT_FLOOR;
  const limit = options.limit ?? LETTER_ORDER.length;

  const scored: LetterScore[] = LETTER_LIST.map((rule) => {
    const constraints = rule.build(features);
    const score = rule.prior * geometricMean(constraints, floor);
    return {
      letter: rule.letter,
      rule,
      score,
      probability: 0,
      constraints,
      failing: [],
      matched: [],
    };
  });

  // Softmax over log-scores sharpens the distribution without hard thresholds, so a
  // near-miss still shows up as a visible second candidate.
  const logits = scored.map((s) => Math.log(Math.max(s.score, 1e-6)) / temperature);
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  scored.forEach((s, i) => {
    s.probability = exps[i]! / sum;
  });

  scored.sort((a, b) => b.probability - a.probability);

  // J and Z share their handshape with a static letter (I, and a pointing index), so letting
  // them into the static ranking would make "hold an I" a coin flip. Instead they are offered
  // as an explicit alternative, and only the trajectory matcher can actually commit them.
  const staticRanked = scored.filter((s) => !s.rule.motion);

  // Every candidate gets its failure list, not just the winner: the UI shows why the
  // runner-up lost ("V needs the fingers apart"), which is the useful half of the explanation.
  for (const score of scored) {
    score.failing = score.constraints.filter((item) => item.value < 0.6).sort((a, b) => a.value - b.value);
    score.matched = score.constraints.filter((item) => item.value >= 0.6);
  }

  const top = staticRanked[0]!;
  const runnerUp = staticRanked[1];
  const margin = runnerUp ? top.probability - runnerUp.probability : 1;

  const bestMotion = scored.find((s) => s.rule.motion);
  const motionSuggestion =
    bestMotion && bestMotion.score >= 0.55
      ? {
          letter: bestMotion.letter,
          score: bestMotion.score,
          instruction:
            bestMotion.letter === 'J'
              ? 'Trace a J in the air — down, then hook to the left.'
              : 'Trace a Z in the air — across, back diagonally, then across again.',
        }
      : null;

  return {
    ranked: staticRanked.slice(0, limit),
    allRanked: scored.slice(0, limit),
    letter: top.letter,
    probability: top.probability,
    margin,
    hint: runnerUp ? hintFor(top.letter, runnerUp.letter) : null,
    motionSuggestion,
  };
}

/**
 * Coaching for the letter pairs that a single webcam genuinely cannot separate without the
 * signer adjusting their hand. These are the pairs our tests deliberately keep as "unsure"
 * rather than guessing a wrong letter.
 */
const CONFUSION_HINTS: Record<string, string> = {
  'M|N': 'M and N differ by how many fingers fold over the thumb. Turn your palm toward the camera so the thumb is visible.',
  'M|T': 'M hides the thumb under three fingers; T pokes the thumb up between the index and middle. Roll your wrist so we can see the thumb.',
  'N|T': 'N tucks the thumb under two fingers; T pushes it up between the fingers. Turn your palm toward the camera.',
  'A|S': 'Both are fists: A keeps the thumb alongside the index, S lays it across the front of the fingers.',
  'A|E': 'A keeps the fingers curled over a thumb that sits alongside; E rests the fingertips on a thumb tucked in front.',
  'E|S': 'E tucks the thumb in front with the fingertips resting on it; S lays the thumb across the front of the fist.',
  'A|T': 'A rests the thumb alongside the index; T pushes it up between the index and middle.',
  'S|T': 'S lays the thumb across the front; T pushes it up between the index and middle fingers.',
  'U|V': 'U holds the two fingers together; V spreads them apart. Separate them a little more.',
  'R|U': 'U holds the fingers together; R crosses the index over the middle finger.',
  'R|V': 'V spreads the fingers; R crosses them.',
  'B|C': 'B is flat, C curves. Curve the fingers and thumb toward each other.',
  'C|O': 'C leaves an opening; O closes the fingertips onto the thumb.',
  'B|O': 'B is flat with the thumb across the palm; O brings every fingertip to the thumb.',
  'D|L': 'D brings the thumb to the middle fingertip; L sticks the thumb out to the side.',
  'G|H': 'H extends two fingers; G only the index. Add or drop the middle finger.',
  'G|Q': 'G points sideways, Q points down. Rotate your hand.',
  'H|P': 'H points sideways, P points down.',
  'K|P': 'K points up, P points down. Rotate your hand.',
  'K|V': 'K presses the thumb into the base of the V; V has the thumb tucked over the palm.',
  'I|Y': 'I raises only the pinky; Y raises the pinky and the thumb.',
  'I|J': 'J is an I that draws a J in the air — keep moving the pinky.',
  'G|Z': 'Z traces a Z with the index; G holds the index still and points it sideways.',
  'A|M': 'A keeps the thumb beside the index; M folds three fingers over the thumb.',
  'A|N': 'A keeps the thumb beside the index; N folds two fingers over the thumb.',
  'W|V': 'W adds the ring finger to the V.',
  'B|D': 'D raises only the index; B raises all four fingers.',
  'D|F': 'D touches the thumb to the middle fingertip; F touches the thumb to the index fingertip.',
  'F|O': 'F fans three fingers up; O closes all of them onto the thumb.',
  'X|I': 'X hooks the index; I raises the pinky instead.',
  'X|D': 'D points the index straight up; X hooks it at the tip.',
  'O|C': 'O closes all the way; C stays open.',
};

export function hintFor(a: Letter, b: Letter): string | null {
  return CONFUSION_HINTS[`${a}|${b}`] ?? CONFUSION_HINTS[`${b}|${a}`] ?? null;
}

/** Fallback coaching when the top two are not a known confusion pair. */
export function genericHint(failing: Constraint[]): string | null {
  if (failing.length === 0) return null;
  return `Closest miss: ${failing[0]!.label}.`;
}
