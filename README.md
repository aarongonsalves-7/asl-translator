# ASL Translator

[▶ Watch the launch video](https://github.com/aarongonsalves-7/asl-translator/raw/refs/heads/main/brag-output/brag.mp4)

Fingerspell ASL letters to your webcam and read them back as text. Everything — camera capture,
hand tracking, classification — runs in the browser. No account, no server, no API keys.

The point of this project is not just "recognise a letter". It is the **stage machine**: at every
moment the app says what it can see (*"hand is small in frame"*, *"hold steady — H, 0.4s to go"*,
*"A and S are both fists; A keeps the thumb alongside"*), instead of the usual "Camera On" /
"Ready" that tells you nothing about why a letter was not added.

## What it does and does not do

- **Does:** recognise the 26 ASL fingerspelling handshapes, one hand at a time, and commit a
  letter only after you hold it. Explains every refusal. Works offline.
- **Does not:** understand signs, words or grammar. It is not a substitute for a qualified ASL
  interpreter, and it is not a substitute for learning the alphabet from a Deaf teacher.

## Free, zero-cost stack

| Piece | Choice | Cost |
|---|---|---|
| Framework | Astro 7 + React 19, static output | £0 |
| Hand tracking | MediaPipe `HandLandmarker` (Tasks Vision), wasm + model **vendored** into `public/` | £0 |
| Classification | Our own geometric rules over 40+ landmark features | £0 |
| Hosting | Any static host — Vercel Hobby, Cloudflare Pages, GitHub Pages | £0 |
| Backend, database, API keys | None exist | £0 |

Nothing is fetched from a CDN at runtime: `npm run assets` copies the wasm runtime and downloads
the 7.8 MB model into `public/`, both gitignored. After the first load the app works with the
network off.

**HTTPS is mandatory, not optional** — browsers refuse camera access on plain `http://` (except
`localhost`). Every Vercel/Cloudflare/GitHub Pages deployment gives you HTTPS. Note that Vercel's
Hobby tier is not licensed for commercial use.

## Run it

```bash
npm install
npm run assets    # copy MediaPipe wasm + download the model (once)
npm run dev       # http://localhost:4321
```

```bash
npm run build      # astro check + static build to dist/
npm run preview    # serve the build on http://127.0.0.1:4173
npm test           # 40 unit + integration tests (vitest)
npm run e2e        # 9 browser tests (needs `npm run e2e:install` once)
npm run typecheck
```

No camera? Click **Try the demo** — it replays a synthetic hand spelling `HELLO` through the exact
same pipeline (smoothing, hold, commit, receipts), so you can see the whole stage machine work
without granting anything.

## Architecture

```
camera frame ─┐
demo frame ───┴─▶ FrameSource ─▶ canonicalise ─▶ features ─▶ classify ─▶ engine ─▶ React
                (sources.ts)   (landmarks.ts)  (features.ts) (letters.ts) (engine.ts)
```

| Path | Responsibility |
|---|---|
| `src/vision/landmarks.ts` | Normalise MediaPipe's 21 points into a palm frame: translation, rotation, scale and hand-size invariant. Left and right hands produce the same features. |
| `src/classify/features.ts` | 40+ interpretable measurements: per-finger extension and bend, spread, thumb abduction/flex/across, fingertip contact, pointing direction, crossing. |
| `src/classify/letters.ts` | The A–Z rule table — each letter is a weighted list of soft constraints with plain-language labels, used both as the scoring function and as the UI copy. |
| `src/classify/classifier.ts` | Weighted geometric mean per letter, ranked list, failing constraints, and coaching for the confusable pairs. |
| `src/pipeline/engine.ts` | EMA smoothing, readability gate, hold-to-commit, one-letter-per-hold latching, commit receipts, J/Z trajectory gating, gesture safety margin, stage derivation. |
| `src/pipeline/motion.ts` | Resamples a fingertip path and matches it against the J and Z templates. |
| `src/pipeline/stages.ts` | Every stage's headline, explanation and the one action that moves it forward. |
| `src/vision/sources.ts` | `LiveSource` (camera + tracker) and `DemoSource` (synthetic frames) behind one interface. |
| `src/ui/` | Translate page, stage banner, candidates, "what I see", output + receipts, settings. |
| `src/styles/global.css` | The design system: tokens and page architecture taken from `DESIGN.md` — a 64px canvas nav, off-white bands, editorial serif display, ink-pill CTAs and pastel atmospheric gradient orbs. Inter and EB Garamond are self-hosted so no third-party font request is made. |
| `src/sim/handModel.ts` | Forward-kinematics hand model: 26 letter shapes from joint angles. Gives deterministic fixtures and powers demo mode. |

Two design decisions worth knowing:

1. **Confidence is the constraint-match score, not a softmax probability.** A softmax is diluted
   by the number of near-misses, so a clean match reads as 55% and nothing ever commits. The
   number shown is "how well does this hand satisfy this letter's rules".
2. **J and Z never come from a still frame.** Their handshapes belong to I and to a pointing
   index, so a static classifier would either hide them or steal I. They are scored, offered as
   suggestions, and only the trajectory matcher can commit them.

## Verification

Run on 26 October 2026 on Windows with Node 22.

- **40 unit + integration tests pass** (`npm test`): classifier fixtures, invariance to position,
  size, rotation and left/right hand; every static letter committing through the whole pipeline;
  smoothing, hold, cooldown, gesture safety, J/Z tracing, stage copy; settings sanitising;
  and the React page driven with a synthetic 30 fps clock.
- **9 Playwright tests pass** (`npm run e2e`) against the production build: demo spelling `HELLO`
  in a real browser, camera-denied narration, loading the **vendored model with a real (fake
  device) camera stream**, alphabet page, settings persistence across reload, phone-width
  stacking, dark mode, and the shell geometry itself (64px canvas nav, off-white bands,
  editorial serif hero, ink-pill CTA).
- **25 of 25 still letters commit** at default settings from synthetic fixtures (J and Z are
  motion, see above). This is a wiring test, not an accuracy claim: the fixtures come from our
  own forward-kinematics model.

### What that does *not* prove

Synthetic fixtures are clean, centred, unoccluded and perfectly lit. Real-video accuracy will be
lower — published comparisons of hand-landmark ASL classifiers put in-the-wild still-letter
accuracy far below the 99%+ seen on curated photo datasets. The honest way to close that gap is
to calibrate on your own hand: the Settings page tunes hold time, confidence, margin, response
speed and cooldown, and those numbers are the difference between "commits too early" and "never
commits".

## Known limits

- **One hand, one letter at a time.** No two-handed signs, no words, no grammar.
- **O is the hardest letter.** O and T are separated only by where the thumb tip sits; the app
  commits O but with the smallest margin in the alphabet. If it hesitates, the candidate list
  shows T as the runner-up.
- **J and Z need the trace.** Holding their handshape still shows the trace prompt forever, by
  design — there is no still-frame shortcut.
- **Downward-pointing letters** (P, Q) need the whole hand in frame; the gate will say so rather
  than guess.
- **Lighting and occlusion are not mitigated.** A backlit hand, or one whose fingers overlap the
  palm from the camera's point of view, reads as different finger states. "What I see" shows the
  raw read so this is visible rather than mysterious.
- **No recording or history export.** Committed text is in memory only; nothing is stored except
  the calibration settings (localStorage, this device only).

## Next step for accuracy

Collect labelled samples from the app itself and train a classifier with MediaPipe Model Maker,
loaded behind the same `classify()` interface — the geometric engine stays as the explainable
fallback, and the UI keeps working unchanged. That is the only path that learns *your* hand
rather than someone else's photographs.
