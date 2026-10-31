---
name: ASL Translator
description: Learning commons for approachable, on-device fingerspelling practice.
colors:
  canvas: "#f0f6f2"
  canvas-soft: "#e4efe8"
  surface-card: "#ffffff"
  surface-strong: "#d8e9df"
  ink: "#13332f"
  body: "#365d54"
  muted: "#527067"
  primary: "#075e58"
  primary-active: "#034b46"
  on-primary: "#ffffff"
  hairline: "#cbded2"
  hairline-strong: "#8da99b"
  highlight: "#f4db68"
  camera: "#13332f"
  camera-text: "#f2f8f3"
  camera-muted: "#c3d8cf"
  good: "#176a43"
  attention: "#8a5100"
  error: "#b02c37"
  dark-canvas: "#101f1b"
  dark-canvas-soft: "#172c25"
  dark-surface-card: "#1d342c"
  dark-surface-strong: "#284b3e"
  dark-ink: "#ecf5ef"
  dark-body: "#c1d6c9"
  dark-muted: "#a8c6b5"
  dark-primary: "#9cddc1"
  dark-primary-active: "#b8ead5"
  dark-on-primary: "#12372a"
  dark-hairline: "#385c49"
  dark-hairline-strong: "#729780"
  dark-camera: "#0b211a"
  dark-good: "#94d9ac"
  dark-attention: "#f1cd7d"
  dark-error: "#ffabb0"
typography:
  display:
    fontFamily: "InterVar, Segoe UI, sans-serif"
    fontSize: "44px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "InterVar, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "InterVar, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "InterVar, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  lead:
    fontFamily: "InterVar, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: "InterVar, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: "InterVar, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.35
rounded:
  tag: "4px"
  compact: "6px"
  control: "8px"
  group: "12px"
  workarea: "14px"
spacing:
  xs: "8px"
  sm: "12px"
  base: "16px"
  md: "20px"
  lg: "24px"
  workspace: "28px"
  xl: "32px"
  section-compact: "40px"
  wide: "48px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-active}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-quiet:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  select:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.compact}"
    padding: "8px 12px"
  transcript:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.workarea}"
    padding: "26px"
  letter-card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.workarea}"
    padding: "20px"
  motion-tag:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.primary}"
    rounded: "{rounded.tag}"
    padding: "4px 8px"
---

# Design System: ASL Translator

## Overview

**Creative North Star: "Learning commons"**

An approachable practice tool with the calm of an indoor daylight learning space. Deep teal navigation, green-tinted reading grounds and clear work surfaces give the interface a recognizable home. Direct, encouraging language makes room for a beginner to try, inspect feedback and try again.

The system puts useful controls and readable observations first. Its personality comes from color, measured typography, procedural hand illustrations and connected recognition feedback. Dark mode keeps the same hierarchy with green-toned surfaces. The product name travels with a clear individual-fingerspelling scope.

**Key Characteristics:**

- Pale green grounds and a deep teal navigation anchor.
- One self-hosted variable sans family with a compact, readable hierarchy.
- Bordered work areas, rectangular controls and restrained depth.
- Visible, truthful recognition states and user-controlled educational motion.

## Colors

The palette pairs garden-green neutrals with teal actions and a small warm yellow learning cue. The frontmatter records light primitives and their implemented dark counterparts; `src/styles/global.css` binds these to theme-aware CSS properties.

### Primary

- **Learning Teal** (`primary`, `primary-active`): actions, links, selected recognition steps and native form accents. Navigation retains its deep teal background in both themes.
- **Warm Highlight** (`highlight`): brand mark, idle camera illustration, hold progress and navigation focus/active cues.

### Neutral

- **Daylight Ground** (`canvas`, `canvas-soft`): page and alternating content bands.
- **Reading Surface** (`surface-card`, `surface-strong`): transcript, alphabet and settings work areas; quieter groups and controls.
- **Green Ink** (`ink`, `body`, `muted`): headings, explanation and secondary information. CSS `body-strong` aliases ink; `muted-soft` aliases muted in each theme.
- **Green Hairlines** (`hairline`, `hairline-strong`): divisions and stronger control outlines.
- **Camera Field** (`camera`, `camera-text`, `camera-muted`): the dark viewing area stays distinct from reading surfaces.
- **On Action** (`on-primary`): text against action fills; changes with the dark theme's lighter primary.

Success, attention and error colors identify recognition tone alongside explanatory text. Dark variants preserve those roles. Camera text, camera secondary text and warm highlight remain unchanged in dark mode. Tonal ramps in the sidecar are illustrative swatch metadata, not additional shipping tokens.

**The Named State Rule.** Color supports a named observation or action; it never supplies recognition meaning by itself.

## Typography

**Display Font:** self-hosted `InterVar`, with `Segoe UI`, sans-serif fallbacks.
**Body Font:** the same stack. The variable font is served from `/fonts/inter-latin.woff2`, supports weights 100–900, and uses `font-display: swap`.

The single family keeps reading and operation connected. Headings use medium emphasis and tight tracking; body copy remains open and plainly spoken.

### Hierarchy

- **Display:** the frontmatter display role introduces pages and becomes 32px at the phone breakpoint. Ordinary h1 uses 1.2 line height; display classes use 1.12.
- **Headline / Title:** section and component headings. Secondary display uses 30px, becoming 26px on phones. The learning invitation uses 36px, becoming 30px.
- **Body / Lead:** default prose and introduction. Lead becomes 16px on phones and caps at 65–68ch; general prose caps at 70ch.
- **Caption / Button:** secondary copy and actions. Compact metadata uses 12–13px and tabular numerals where values change.
- **Transcript:** recognized text uses 36px / 1.3 at weight 500 and wraps long output. Its empty-state title uses 28px, becoming 24px on phones.

**The One Family Rule.** Use InterVar across display, reading and controls; reserve the existing monospace stack for inline code.

## Layout

The container caps at 1280px including horizontal padding. Desktop gutters are 40px, reducing to 28px at 1050px, 20px at 640px and 16px below 360px. Standard sections use 64px vertical padding, reducing to 40px on phones; practice entry spacing is tighter.

Desktop practice pairs camera and transcript at 1.55:1 with a 28px gap, reducing to 1.35:1 and 24px at 1050px. At 800px it stacks camera first, then transcript. The idle camera is 16:9, becoming 4:3 at 640px; active camera/demo proportions follow their actual aspect ratio.

Alphabet cards run four columns, three at 1050px, two at 800px, and one below 360px. Settings uses a 1.7:1 working area and explanation column, stacking at 800px. Learning and FAQ sections also stack there. Legal reading caps at 820px. Footer uses two desktop columns with a full-width information row, then one column on phones.

Navigation is sticky, 76px high and 68px on phones. At 640px the main links become an expandable panel. The phone return-to-translator action sits after the footer in normal document flow. Scroll offsets account for navigation.

## Elevation & Depth

The system is flat: tonal surfaces, a single border and whitespace distinguish regions. There are no floating card shadows or atmospheric gradients. Navigation selection uses a small inset underline shadow as a state indicator, not elevation. Outline focus uses a 3px primary ring with 4px offset; navigation uses warm highlight for contrast.

**The Flat Workarea Rule.** Separate work areas with surface tone and a hairline rather than decorative elevation.

## Shapes

Controls use gently curved corners; work areas are a little softer. Use the frontmatter control and workarea radii for their respective roles. Compact tags and selectors use smaller steps; recognition paths and control groups use the group radius. Circular dots and numbered path marks communicate state and sequence rather than defining button silhouettes.

## Components

### Buttons

Primary controls are teal; ghost controls have a stronger hairline; quiet controls use the stronger surface. Shared buttons have a 46px minimum height, 1px border and frontmatter padding/type. Hover changes background or border over 160ms with the shared ease-out curve. Native disabled controls use 0.45 opacity and a not-allowed cursor. Focus follows the global ring; there is no separate visual press effect. Text controls retain visible labels alongside outline SVG icons.

### Cards / Containers

Transcript, letter and primary settings cards use a reading surface, one hairline and workarea corners. Transcript has 26px desktop padding, reducing to 22px, and a minimum height stepping from 460px to 400px to 320px. Letter cards use 20px padding, becoming 16px on phones. The settings working card uses 30px, becoming 22px on phones. Receipts use soft ground, compact corners and an SVG action symbol.

### Inputs / Fields

Keep sliders native, full-width with a 44px minimum interaction height and primary accent; alphabet inspection sliders use 120px width. Settings sliders pair label, tabular value, help text and `aria-valuetext`. Checkboxes remain native, 22px square inside a 48px by 44px target. Selects use reading surfaces, stronger borders and a 44px minimum height. Preserve browser keyboard and focus behavior.

### Navigation

The white-on-teal bar carries a yellow line mark, three labeled destinations and theme control. Current links use `aria-current="page"`, translucent fill and yellow inset underline. Hover uses a subtler translucent fill. The phone toggle exposes `aria-expanded` and `aria-controls`; navigation or Escape closes the menu. Theme control names the next theme. Skip link appears on focus. Footer destinations reuse the pattern with reading-surface colors.

### Recognition Workspace

Camera has explicit off/loading/error states, labeled live/demo states and a camera-free demo. The connected four-step path names Find your hand, Read the shape, Hold a letter and Add to text. Current/done styling follows the current recognition attempt and resets with it; it is not a learner achievement score. Status text explains waiting and next actions. Hold/tracing bars use transform scale feedback with a 90ms linear transition.

Transcript pairs large text with commit metadata, a receipt and edit controls. Copy reports success or failure through a status region. Empty copy and disabled editing stay useful before recognition begins. Space, Backspace and Escape shortcuts defer to focused interactive controls.

### Alphabet and Disclosure

Alphabet cards show procedural landmark SVGs, fingertips, formation guidance and a small Motion tag for J/Z. Motion starts through Play, can pause, and can be scrubbed with a native range. These are approximate inspection previews. FAQ uses native `details`/`summary`, divider rows and browser disclosure behavior.

**The Purposeful Motion Rule.** Motion communicates recognition progress or explicitly requested educational movement. Reduced-motion preference disables smooth scrolling and reduces CSS animation/transition duration; educational playback remains user-controlled.

## Do's and Don'ts

### Do:

- **Do** use theme-aware green surfaces and the self-hosted InterVar stack.
- **Do** preserve clear labels, visible keyboard focus and native form/disclosure behavior.
- **Do** show observation, uncertainty and a useful next action alongside recognition color.
- **Do** use inline outline SVG icons with surrounding text labels.
- **Do** preserve active feed proportions and put camera before output on narrow screens.

### Don't:

- **Don't** restore the former serif, pill-button, gradient-orb or layered legacy theme authority.
- **Don't** present procedural previews or constraint scores as validated linguistic or accuracy evidence.
- **Don't** add decorative entrance, idle or icon animation to the practice workspace.
- **Don't** turn recognition steps into persistent completion badges or cover phone content with a fixed footer action.
