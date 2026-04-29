---
name: TTB Label Verifier
description: Editorial-regulatory verification tool for federal label-compliance reviewers.
colors:
  paper: "oklch(0.985 0.008 85)"
  bone: "oklch(0.965 0.012 85)"
  ledger: "oklch(0.92 0.01 80)"
  rule: "oklch(0.78 0.012 80)"
  ink: "oklch(0.18 0.012 80)"
  graphite: "oklch(0.42 0.011 80)"
  pencil: "oklch(0.58 0.010 80)"
  rust: "oklch(0.55 0.13 40)"
  rust-deep: "oklch(0.45 0.14 40)"
  rust-tint: "oklch(0.96 0.025 50)"
  pass-ink: "oklch(0.42 0.10 145)"
  pass-tint: "oklch(0.965 0.035 145)"
  pass-rule: "oklch(0.78 0.07 145)"
  review-ink: "oklch(0.48 0.12 80)"
  review-tint: "oklch(0.965 0.05 90)"
  review-rule: "oklch(0.80 0.09 85)"
  fail-ink: "oklch(0.42 0.16 25)"
  fail-tint: "oklch(0.965 0.04 25)"
  fail-rule: "oklch(0.78 0.10 25)"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4.2vw, 2.625rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.06em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
rounded:
  none: "0px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "40px"
  "2xl": "64px"
components:
  button-primary:
    backgroundColor: "{colors.rust}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "48px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.rust-deep}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "48px"
    typography: "{typography.body}"
  button-outline-hover:
    backgroundColor: "{colors.bone}"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "48px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "48px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    padding: "24px"
  status-banner-pass:
    backgroundColor: "{colors.pass-tint}"
    textColor: "{colors.pass-ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  status-banner-review:
    backgroundColor: "{colors.review-tint}"
    textColor: "{colors.review-ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  status-banner-fail:
    backgroundColor: "{colors.fail-tint}"
    textColor: "{colors.fail-ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  field-row:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "16px"
  field-row-mismatch:
    backgroundColor: "{colors.fail-tint}"
  field-row-fuzzy:
    backgroundColor: "{colors.review-tint}"
  badge-pass:
    backgroundColor: "{colors.pass-tint}"
    textColor: "{colors.pass-ink}"
    rounded: "{rounded.xs}"
    padding: "4px 10px"
    typography: "{typography.label}"
  badge-review:
    backgroundColor: "{colors.review-tint}"
    textColor: "{colors.review-ink}"
    rounded: "{rounded.xs}"
    padding: "4px 10px"
  badge-fail:
    backgroundColor: "{colors.fail-tint}"
    textColor: "{colors.fail-ink}"
    rounded: "{rounded.xs}"
    padding: "4px 10px"
  nav-link:
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "48px"
    typography: "{typography.body}"
  nav-link-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
---

# Design System: TTB Label Verifier

## 1. Overview

**Creative North Star: "The Marked-Up Filing."**

This is a tool that should look like a printed federal filing being marked up
in real time — not a SaaS dashboard, not a Linear-clone, not a "modernized"
rebrand of a government form. The reviewer is doing the same job they've done
for years (compare label to application, flag mismatches, hand the file back),
and the interface is their evidence kit: a clean cream sheet, ink-black type,
and a single rust-red pen for citations and red-lines. The AI's job is to
read; the reviewer's job is to decide. The visual system enforces that
hierarchy at every level.

The discipline borrowed from editorial publishing is real — typographic
hierarchy, dense-but-legible body text, mono-set citations, dated artifacts —
but it is executed in sans-serif and monospace, never serifs. Cream + ink +
rust is the entire palette of voice; status colors (forest-green, library-
amber, archive-red) are quiet, library-stamp-y, never candy. Borders carry
separation. Shadows are reserved for "this artifact is the result page,
elevated above the form" — and used exactly once.

This system explicitly rejects: AI-bro SaaS gloss (no purple gradients, no
sparkle decoration, no glow), craft-brewery warmth (no kraft-paper textures,
no amber-gradient hero), heavy GovTech compression (no 11px gray tables, no
navy header bars), and editorial pastiche (no Times New Roman, no italic
display serifs, no "old paper" textures). Boring competence first.

**Key Characteristics:**
- Cream-paper surface; ink-black text; rust accent used as the editor's red pen.
- Sans-serif throughout; monospace for diffs, normalized values, and citations.
- 18px body floor; 48px minimum touch height; status communicated by color +
  icon + text simultaneously.
- Borders carry layout; shadows are reserved (one allowed: the result-card lift).
- Restrained motion: state changes only, no choreography, no decoration.
- Editorial discipline (hierarchy, citations, red-lines) executed in a sans
  type system.

## 2. Colors: The Marked-Up Filing Palette

The palette is **Restrained**: a cream-paper neutral spine plus a single rust
accent, with three muted status pairs that never compete with the accent.
Anything saturated, glowing, or candy-bright fails the test.

### Primary

- **Iron-Oxide Rust** (`oklch(0.55 0.13 40)`): the editor's red pen, the only
  accent voice. Used on the primary CTA, the "marked-up" annotation rule on
  red-line diffs, and citation underlines. Never used decoratively, never as
  a fill for body surfaces.
- **Rust Deep** (`oklch(0.45 0.14 40)`): hover and pressed states for the
  primary CTA, citation hover affordances.
- **Rust Tint** (`oklch(0.96 0.025 50)`): a barely-warm cream used as the
  fill behind a marked-up sentence in the warning red-line. Subordinate to
  Rust itself; never replaces it.

### Neutral

- **Paper** (`oklch(0.985 0.008 85)`): the page surface. Warm, off-white,
  with a faint golden bias so it reads as "paper" rather than "screen."
  Never `#fff`. Never a hard cool gray.
- **Bone** (`oklch(0.965 0.012 85)`): secondary surface for inset wells,
  optional-fields disclosures, sample-list backgrounds. One step below Paper.
- **Ledger** (`oklch(0.92 0.01 80)`): default border weight on cards and
  major regions. Warm ash-gray; never blue-gray.
- **Rule** (`oklch(0.78 0.012 80)`): the heavier divider weight used between
  field rows, on input borders, and on outline buttons. The "ruled line" of
  the marked-up filing.
- **Ink** (`oklch(0.18 0.012 80)`): primary text. A near-black with a warm
  bias. Never `#000`.
- **Graphite** (`oklch(0.42 0.011 80)`): secondary text and rationale lines.
- **Pencil** (`oklch(0.58 0.010 80)`): tertiary text, hint copy, placeholder
  values.

### Status

Three muted pairs. Each pair is `ink` (text), `tint` (surface), `rule`
(border) — used in concert. The status palette must always coexist with an
icon and a label; color alone never conveys state.

- **Pass — Forest** (`pass-ink: oklch(0.42 0.10 145)`, `pass-tint: oklch(0.965
  0.035 145)`, `pass-rule: oklch(0.78 0.07 145)`): muted forest-green, library-
  stamp-y. Used on PASS banner, match badge, "OK" indicator dot.
- **Review — Library Amber** (`review-ink: oklch(0.48 0.12 80)`, `review-tint:
  oklch(0.965 0.05 90)`, `review-rule: oklch(0.80 0.09 85)`): warm amber, the
  color of a margin-note in a worn paperback. Used on REVIEW banner, fuzzy-
  match badge, "Match (normalized)" rows.
- **Fail — Archive Red** (`fail-ink: oklch(0.42 0.16 25)`, `fail-tint: oklch(
  0.965 0.04 25)`, `fail-rule: oklch(0.78 0.10 25)`): a desaturated red,
  closer to oxblood than fire-engine. Used on FAIL banner, mismatch badge,
  red-line `<ins>` highlights.

### Named Rules

**The One Pen Rule.** Rust is the editor's pen, and it is the only accent
voice in the system. It appears on: (1) the primary CTA, (2) the "Verify
label" / "Run batch" headline action only, (3) red-line annotation
underlines, and (4) citation links. Anything else that wants rust must justify
why it should sound louder than the page itself. Never use rust as a fill.
Never gradient it. Never combine it with another saturated accent.

**The Cream Floor Rule.** Page surface is `paper`, never `#fff`. Card and
inset surface is `paper` or `bone`, never a third lighter variant invented at
the component level. If a surface needs to feel "lifted," it gets a 1px
`ledger` border and one `shadow-card` — not a brighter fill.

**The Status-Trio Rule.** Every status color must appear with a matching icon
and a matching text label. A green dot alone, a red border alone, an amber
fill alone — all forbidden. The grandmother test applies: color-blind users
must read the same verdict.

## 3. Typography

**Display Font:** Geist (with system-ui, sans-serif fallback).
**Body Font:** Geist (same family — single-family system).
**Mono Font:** Geist Mono (with ui-monospace, SFMono-Regular, monospace fallback).

**Character:** A single sans-serif family carries the entire voice; monospace
is the second voice and is used only where a regulatory document would set
type in monospace — citations, diffs, normalized values, exact-match canonical
text. The pairing is workmanlike, not editorial costume. There are no display
serifs, no script accents, no all-caps decorative type.

### Hierarchy

- **Display** (Geist 700, `clamp(2rem, 4.2vw, 2.625rem)`, line-height 1.08,
  letter-spacing -0.015em): page titles only — "TTB Label Verifier", "How
  this tool works", "Batch verification." One per page.
- **Headline** (Geist 600, 1.5rem / 24px, line-height 1.2): section titles
  — "Application data", "Government health warning", "What the AI does."
- **Title** (Geist 600, 1.125rem / 18px, line-height 1.3): card titles,
  field-row names, badge labels (uppercase variant).
- **Body** (Geist 400, 1.125rem / 18px, line-height 1.6): all paragraphs,
  rationale lines, instructional copy. Max line length 70ch on text-heavy
  pages (`/about`).
- **Label** (Geist 500, 0.75rem / 12px, letter-spacing 0.06em, uppercase):
  field-row column labels ("APPLICATION", "LABEL"), badge text, table
  headers. Tracking widens on uppercase to keep it legible at 12px.
- **Mono** (Geist Mono 400, 0.9375rem / 15px, line-height 1.55): the
  evidentiary voice — extracted values, normalized values, diff text,
  warning-statement quotes, regulation citations (`27 CFR 16.21`).

### Named Rules

**The 18px Floor Rule.** Body type never falls below 18px. The persona is a
73-year-old reviewer in office light; 14px utility text exists for badges and
labels only, and never carries semantic content (it always restates a
neighboring 18px line).

**The Two-Voice Rule.** The system has exactly two type voices: Geist (the
narrator) and Geist Mono (the witness). Mono is reserved for things that the
reviewer would set in monospace if they were marking up the filing by hand —
extracted text, the canonical regulation, the diff. Don't use mono
decoratively for "tech feel."

**The Citation Rule.** Regulation references (e.g. `27 CFR 16.21`) are always
typeset in Mono and may carry a Rust underline. They are the only place rust
appears in body copy.

## 4. Elevation

This system is **flat by default**, with one exception. Borders carry the
visual layout — every card, every field row, every status banner is bounded
by a `ledger` or `rule` border, not a shadow. The page reads as a sequence
of bordered regions on a single sheet of paper.

The exception is the **result card** — the artifact the reviewer is here to
read. It carries a single subtle shadow that makes it feel like a sheet
lifted slightly above the form. Nothing else in the system gets a shadow.

### Shadow Vocabulary

- **Card lift** (`box-shadow: 0 1px 0 oklch(0.92 0.01 80), 0 8px 24px -12px
  oklch(0.18 0.012 80 / 0.10)`): used on the result card and the application-
  data form. Signals "this is the working artifact." A 1px hairline at the
  top edge plus a soft, low-spread shadow underneath. Never adopted by
  smaller components.

### Named Rules

**The Flat Page Rule.** The default surface is flat. If a component wants a
shadow, the answer is "use a border instead" — until you can name a specific
reason it needs to lift off the page. There is exactly one named lift in the
system (`shadow-card`); inventing more is forbidden.

**The Border-Carries-Layout Rule.** Visual separation between regions is
always carried by a 1px `ledger` or `rule` border, never by a tonal step.
A "subtle background variation" between regions is forbidden — it is
illegible at 73-year-old contrast tolerances and reads as "AI made it."

## 5. Components

### Buttons

- **Shape:** 8px rounded corners (`{rounded.md}`). 48px tall always. Horizontal
  padding 24px. No icon-only buttons in primary roles; every primary button
  carries a text label.
- **Primary:** rust fill (`{colors.rust}`), paper text, 1px rust-deep border.
  Used on the form's terminal CTA ("Verify label", "Run batch") and nowhere
  else. One primary button visible per screen.
- **Outline:** paper fill, ink text, 1px rule border. The "Try a sample" /
  "Reset" / "Explain this" affordances. Lower density of attention than primary.
- **Ghost:** paper fill, ink text, no border at rest. Hover lifts to bone fill.
  Used in navigation and inline secondary actions.
- **Hover:** primary deepens to rust-deep over 120ms ease-out; outline hovers
  to bone fill; ghost hovers to bone fill. No transform, no scale, no glow.
- **Focus:** 2px ink outline at 2px offset (`outline-offset: 2px`). Always
  visible; never `outline: none` without a replacement.
- **Pressed:** 1px translate-y on click for primary and outline. Subtle.

### Inputs / Fields

- **Shape:** 8px corners, 48px tall, 14px horizontal padding. Body type (18px).
  Floor enforced — no `h-8` (32px) inputs anywhere; that is a known drift in
  the current code and must be migrated.
- **Style:** paper fill, ink text, 1px rule border. Pencil placeholder.
- **Focus:** border tightens to ink, plus a 3px rust-at-20%-alpha outer glow
  ring. Never a pure rust border (would compete with the CTA).
- **Error:** border shifts to fail-rule, helper text in fail-ink. The error
  message describes what to do, not what failed ("Image too dark — try a
  brighter photo," not "VLM_LOW_CONFIDENCE").
- **Disabled:** 60% opacity; never reduce contrast below 4.5:1.

### Cards / Containers

- **Shape:** 14px rounded (`{rounded.xl}`) for major working surfaces (form,
  result, batch table); 8px (`{rounded.md}`) for inner units (field rows,
  status badges' container).
- **Background:** paper, with bone reserved for inset wells (the optional-
  fields disclosure, the sample-list panel).
- **Border:** 1px ledger by default; never use a colored side-stripe (the
  "side-stripe alert" pattern is banned).
- **Padding:** 24px on the working surface; 16px on inner units.
- **Shadow:** none, except `shadow-card` on the result and form artifacts.

### Status Banner (signature component)

The PASS / REVIEW / FAIL banner that opens the result section. The banner is
the marquee of the marked-up filing.

- **Shape:** 14px corners, 24px padding, 2px border in the matching status-rule
  color.
- **Layout:** large status icon (40px) at left, three text rows at right:
  status word in headline weight + uppercase tracking, subtitle in body, meta
  ("Verified in 2.4 s") in label color.
- **Color assignment:** status-tint surface, status-rule border, status-ink
  text. Never invert. Never gradient. Never replace the status word with an
  emoji.
- **Slow tag:** when `>5s`, a small "Slow" tag appears in the meta line — a
  paper-fill chip with a clock icon. This is the prior-vendor warning shadow:
  the system tells on itself.

### Field Row (signature component)

The receipts-bearing row of the verification artifact. One row per field;
three regions per row.

- **Shape:** 8px corners, 16px padding, 1px ledger border on match rows.
  Mismatch rows shift the surface to fail-tint with a fail-rule border. Fuzzy-
  match (`Match (normalized)`) rows shift to review-tint with a review-rule
  border.
- **Region 1 (left, 16rem fixed):** field name in title weight, rationale in
  graphite body, optional "Reviewed by Sonnet" pill if escalated. The
  rationale is the heart of the row — never empty.
- **Region 2 (center, flexes):** two stacked value blocks ("APPLICATION" /
  "LABEL"), each with a uppercase 12px label and the value in mono. Side-by-
  side at ≥sm breakpoint, stacked below.
- **Region 3 (right, auto):** status badge with icon + label.
- **The Sonnet pill:** when present, sits in region 1 below the rationale.
  The "AI did extra work here" affordance. Quiet — no glow, no sparkle. Use
  a single neutral mark (small dot, single-line label "Reviewed by Sonnet").
  No purple. No violet. (Current code uses violet — it must migrate.)

### Warning Red-line (signature component)

The Government Health Warning verification — the most consequential artifact.
Two side-by-side mono blocks (canonical / extracted), with a `diffWords` overlay.

- **Shape:** 8px corners, 20px padding, 1px ledger border. Two columns at
  ≥lg, stacked below.
- **Header:** section title in title weight + a status pill ("Compliant" /
  "Non-compliant") on the right.
- **Block:** uppercase label ("CANONICAL (27 CFR 16.21)" / "READ FROM LABEL"),
  then the warning text typeset in mono on a bone surface, 8px corners.
- **Diff:** added text (in the extracted version vs canonical) shown with a
  fail-tint background and `text-decoration: none` (override `<ins>` default).
  Removed text shown with a review-tint background. The visual reads like a
  pencil-and-eraser markup, not a code-review syntax highlighter.
- **Flag rows:** "Header is ALL CAPS" and "Header is bold" each get their own
  line with a status dot (pass-ink / fail-ink) + label + verdict word ("OK"
  / "Failed"). Color + icon + text — the status-trio rule applies.

### Navigation

- **Style:** horizontal nav at top of the page (`Single | Batch | About`).
  Each link is a 48px-tall ghost button.
- **Default:** ink text on paper, no border, no fill.
- **Hover:** bone fill, ink text.
- **Active:** ink fill, paper text. The active link reads as a stamped
  cartouche on the page — a single inverted block in an otherwise pale header.
- **Mobile:** stacks below the wordmark, full-width links, same height.

### Sample / Sandbox affordance

The "Try a sample" button + the dropdown of sample labels. Listed for
completeness — it is a low-prominence affordance.

- **Style:** outline button. Sparkle icon in the trigger is fine because it
  literally signals "synthetic test data," not "AI magic."
- **Sample list panel:** bone surface, 8px corners, 12px padding, each
  sample is a single-line button with the label name + an uppercase
  "expected: PASS / REVIEW / FAIL" tag in label-size pencil text.

## 6. Do's and Don'ts

### Do:
- **Do** use `paper` (`oklch(0.985 0.008 85)`) for every page surface. Never `#fff`.
- **Do** set body type at 18px and headings at ≥1.25 ratio steps. The 18px
  floor is a promise to a 73-year-old reviewer.
- **Do** make every interactive target ≥48px tall, including inputs. The
  current `h-8` (32px) inputs from `components/ui/input.tsx` are a drift and
  must be migrated to 48px.
- **Do** show the receipts. Every field row carries application value, label
  value, and the rationale that produced the verdict — in mono, side-by-side.
- **Do** set citations (e.g. `27 CFR 16.21`) in Geist Mono and let them
  carry a rust underline. That is the citation rule.
- **Do** use color + icon + text together for every status. A reviewer with
  red-green color blindness must read the same verdict.
- **Do** keep motion to state-change feedback (120-180ms ease-out). Borders
  lighten, surfaces tint, focus rings appear. Nothing translates more than
  1px. Nothing scales. Nothing animates entrances.

### Don't:
- **Don't** use `#000` or `#fff` anywhere. Pure black is dead; pure white is
  cold. Every neutral is tinted toward the warm spine of the palette.
- **Don't** use Times New Roman, Georgia, or any serif body type. Editorial
  *discipline* in sans-serif — never editorial costume in serifs.
- **Don't** introduce a third accent color. Rust is the editor's pen and it
  is the only one. Violet, blue, teal, purple — all forbidden as accents.
  The current `violet-300 / violet-50 / violet-900` "Reviewed by Sonnet"
  badge is a drift and must migrate to a neutral mark.
- **Don't** use side-stripe borders (`border-left: 4px solid`) on cards,
  callouts, or alerts. Forbidden. Use a full border + status-tint surface
  instead.
- **Don't** wrap content in nested cards. Nested cards are always wrong. If
  a region needs sub-grouping, use border + spacing, not a second card.
- **Don't** use shadows on individual list rows or buttons. Shadow is reserved
  for the result and form artifacts only — the named `shadow-card` lift.
- **Don't** ship gradient text or `background-clip: text` decorative type.
  Forbidden. Hierarchy is carried by weight and size, not by color spectacle.
- **Don't** use sparkle icons (✨, "Sparkles" from lucide) decoratively to
  signal "AI." We have a literal "Reviewed by Sonnet" affordance for that;
  decorative sparkle icons are the AI-bro SaaS tell.
- **Don't** style the result with confetti, "Looks great!" toasts, or
  exclamation-pointed copy. The reviewer is making a federal compliance
  decision. Voice is plainspoken: "Brand name matches" not "Looks like a
  match!"
- **Don't** put a "Powered by AI" badge anywhere in the product. The /about
  page already explains what the AI does and doesn't do; that is sufficient.
- **Don't** introduce a dark mode without revisiting PRODUCT.md. The persona
  is a TTB reviewer in office light; a dark-mode default fails the scene
  test and the grandmother test simultaneously. The current `.dark` block in
  `globals.css` is unused legacy and should be removed.
- **Don't** use raw Tailwind palette names (`green-700`, `red-200`, `slate-50`,
  `violet-300`) in new code. Migrate to the named tokens above. The current
  components carry this drift; future work should pull from the semantic
  layer.
