# PRD — AI-Powered Alcohol Label Verification App

**Date:** 2026-04-27
**Mode:** Greenfield take-home prototype
**Total budget:** ~21h focused work over 2-3 days
**Companion docs:** `presearch.md` (decisions), `CLAUDE.md` (conventions)

---

## Build priority order

The brief is emphatic: **"working core application with clean code is preferred over ambitious but incomplete features."** Every phase up to and including Phase 4 must produce a deployable app. STRETCH innovations sit in Phase 6.

```
Phase 1 (Scaffold + deploy + warmup)        ~2h
  └── Phase 2 (Single-label verifier core)  ~5h    ← MVP DEMO-READY
       └── Phase 3 (Senior-friendly UI)     ~3h
            └── Phase 4 (Hardening)         ~2h    ← shippable here
                 └── Phase 5 (Batch mode)   ~5h    ← FULL DEMO-READY
                      └── Phase 6 (Stretch) ~3h    ← time-permitting
                           └── Phase 7 (README + Writeup) ~2h
```

---

## Phase 1: Scaffold + Deploy + Warmup

**Goal:** Empty Next.js app deployed to Vercel with a working `/api/warm` endpoint and the lint/test/typecheck pipeline green.
**Depends on:** Nothing.
**Estimated effort:** ~2h.

### Requirements
- [ ] `bun create next-app` (Next.js 16, App Router, TS, Tailwind v4)
- [ ] `bunx shadcn@latest init` and add: button, card, input, form, dialog, sonner, table, badge, tabs
- [ ] Tailwind v4 config: 18px base font, slate-50/900 high-contrast palette
- [ ] Override shadcn Button default size: `h-12 px-6 text-base`
- [ ] Biome installed + configured (replace ESLint/Prettier)
- [ ] Vitest installed
- [ ] Zod 4
- [ ] `openai` SDK configured with `baseURL: 'https://openrouter.ai/api/v1'`, `apiKey: process.env.OPENROUTER_API_KEY`, default headers `HTTP-Referer` + `X-Title: 'TTB Label Verifier'`
- [ ] `lib/vlm/models.ts` with centralized slugs: `HAIKU = 'anthropic/claude-haiku-4.5'`, `SONNET = 'anthropic/claude-sonnet-4.5'` (verify exact slugs against OpenRouter `/models` endpoint at runtime)
- [ ] Sentry Next.js wizard
- [ ] react-dropzone, @tanstack/react-query v5, react-hook-form, sharp, papaparse, diff, zod-to-json-schema
- [ ] `.env.example` and `.env.local` with: `OPENROUTER_API_KEY`, `OPENROUTER_SITE_URL` (optional), `OPENROUTER_APP_NAME` (optional), `SENTRY_DSN`
- [ ] Git repo initialized; first commit
- [ ] Vercel project linked; deploy succeeds; public URL works
- [ ] `/api/warm` returns `{ok: true, time}`
- [ ] Landing page (`/`) shows "TTB Label Verifier" hello placeholder

### Tests
- N/A (scaffold).

### Acceptance Criteria
- Public Vercel URL responds 200
- `bun lint` (Biome) passes with zero warnings
- `bunx tsc --noEmit` passes
- `bun test` passes (no tests yet but command works)
- Sentry dashboard shows the deploy event
- `/api/warm` returns expected JSON

### Key decisions referenced
- presearch ADR-1 (Next.js + Vercel)
- presearch ADR-8 (senior-friendly defaults)

---

## Phase 2: Single-Label Verifier Core

**Goal:** Upload one image + fill application form → get pass/review/fail with field-by-field result and warning verdict in <5s p95.
**Depends on:** Phase 1.
**Estimated effort:** ~5h.

### Requirements

**Form (`app/page.tsx`):**
- [ ] React Hook Form + Zod resolver
- [ ] Fields: `beverageType` (radio: distilled_spirits/wine/malt_beverage), `brandName`, `classType`, `alcoholContent`, `netContents`, optional `bottlerName`/`bottlerAddress`/`importerName`/`importerAddress`/`countryOfOrigin`
- [ ] Image upload via react-dropzone (single, ≤5MB, image preview, accept `image/*`)
- [ ] Zod refine: image required to submit
- [ ] "Try a sample" button reveals 5 pre-loaded test labels (loaded from `public/samples/samples.json`)

**Server Action `verifyLabel(formData)`:**
- [ ] Parse FormData → validate against `Application` Zod schema
- [ ] sharp pipeline: read → `.rotate()` (EXIF auto-orient) → `.resize(1568, 1568, {fit: 'inside'})` → `.jpeg({quality: 85})` → buffer
- [ ] SHA-256 hash of resized image (cache key)
- [ ] In-memory LRU cache check (skip VLM if hash hit)
- [ ] **Parallel calls** via `Promise.all` (both through the OpenRouter `openai` client; tools = OpenAI-format function with Zod-derived JSON schema):
  - Haiku 4.5 → structured output for `LabelExtract` (excluding warning), with `provider: { order: ['anthropic'], allow_fallbacks: false }`
  - Sonnet 4.5 → structured output for `WarningExtract` (text + headerIsAllCaps + headerAppearsBold)
  - 4.5s `AbortController` timeout each
- [ ] If any field confidence <0.7 → single Sonnet call (via OpenRouter) to re-extract that one field; merge result; mark `escalated=true`
- [ ] Server-side fuzzy matcher (`lib/match/`):
  - Normalize: NFKC → trim → collapse whitespace → smart-quote → straight → lowercase
  - Exact-equal → MATCH (method: 'exact')
  - Jaro-Winkler ≥0.95 → MATCH (method: 'normalized')
  - 0.85-0.95 → Sonnet tiebreak ("are these the same {field name}? answer Y/N + reason")
  - <0.85 → MISMATCH with diff
- [ ] Field-specific overrides:
  - ABV: parse numeric (regex `(\d+(?:\.\d+)?)\s*%`), exact-match number to 1 decimal, format permissive
  - netContents: parse "750 mL"/"750ml"/"750 ML" as same canonical
  - addresses: join multi-line, normalize separators, token-set ratio ≥0.9
- [ ] Beverage-type filter at field level (per `dev-docs/research-domain.md`):
  - Wine ≤14%: ABV optional (acceptable absence)
  - Beer: ABV optional unless application requires
  - Spirits: all fields required
- [ ] Wine 14% rule: if labeled ABV crosses 14% threshold relative to application ABV, FAIL with code `wine_14pp_rule`
- [ ] Warning verifier:
  - Normalize whitespace + drop "(1)"/"(2)" markers
  - String-equal vs canonical text from `lib/canonical/government-warning.ts`
  - Independently check `headerIsAllCaps` and `headerAppearsBold`
  - Build `WarningFailure[]` list (kinds: `wording`, `header_not_all_caps`, `header_not_bold`, `paraphrased`, `missing`)
  - Pass iff: text exact-match AND header all-caps AND header bold
- [ ] `is_alcohol_label` sanity flag in extract; if false, return `error: 'not_alcohol_label'` early
- [ ] Compute overall status: PASS (all match + warning pass), REVIEW (any fuzzy_match or low confidence), FAIL (any mismatch or warning fail)
- [ ] Return `VerificationResult`

**Result UI:**
- [ ] Top banner: large PASS / REVIEW / FAIL with icon + color
- [ ] Per-field rows: field name, application value, label value, status badge, confidence, rationale
- [ ] **Smart-match transparency (I2):** when status=`fuzzy_match`, show "Matched as 'Stone's Throw' (case difference only, treated as match)"
- [ ] **Warning red-line view (I4):** when warning fails, render side-by-side canonical vs extracted with `<ins>`/`<del>` highlighting (use `diff` library)
- [ ] Warning section shows: extracted text, header caps OK?, header bold OK? (or "review needed" if VLM unsure)

**Sample labels:**
- [ ] Create 5 sample labels in `public/samples/`:
  - `01-clean-bourbon.jpg` (clear pass, all fields match)
  - `02-stones-throw.jpg` (uses STONE'S THROW vs Stone's Throw — fuzzy match path)
  - `03-title-case-warning.jpg` (warning is "Government Warning:" title-case → fail with red-line)
  - `04-wrong-abv.jpg` (label 40%, application 45% → fail)
  - `05-rotated-bourbon.jpg` (sideways photo → tests EXIF auto-orient + still passes)
- [ ] `samples.json` manifest: `[{filename, applicationData, expectedStatus, expectedFailures}]`

### Tests (minimum 18 unit tests)

**Verifier core (`lib/verifier/__tests__/`):**
1. Exact match — brand name
2. Exact match — class/type
3. Exact match — net contents
4. Normalized match — case (STONE'S THROW vs Stone's Throw)
5. Normalized match — whitespace (extra spaces)
6. Normalized match — smart quotes (`'` vs `'`)
7. Jaro-Winkler boundary — 0.95 (just match)
8. Jaro-Winkler boundary — 0.85 (just below threshold)
9. LLM tiebreak path (mocked Sonnet response = "yes same")
10. LLM tiebreak path (mocked Sonnet response = "no different")
11. Warning exact match — pass
12. Warning exact match — fail with diff
13. Warning header — title case fails caps check
14. Warning header — bold flag missing fails
15. Wine ABV ≤14% — ABV optional, no false fail
16. Beer — ABV optional unless required
17. ABV numeric normalization (`45%`, `45% Alc/Vol`, `Alc. 45 percent by vol.`)
18. Wine 14% threshold — labeled 13.9% vs application 14.1% fails with code

### Acceptance Criteria
- All 5 sample labels return correct verdicts manually
- p95 latency <5s on Vercel preview deploy (verify in OpenRouter activity dashboard)
- STONE'S THROW vs Stone's Throw → REVIEW (not FAIL); rationale visible
- Title-case warning → FAIL with red-line diff visible
- Sideways bourbon photo → still PASS (EXIF orient works)
- Vitest 18+ passing
- Code organized: `lib/verifier/`, `lib/vlm/`, `lib/match/`, `lib/canonical/`, `app/(routes)/`

### Innovations included
- I2 (Smart-match transparency)
- I4 (Warning red-line)
- I8 (Sample labels — moved here from Phase 7 per gap G9)
- I11 (Tiered routing — visible badge in Phase 6)

### Key decisions referenced
- presearch ADR-2 (Haiku + Sonnet)
- presearch ADR-3 (VLM-only)
- presearch ADR-4 (Hybrid fuzzy)
- presearch ADR-5 (Warning exact-match)
- presearch ADR-6 (Beverage-type-aware)

---

## Phase 3: Senior-Friendly UI Polish

**Goal:** UI passes the "Sarah's mother" test — no hunting for buttons.
**Depends on:** Phase 2.
**Estimated effort:** ~3h.

### Requirements

- [ ] Single primary action visible per screen
- [ ] All interactive targets ≥48px (verify with browser inspector)
- [ ] Loading states: skeleton + status text ("Reading label…" → "Verifying warning…" → "Comparing fields…")
- [ ] Empty state on landing: clear CTA with both "Upload a label" and "Try a sample"
- [ ] Error states for: oversize image, non-label image, API timeout, API error, no image selected
- [ ] Friendly error messages tell user what to do, not what went wrong technically
- [ ] Accessibility:
  - Keyboard nav works (tab through form, space/enter activates)
  - Focus rings visible (Tailwind v4 default is good)
  - Status uses color + icon + text label (don't rely on color alone)
  - Form labels associated with inputs
  - Image alt text on samples
- [ ] Mobile-responsive: single-column on <768px; image upload area full-width
- [ ] **One-click "explain this rejection" (I7):** expandable per-failed-field button → calls `explainRejection` Server Action → Sonnet returns plain-English; result cached per `(resultId, field)` in IndexedDB
- [ ] About page (`/about`): 1-page explanation of how the tool works; link from header
- [ ] Header: logo/title + nav (Single | Batch | About) + tiny "Powered by Claude" subtle footer

### Tests
- 2× Vitest tests for `explainRejection` Server Action (happy path + Sonnet error fallback)
- Manual a11y checklist documented in README

### Acceptance Criteria
- Lighthouse accessibility score ≥95 on `/` and `/about`
- Keyboard-only flow: tab into form, fill fields, upload sample, submit, view result, expand explanation
- Tested on iPhone Safari (responsive) and desktop Chrome
- All 5 error states visible by triggering them manually

### Innovations included
- I7 (Explain rejection)

---

## Phase 4: Hardening

**Goal:** All F1-F13 + security mitigations + observability wired in.
**Depends on:** Phase 3.
**Estimated effort:** ~2h.

### Requirements
- [ ] VLM call wrapper with retry: 1 retry on 429/5xx with exp backoff (200ms, 800ms)
- [ ] 4.5s `AbortController` timeout per VLM call; if exceeded, return partial result with `timeout=true`
- [ ] 401 detection: clear error message "Server configuration error — see deployment notes"; Sentry tag `error.kind=auth`
- [ ] 413 / oversize image: client-side resize before POST as belt-and-suspenders; reject upfront if >5MB with friendly message
- [ ] Image quality heuristic in sharp pipeline: extract `metadata.width/height/density`, brightness mean from `stats()`; if degenerate (too dark, too small) flag in extract
- [ ] If extract confidence still low → UI shows "Image quality too low — try a brighter or steadier photo" with retry button
- [ ] **Auto-rotate (I3):** sharp `.rotate()` with EXIF; covers most "photographed at angle" cases
- [ ] Per-IP rate limit (in-memory `Map`):
  - 30 single-verifies/min/IP → 429 with retry-after
  - 1 batch/min/IP → 429 with friendly batch-throttle message
- [ ] OpenRouter usage limits configured in dashboard (per-key spend cap; recommended: $5/day)
- [ ] Sentry source map upload (Vercel integration)
- [ ] Strip image bytes from logs (hash + dimensions only)
- [ ] Optional belt-and-suspenders: `OPENROUTER_DISABLED=true` env flag falls back to direct Anthropic SDK if `ANTHROPIC_API_KEY` is also set — only worth wiring if there's spare time

### Tests (5)
1. VLM retry path: mock 429 → success on retry
2. 4.5s timeout path: mock slow response → returns `timeout=true`
3. Oversize image (>5MB): rejected with 413
4. Non-alcohol-label image: returns early `error: 'not_alcohol_label'`
5. Rate limit kicks in: 31st call from same IP → 429

### Acceptance Criteria
- Sentry receives a deliberate test error (trigger via `/api/test-error?secret=...`)
- OpenRouter dashboard shows populated cost/latency timeline (≥10 calls), tagged by model
- Demonstrate retry on artificial 429 (mock or hit real rate limit)
- README has "Operations" section linking Sentry + OpenRouter activity page (read-only share if available, else screenshot)

### Innovations included
- I3 (Auto-rotate)

**MVP DEMO-READY at end of Phase 4. Could ship here if time runs out.**

---

## Phase 5: Batch Mode

**Goal:** Drop 200-300 labels + a CSV of application data → live progress + sortable results table with resume-on-reload.
**Depends on:** Phase 4.
**Estimated effort:** ~5h (revised up from 4h per Loop 6 risk RR3).

### Requirements

**Route `/batch`:**
- [ ] Dropzone: multi-file (images + 1 CSV); shows count summary
- [ ] CSV format: `filename,beverageType,brandName,classType,alcoholContent,netContents,bottlerName,bottlerAddress,importerName,importerAddress,countryOfOrigin`
- [ ] CSV parsing (use `papaparse`) → row-by-row Zod validation against `Application` schema; invalid rows shown in a "Skipped (N)" panel with reasons
- [ ] Image-to-row matching: by `filename` field, case-insensitive
- [ ] Pre-flight summary: "247 labels matched · 3 skipped (bad CSV) · 5 unmatched images" — confirm before starting

**Queue:**
- [ ] TanStack Query mutation per row, concurrency-limited to 6 via custom queue
- [ ] Each call: client resize image → POST `/api/verify-one` (FormData)
- [ ] Per-row state: `pending | running | done | error`
- [ ] Per-row retry-on-429 with exp backoff (handled by mutation `retry` config)
- [ ] Persist each completed result to IndexedDB immediately
- [ ] **Resume:** on `/batch` mount, hydrate from IndexedDB → if pending rows exist, show "Resume previous batch" CTA → continues queue from where it left off
- [ ] **Graceful IndexedDB fallback (G2):** if open fails, in-memory mode with toast "History won't persist"

**Live progress UI:**
- [ ] Header bar: `42 / 300 done · 3 review · 1 fail · ETA 2m 14s`
- [ ] Progress bar (linear)
- [ ] Pause / Resume button (controls queue)
- [ ] Cancel button (stops queue, keeps completed)

**Results table:**
- [ ] shadcn DataTable
- [ ] Columns: status badge, filename, brand, class/type, ABV, time, action
- [ ] Sortable by status, brand, time
- [ ] Filter by status (pass / review / fail / error)
- [ ] Click row → expand to per-field detail (same component as single-label result)
- [ ] **CSV export:** download `results.csv` with `filename,status,fieldFailures,warningFailures,...`
- [ ] **Retry-failed button:** re-runs only `error` and `fail` items (the latter optional)

### Tests (12)
1. CSV parser happy path (5 rows, all valid)
2. CSV parser bad row reports line number
3. Filename-to-row matching is case-insensitive
4. Concurrency limiter never exceeds 6
5. IndexedDB persist + restore roundtrip
6. Resume after mock reload (queue picks up from pending)
7. Retry-failed re-runs only failed items
8. Live count math (done/total/review/fail consistent)
9. Per-row error doesn't block siblings (1 of 3 errors, 2 succeed)
10. ETA calculation reasonable
11. CSV export shape matches spec
12. Empty CSV / mismatched filenames friendly error

### Acceptance Criteria
- 50-label test batch finishes in ≤30s on dev network (50/6 × 3.5s = ~30s; allow caching to help)
- Page reload mid-batch → "Resume" works correctly
- Sortable results table works smoothly with 300 rows (no jank)
- CSV export downloads valid CSV
- IndexedDB-disabled browser (Safari incognito) shows toast and continues in-memory

### Innovations included
- I6 (Batch upload + resume)

**FULL DEMO-READY at end of Phase 5.**

---

## Phase 6: Stretch Innovations

**Goal:** Anything from STRETCH list that fits in remaining time.
**Depends on:** Phase 5.
**Estimated effort:** ~3h, time-permitting.

### Requirements (in order of value; ship what fits)

- [ ] **I11 visibility:** Add "Reviewed by Sonnet (high accuracy)" badge on fields that were escalated; tooltip explains the routing strategy. Surface tiered routing in the UI (the logic is already in Phase 2).
- [ ] **I5 streaming:** Convert single-label Server Action to `experimental_streamUI`-style streaming; render fields progressively as Haiku and Sonnet calls return. Brief perceived latency win.
- [ ] **I12 keyboard nav:** In the batch results table, `j`/`k` to move row focus; `space` to toggle approve/reject (UI-only state); `?` opens shortcut help dialog.
- [ ] **I1 confidence heatmap (reach goal):** spike first — does Haiku reliably return `bbox` per field? If yes (≥80% reliability on samples), render bounding-box overlay on the label image with confidence color. If no, abandon.

### Tests
- As needed per item shipped; minimum: 1 test per innovation actually shipped.

### Acceptance Criteria
- Don't break Phase 5
- Each shipped innovation visible on the deployed prototype

---

## Phase 7: README + Writeup

**Goal:** Submission-ready repo.
**Depends on:** Phase 6.
**Estimated effort:** ~2h.

### Requirements

**README.md** — top-level:
- [ ] One-line pitch
- [ ] Live demo URL (Vercel)
- [ ] Quick start (`bun install`, `bun dev`, env vars)
- [ ] Architecture diagram (ASCII): browser → Server Action / API → OpenRouter → Anthropic Claude
- [ ] Tech stack summary table
- [ ] How to deploy (Vercel)
- [ ] Required env vars
- [ ] Operations: link/screenshot of OpenRouter activity dashboard + Sentry project
- [ ] Known limits (out-of-scope from `presearch.md`)

**APPROACH.md** — the writeup:
- [ ] Design philosophy (working core > ambitious incomplete)
- [ ] Stack choices with tradeoffs (called out alternatives: Gemini, Cloudflare, Neon)
- [ ] AI strategy (tiered routing rationale, why Haiku + Sonnet)
- [ ] Verifier algorithm (the matching ladder + warning two-prong)
- [ ] What was cut and why (multi-image, COLA integration, PDF export)
- [ ] Evaluation criteria mapping (the 6-row table from presearch §5)
- [ ] Innovation inventory (CORE / STRETCH actually shipped)
- [ ] Stakeholder receipts ("Janet, the Seattle batch case is in `/batch`")
- [ ] Time spent breakdown

**Sample labels** in `public/samples/`:
- [ ] 5 images from Phase 2
- [ ] `samples.json` manifest with expected verdicts
- [ ] If any were AI-generated: note that in README

**Final checks:**
- [ ] `bun lint` zero warnings
- [ ] `bunx tsc --noEmit` clean
- [ ] `bun test` all green
- [ ] Vercel deploy is the linked URL
- [ ] Repo is public on GitHub or accessible

### Acceptance Criteria
- Reviewer can `git clone`, set env vars, `bun install`, `bun dev` and have it work
- APPROACH.md explicitly addresses all 6 evaluation criteria
- OpenRouter activity link / screenshot is current

---

## Phase Dependency Map

```
Phase 1 (Scaffold)
  └── Phase 2 (Verifier Core) ←————— must work end-to-end
       └── Phase 3 (UI Polish)
            └── Phase 4 (Hardening) ← MVP demo-ready
                 └── Phase 5 (Batch) ← Full demo-ready
                      └── Phase 6 (Stretch, optional)
                           └── Phase 7 (README + Demo)
```

Strict serial; no parallelism (single-developer take-home).

---

## MVP Validation Checklist

| # | Brief Requirement | Phase | Innovation | Test |
|---|---|---|---|---|
| R1 | Compare label artwork to application data | 2 | — | unit: 18 fuzzy/match/warning tests |
| R2 | Brand name match (smart) | 2 | I2 | unit: STONE'S THROW fixture |
| R3 | ABV match (with format leniency) | 2 | — | unit: ABV numeric normalization |
| R4 | Government warning verification (exact + caps + bold) | 2 | I4 | unit: warning exact match + caps + bold |
| R5 | Class/type designation match | 2 | — | unit: classType test |
| R6 | Net contents match | 2 | — | unit: netContents normalization |
| R7 | Bottler/producer + country of origin (where required) | 2 | — | unit: address token-set |
| R8 | <5s single-label latency | 2,4 | — | acceptance: p95 <5s |
| R9 | Senior-friendly UI | 3 | — | manual a11y |
| R10 | Batch upload (200-300 labels) | 5 | I6 | 12 batch tests |
| R11 | Smart matching (STONE'S THROW ≡ Stone's Throw) | 2 | I2 | unit fixture |
| R12 | Imperfect images (angle/lighting/glare) | 4 | I3 | unit + manual |
| R13 | Source code repo | 7 | — | — |
| R14 | README + run/deploy instructions | 7 | — | — |
| R15 | Approach documentation | 7 | — | APPROACH.md |
| R16 | Deployed application URL | 1,7 | — | — |

All 16 requirements mapped.

---

## Innovation tracking

| # | Innovation | Class | Phase | Visible in demo? |
|---|---|---|---|---|
| I2 | Smart-match transparency | CORE | 2 | Yes — STONE'S THROW sample |
| I4 | Government warning red-line | CORE | 2 | Yes — title-case sample |
| I6 | Batch upload + resume | CORE | 5 | Yes — batch demo |
| I7 | One-click explain rejection | CORE | 3 | Yes — wrong-ABV sample |
| I8 | Demo-mode sample labels | CORE | 2 | Yes — landing page |
| I3 | Auto-rotate / EXIF orient | CORE | 4 | Yes — rotated-bourbon sample |
| I11 | Tiered model routing (badge) | CORE | 2 + 6 | Yes — badge on escalated fields |
| I5 | Streaming progressive results | STRETCH | 6 | Maybe |
| I12 | Keyboard batch nav | STRETCH | 6 | Maybe |
| I1 | Confidence heatmap (bbox) | STRETCH | 6 | Maybe |
