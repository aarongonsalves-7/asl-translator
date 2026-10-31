# ASL Translator

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Beginners practicing ASL fingerspelling are the primary audience, confirmed by the project owner. They need to explore the alphabet, try a handshape, and understand how to adjust it when recognition hesitates.

## Product Purpose

Help beginners practice individual ASL letters using a webcam and read recognized letters as text. Success means a learner can attempt a letter, understand the recognition feedback, and make another informed attempt.

The product attempts A–Z fingerspelling, one hand and one letter at a time. It does not translate full ASL, words, grammar, or conversation, and does not replace a qualified interpreter or instruction from a Deaf teacher.

## Positioning

Recognition is explainable: a stage-based pipeline describes what the camera can see, why it is waiting, and what the learner can do next. Browser-based hand tracking and geometric classification run on the user's device, without an account, backend recognition service, or API keys.

## Operating Context

- Browse the alphabet and inspect handshape previews; J and Z include user-controlled motion previews.
- Start the camera explicitly, allow browser camera permission, keep the whole hand in view in good light, form a letter, and hold it steady. Release between repeated letters.
- Read stage guidance, ranked candidates, and observed hand features to understand a result or refusal.
- Use the synthetic HELLO demo to explore the same recognition pipeline without camera access.
- Add spaces, undo, clear, and copy the resulting text. Adjust recognition thresholds and timing in Settings.
- Camera access requires HTTPS or localhost. After required assets load, recognition can continue in the open page without a network connection; offline reload is not guaranteed.

## Capabilities and Constraints

The owner confirmed these durable commitments: browser-only processing, no accounts or uploads, individual A–Z letters rather than full ASL translation, and explanations when recognition hesitates.

Current implementation details:

- Astro static pages with React islands use MediaPipe HandLandmarker and geometric letter rules. Recognition assets are served locally with the app.
- Letters commit after readability, confidence, margin, and hold checks. J and Z require a matching movement rather than a still handshape.
- Lighting, occlusion, framing, and signer variation affect recognition. Scores indicate constraint matches, not validated probabilities or measured real-world accuracy.
- Transcript and commit history remain in memory. Theme and calibration preferences persist in localStorage.
- Optional recognition samples download tracking points and observed results locally for debugging; no camera video is saved or uploaded.

## Brand Commitments

The existing product name is ASL Translator. Describe its fingerspelling scope explicitly so the name does not imply full-language translation. Guidance should explain the current observation and a useful next action in plain language.

## Evidence on Hand

- `README.md`: product scope, architecture, demo workflow, known recognition limits, and historical validation notes.
- `src/pipeline/` and `src/classify/`: recognition stages, geometric rules, and coaching behavior.
- `src/sim/handModel.ts`: synthetic alphabet fixtures supporting the demo and pipeline checks.
- `src/ui/AlphabetPreview.tsx`: educational handshape and motion previews.
- `e2e/`: browser regression checks; synthetic fixtures and automated camera checks do not establish real-signer accuracy.
- `docs/production-readiness.md`: deployment prerequisites and unresolved operator/hosting decisions. Public origin, operator details, hosting setup, and release review remain open unless separately confirmed.

No real-signer accuracy benchmark is established by the available project evidence. Do not invent accuracy claims, endorsements, testimonials, or release approvals.

## Product Principles

1. Help beginners learn from each attempt through clear observations and actionable guidance.
2. Keep camera processing and recognition on the user's device, without accounts or uploads.
3. Explain uncertainty and waiting rather than presenting an unexplained ready state or premature result.
4. Preserve the distinction between individual fingerspelling practice and full ASL interpretation.
5. Let people explore the alphabet and demo before granting camera access.

## Accessibility & Inclusion

Preserve the existing keyboard access, visible focus, text accompanying recognition status and color, and reduced-motion support. Keep educational motion user-controlled. Camera-free exploration and the demo provide an entry point without camera permission. The project does not establish WCAG certification or validation with Deaf learners; additional audience-specific requirements remain open.
