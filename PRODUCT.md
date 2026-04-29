# Product

## Register

product

## Users

TTB Label Specialists — federal compliance reviewers who triage alcohol-label
applications against COLA form data. About 47 agents handle ~150,000 submissions
a year. The team spans the full tech-comfort spectrum: roughly half are over 50;
some, like Dave Morrison (28-year veteran), still print their emails. The
persona floor is intentionally Sarah Chen's 73-year-old mother — someone who
just learned to video-call her grandkids. The audience is also skeptical: a
prior scanning-vendor pilot failed because results took 30-40 seconds, and
agents went back to eyeballing labels.

Job-to-be-done: in under 5 seconds, surface every mismatch between a label
image and the application data — including the exact-match Government Health
Warning — with enough plain-English evidence that a reviewer can hand the file
back to the applicant without doing follow-up research.

Named stakeholders to optimize for, from the brief:
- Sarah Chen (Deputy Director) — throughput; batch matters.
- Dave Morrison (28 years) — the "STONE'S THROW vs Stone's Throw" judgment case.
- Jenny Park (8 months) — warning-statement verification must be airtight.
- Janet (Seattle office) — batch upload of 200-300 labels at once.

## Product Purpose

A standalone, AI-assisted verification prototype that compares a single label
image (or a batch of them) to its COLA application fields and produces a
PASS / REVIEW / FAIL verdict with field-level evidence. The tool reads the
label; deterministic server logic — never the LLM — decides the verdict. The
human reviewer is always the final judge.

Success looks like: an agent reaches a confident decision in under five
seconds, sees exactly why each field passed or failed, and never wonders
whether the AI made the call.

## Brand Personality

Three words: **regulator-grade · evidentiary · unhurried.**

- **Regulator-grade** — looks like a tool TTB itself would build, not a startup
  pitching to TTB. Boring competence first; nothing that signals "AI-powered
  hype" or modernization-theater.
- **Evidentiary** — every verdict shows its receipts: the normalized values
  it compared, the diff it produced, the canonical text it matched against,
  the regulation it cites (e.g. 27 CFR 16.21). The reviewer is the
  decision-maker, not the AI.
- **Unhurried** — fast under the hood, calm on the surface. No bouncing
  animations, no sparkle, no "AI is thinking…" theatre. State changes are
  crisp and definitive, not animated into existence.

Voice: plainspoken, third-person, never breathless. "Brand name matches" not
"Looks like a match!". Citations in monospace.

## Anti-references

What this should explicitly NOT look like:

- **Craft-brewery / D2C beverage marketing.** No warm-amber gradients, no
  kraft-paper textures, no "discover your next pour" energy. We are reviewing
  beverages, not selling them.
- **AI-bro SaaS.** No purple-to-pink gradients, no glow effects, no decorative
  sparkle icons, no "Powered by AI" badges, no chat-bubble metaphors.
- **Heavy GovTech.** No 11px gray tables, no FOIA-form density, no navy header
  bars, no "official seal in the corner" theatre.
- **Linear/Vercel ultra-dark monochrome.** We are not impressing engineers.
  Readability and legibility outrank aesthetic minimalism.
- **Editorial pastiche via serifs.** We want editorial *discipline* (hierarchy,
  citations, red-lines) executed in sans-serif. Times New Roman et al. are out.

## Design Principles

1. **Show your work.** Every verdict carries its evidence. Don't say "Brand
   name: PASS" — show the application value, the extracted value, the
   normalization that made them equal. For failures, show the diff and the
   rule that was violated. The interface is forensic, not declarative.

2. **Earn trust through restraint.** The audience has been burned by
   "modernization" before. Boring competence first. No decorative motion, no
   AI-coded chrome. Delight, if any, lives in result clarity — never in
   animation or visual flourish.

3. **The grandmother test.** If a 73-year-old who just learned to video-call
   can't figure it out in 30 seconds, simplify. 18px body floor, ≥48px touch
   targets, status communicated by color + icon + text always (never color
   alone). Single primary action visible per screen.

4. **Pace the perception of speed.** <5s is the hard ceiling and the reason
   the prior vendor failed. The UI should feel definitive when results land —
   crisp state changes, not fade-in-up. Loading states are explicit and
   plainly worded ("Reading label…", "Verifying warning…"), not abstract
   spinners.

5. **Document-grade typography.** Type hierarchy carries the work. Treat the
   result view like a marked-up regulatory filing: dated, sourced, citable.
   Sans-serif throughout for readability; monospace for normalized values,
   diffs, and regulatory citations. Editorial spirit, not editorial costume.

## Accessibility & Inclusion

- Target WCAG 2.2 AA across the entire product surface.
- Half the user base is over 50; assume bifocals and ambient office lighting.
  Body floor is 18px, headings scale with ≥1.25 ratio.
- All interactive targets ≥48px (override shadcn defaults where needed).
- Status conveyed by color + icon + text simultaneously — never color alone.
  Color-blind safe pairings (green PASS / amber REVIEW / red FAIL with
  distinct iconography for each).
- Respect `prefers-reduced-motion` by default. The design doesn't lean on
  motion, so this is a near-no-op, but it must be honored.
- Forms: explicit labels, never placeholder-as-label. Error text describes
  what to do, not what failed technically ("Image too dark — try a brighter
  photo." not "VLM_LOW_CONFIDENCE").
- Keyboard: full operability without a pointer. Focus rings visible at all
  times; never `outline: none` without a replacement.
