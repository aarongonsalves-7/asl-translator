---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/ui/TranslateApp.tsx","src/pages/alphabet.astro","src/pages/settings.astro","src/pages/privacy.astro","src/pages/terms.astro","src/pages/404.astro","src/layouts/Base.astro","src/styles/global.css"]
---

# Whole-site redesign

Scope: Translate, Alphabet, Settings, Privacy, Terms and 404. Translate, Alphabet and Settings use Operate mode; supporting information uses Read mode.

Primary job: a beginner attempts a fingerspelling letter and understands the feedback. Preserve recognition, local processing, calibration, camera-free demo and keyboard access.

## Direction contract

THESIS: Learning commons puts an approachable practice workspace in the first viewport, replacing the distant marketing hero and layered legacy themes.

OWN-WORLD: deep teal navigation, pale green page ground, white reading surfaces, warm yellow for a small learning cue. Self-hosted Inter carries the readable type hierarchy. Rectangular controls use 8px corners; work areas use 14px corners and a single border.

STORY: See what the tool does, start a camera or demo, read an explanation, and explore the alphabet when needed. Quiet reference pages share the same navigation and reading measure.

FIRST VIEWPORT: a teal 76px top bar; a left-aligned 44px introduction; a broad camera view with explicit off state and camera/demo buttons, beside a white transcript. Live guidance follows the camera. The signature is a connected recognition path showing find hand, hold letter and add text, with named states and no false completion. On phones the camera precedes the transcript.

FORM: Learning commons, grounded candidate 1, chosen by the user instead of assigned candidate 6; seed:ab914a6f80f27e94. Code-led. Chosen composition: .impeccable/mocks/decision/learning.html. Ordinary indoor daylight motivates the light reading ground; user-selectable dark mode remains available.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Completion

Implemented Learning commons across all six pages. Independent finish review inspected 22 desktop/mobile and state captures; its only material fix was receipt icon consistency. The fix was applied, four affected states recaptured, and the reviewer returned `ship` for that resolved fix. DESIGN.md and .impeccable/design.json now document the built system. Production build passes with zero diagnostics; 60 unit/integration and 20 browser tests pass. The shipping social raster carries its code-source provenance. Superseded local Apple and Animate skills, the Apple stylesheet and obsolete design notes were removed.
