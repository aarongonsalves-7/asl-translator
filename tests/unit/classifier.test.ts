import { describe, expect, it } from 'vitest';
import { classify } from '../../src/classify/classifier';
import { extractFeatures } from '../../src/classify/features';
import { LETTER_ORDER } from '../../src/classify/letters';
import { canonicalize } from '../../src/vision/landmarks';
import { simulateLetter } from '../../src/sim/handModel';

const ASPECT = 4 / 3;

function read(letter: string, pose: Record<string, unknown> = {}) {
  const frame = simulateLetter(letter, { aspect: ASPECT, jitter: 0.0015, ...pose });
  const hand = canonicalize(frame, ASPECT);
  const features = extractFeatures(hand);
  return { hand, features, result: classify(features) };
}

/**
 * J and Z are motion letters: their still handshape is another letter's (J is an I, Z is a
 * pointing index), so they are excluded from the static ranking by design and offered as a
 * motion suggestion instead.
 *
 * These fixtures come from a forward-kinematics hand model, so passing them shows the whole
 * chain (landmarks -> canonicalisation -> features -> rules) is wired correctly. It is NOT
 * evidence of real-world accuracy on a real hand; only the practice page can show that.
 */
const MOTION_LETTERS = ['J', 'Z'];
const STATIC_LETTERS = LETTER_ORDER.filter((letter) => !MOTION_LETTERS.includes(letter));

describe('letter classifier (synthetic fixtures)', () => {
  it('reads every static letter', () => {
    const misses: string[] = [];
    for (const letter of STATIC_LETTERS) {
      const { result } = read(letter);
      if (result.letter !== letter) misses.push(`${letter}->${result.letter}`);
    }
    expect(misses).toEqual([]);
  });

  it('offers J and Z as motion alternatives rather than static letters', () => {
    for (const letter of MOTION_LETTERS) {
      const { result } = read(letter);
      expect(result.ranked.some((r) => r.letter === letter)).toBe(false);
      expect(result.motionSuggestion?.letter).toBe(letter);
    }
    // The I handshape also matches J's starting shape, so I suggests J.
    expect(read('I').result.motionSuggestion?.letter).toBe('J');
  });

  it('reads O and still shows the nearest confusion instead of hiding it', () => {
    // O and E are the closest pair in the alphabet: the fingertips touch the thumb in both.
    // The rule separates them on where the thumb is (O holds it up at fingertip height, E
    // folds it low onto the palm), because finger curvature is identical and cannot help.
    const { result } = read('O');
    expect(result.letter).toBe('O');
    // The near-miss has to remain visible: a single confident number with no alternative is
    // exactly the interface this app is arguing against.
    expect(result.ranked[1]!.score).toBeGreaterThan(0.4);
    expect(result.ranked[1]!.letter).not.toBe('O');
  });

  it('is invariant to where the hand is and how big it is', () => {
    for (const letter of ['A', 'B', 'D', 'L', 'U', 'V', 'W', 'Y'] as const) {
      const base = read(letter).result.letter;
      const moved = read(letter, { cx: ASPECT / 2 + 0.07, cy: 0.5, scale: 0.2 }).result.letter;
      expect({ letter, moved }).toEqual({ letter, moved: base });
    }
  });

  it('is invariant to a moderate hand rotation', () => {
    for (const letter of ['A', 'B', 'D', 'U', 'W', 'Y'] as const) {
      const base = read(letter).result.letter;
      const rotated = read(letter, { rollDeg: 14, yawDeg: 8, pitchDeg: -6 }).result.letter;
      expect({ letter, rotated }).toEqual({ letter, rotated: base });
    }
  });

  it('recognises a left hand exactly like a right hand', () => {
    const misses: string[] = [];
    for (const letter of STATIC_LETTERS) {
      const right = read(letter).result.letter;
      const left = read(letter, { handedness: 'left' }).result.letter;
      if (left !== right) misses.push(`${letter}: ${right} vs ${left}`);
    }
    expect(misses).toEqual([]);
  });

  it('reports palm facing relative to the camera for both hands', () => {
    for (const letter of ['B', 'V'] as const) {
      for (const handedness of ['right', 'left'] as const) {
        const { hand } = read(letter, { handedness });
        expect({ letter, handedness, facing: hand.facing }).toEqual({
          letter,
          handedness,
          facing: 'toward-camera',
        });
      }
    }
  });

  it('explains a miss with the constraints that failed', () => {
    // A hand that is a V but for the fingers being held together.
    const { result } = read('U');
    const vs = result.ranked.find((r) => r.letter === 'V')!;
    expect(vs.failing.map((c) => c.id)).toContain('apart-im');
  });
});
