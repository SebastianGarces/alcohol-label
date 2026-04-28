# Presearch — AI-Powered Alcohol Label Verification App

**Date:** 2026-04-27
**Mode:** Greenfield (take-home prototype)
**Status:** LOCKED
**Companion docs:**
- `PRD.md` — phased implementation plan
- `CLAUDE.md` — project conventions for downstream Claude sessions
- `dev-docs/brief.txt` — original take-home brief
- `dev-docs/research-domain.md` — TTB regulations + label rules
- `dev-docs/research-tech.md` — VLM/OCR comparison
- `dev-docs/research-eng.md` — deployment + frontend stack

---

## Summary in one paragraph

A Next.js 16 + Vercel prototype that lets a TTB compliance agent verify an alcohol label image against the COLA application data. Single-label verification finishes in <5s p95 by using Claude Haiku 4.5 for parallel field + warning extraction with Sonnet 4.5 escalation only on low-confidence fields. Comparison happens server-side with a deterministic fuzzy-match ladder (exact → normalized → Jaro-Winkler → LLM tiebreak) that handles the "STONE'S THROW vs Stone's Throw" example by name, while government-warning verification stays exact-text against the canonical 27 CFR 16.21 wording. Batch mode for 200-300 labels is client-orchestrated with concurrency 6 to sidestep Vercel's 4.5MB / 10s function limits. Six visible innovations differentiate without eating the time budget; four stretch goals are scoped if time permits. The whole thing is stateless (no PII), uses IndexedDB for batch resume, and is observed via OpenRouter's activity dashboard + Sentry.

---

## Loop 0: Research Brief

### Domain (TTB / 27 CFR)

| Fact | Value | Source |
|---|---|---|
| Government warning canonical text | "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems." | 27 CFR 16.21 |
| Warning header rules | "GOVERNMENT WARNING" must be all caps + bold; rest must NOT be bold; contrasting background; readily legible | 27 CFR 16.22 |
| Warning min font (≤237 mL container) | 1 mm (≤40 char/in) | 27 CFR 16.22 |
| Spirits ABV format | "X% alcohol by volume" / "alc/vol" / "%" / "alc" all OK | 27 CFR 5.65 |
| Spirits ABV tolerance (lab vs label) | ±0.3 percentage points | 27 CFR 5.65 |
| Wine ≤14% ABV tolerance | ±1.5 pp, cannot cross 14% | 27 CFR 4.36 |
| Wine >14% ABV tolerance | ±1.0 pp, cannot cross 14% | 27 CFR 4.36 |
| Beer ABV — when required | Only if alcohol from added flavors/ingredients OR state law | 27 CFR 7.65 |
| Brand-name case/punctuation matching | NO regulation requires case-sensitive match between application form and label | TTB Allowable Revisions |

**Key implications:**
- Required field set differs by beverage type → verifier must be type-aware
- Form ABV vs label ABV is exact-match (tolerances apply only at lab testing)
- Brand-name case/punctuation differences are NOT regulatory failures
- Warning text must be exact-match against canonical wording
- Header caps + bold are independent format checks

Full research at `dev-docs/research-domain.md`.

### Technical (VLM / OCR / preprocessing)

| Decision area | Pick | Why |
|---|---|---|
| LLM gateway | **OpenRouter** (OpenAI SDK + `baseURL` swap) | User has credits; one API key for any model; dashboard gives demo-time cost/latency visibility (replaces Helicone) |
| Primary VLM | **Claude Haiku 4.5** via OpenRouter (`anthropic/claude-haiku-4.5`) | 0.56-0.74s TTFT, ~$1/$5 per 1M tokens, fast on vision |
| Verification VLM | **Claude Sonnet 4.5** via OpenRouter (`anthropic/claude-sonnet-4.5`) | Stronger on warning bold/caps; used for escalation |
| OCR services | **None** | Stylized fonts kill classical OCR (Tesseract 70.7% accuracy); VLMs win |
| Image preprocess | **sharp resize to 1568px JPEG q85** | Anthropic-recommended; ~50ms; no GPU |
| Structured output | **OpenAI-format tool use + Zod schema** (Anthropic semantics preserved through OpenRouter) | OpenRouter passes tools through; native 100% schema compliance |
| Fuzzy matching | **Hybrid: normalize → Jaro-Winkler → LLM tiebreak** | Sub-ms median, $0.0001/label amortized |
| Warning verification | **Two-prong: VLM extract + canonical exact-match** | Catches title-case violations deterministically |

Full research at `dev-docs/research-tech.md`.

### Engineering (deployment / framework / UI)

| Layer | Pick | Why |
|---|---|---|
| Deploy | **Vercel Hobby** | Default Next.js fit; 10s function + 4.5MB body OK with client-orchestrated batch |
| Framework | **Next.js 16 App Router** | Server Actions stable; React 19.2; opt-in caching kills v15 footguns |
| UI | **shadcn/ui + Tailwind v4** | "Own the code" lets us bump default sizes for senior UX cheaply |
| Upload | **react-dropzone + TanStack Query v5** | Free per-file progress; concurrency limiter |
| Lint/format | **Biome** | 10-25× faster than ESLint+Prettier; one config |
| Tests | **Vitest only** | E2E too expensive; record demo video instead |
| Observability | **OpenRouter dashboard + Sentry** | OpenRouter shows per-request cost/latency/model natively; one less proxy hop than Helicone; ~50ms saved |
| Storage | **None (IndexedDB for batch)** | No PII, no DB; better-sqlite3 dies on Vercel anyway |

Full research at `dev-docs/research-eng.md`.

**Open / unresolved questions** (none load-bearing):
- No published p95 latency for Haiku 4.5 image inputs (estimated 1.5-2× median)
- Bold-vs-regular detection accuracy not quantified — surfaced to agent as "review" flag, not auto-fail
- VLM extraction accuracy on stylized script alcohol labels not benchmarked — confidence-threshold escalation is the mitigation

---

## Loop 1: Constraints (LOCKED)

### 1.1 Domain & Use Cases

**Problem:** TTB compliance agents (47 people, 150K labels/year) manually compare alcohol labels against COLA application data. Half their day is mechanical matching — agents say it's "essentially data entry verification" — and they want AI to handle the routine cases so they can focus on judgment.

**Personas:**
- **Sarah Chen** (Deputy Director) — wants throughput, batch capability, fast results
- **Dave Morrison** (28 years, prints emails) — low tech tolerance, demands zero-friction UI
- **Jenny Park** (8 months, fresh out of college) — high tech literacy, will push the system
- **Janet** (Seattle office) — has been asking for batch upload "for years"

**Core use cases:**
1. Single-label verify (image + form → pass/review/fail in <5s)
2. Batch verify (200-300 labels via CSV + zip → live results table)
3. Government warning audit (exact text + caps + bold)
4. Smart matching ("STONE'S THROW" ≡ "Stone's Throw")
5. Imperfect-image tolerance (angle/glare/lighting)

**Greenfield prototype.** No COLA integration. No PII storage required.

### 1.2 Scale & Performance

| Metric | Demo / Take-home | Hypothetical Prod | Source |
|---|---|---|---|
| Single-label p95 latency | <5s | <5s | Brief: prior vendor killed at 30-40s |
| Batch size | 300 | 300+ | Brief: peak importer dumps |
| Concurrent users | 1 | ~47 | Brief |
| Daily volume (prod) | N/A | ~600/day | 150K/yr ÷ 250 days |
| Image size | ≤10 MB | Same | Phone camera typical |

**The <5s constraint is load-bearing for every architecture decision.**

### 1.3 Budget

| Category | Budget | Notes |
|---|---|---|
| Development | $0 | Take-home, free-tier deploy expected |
| API costs | <$5 over demo | ~$0.005/label × 300 = ~$1.50 |
| Infra | $0 | Vercel Hobby |
| Third-party | $0 | OpenRouter (existing credits) + Sentry free tier |

**Tradeoff:** Money for time — paid VLM > training a custom model; managed deploy > custom infra.

### 1.4 Time to Ship

| Milestone | Target | Focus |
|---|---|---|
| MVP demo-ready | End of Phase 4 (~12h) | Single-label verify, deployed |
| Full demo-ready | End of Phase 5 (~16h) | + batch upload |
| Submission-ready | End of Phase 7 (~21h) | + writeup + demo video |

### 1.5 Data Sensitivity

- No PII (TTB labels are public records)
- No persistent storage required by brief
- Cloud APIs OK (firewall constraint applies to TTB prod, not prototype)
- Don't log image bytes; hash only

### 1.6 Team & Skills

| Skill | Level | Impact |
|---|---|---|
| Next.js + React + TS | Expert | Use full stack, don't dumb down |
| LLM SDKs | Expert | Anthropic + Zod tool use idiomatic |
| TTB domain | New | Leaning on `dev-docs/research-domain.md` |
| OCR / CV | Comfortable | Use battle-tested libs (sharp), avoid custom |

### 1.7 Reliability

- Wrong answer cost: reviewer marks down for visible bugs; no real compliance harm in demo
- Human-in-the-loop is mandatory: tool recommends, agent approves
- Government warning is non-negotiable exact-match
- Per-field rationale + extracted text + confidence required for every result

### 1.8 Evaluation Criteria (drives everything)

| Criterion | Priority | Architecture Implication |
|---|---|---|
| Correctness & completeness | Highest | Every required field + tests; warning exact |
| Code quality & organization | High | TS strict, modular, 35+ tests, Biome zero warnings |
| Appropriate tech choices | High | Lean stack, justified in writeup |
| UX & error handling | High | Senior-friendly UI, all error states designed |
| Attention to requirements | High | Every brief sentence mapped to a phase |
| Creative problem-solving | Medium | 6 CORE innovations, all visible in demo |

---

## Loop 1.5: Innovations (LOCKED)

### CORE — must ship in MVP

| # | Innovation | Why differentiating | Effort | Phase |
|---|---|---|---|---|
| I2 | **Smart-match transparency** — show why a fuzzy match was accepted (e.g., "case difference only") and what the diff was | Directly addresses Dave's "STONE'S THROW" example | L | 2 |
| I4 | **Government warning red-line view** — side-by-side canonical vs extracted with `<ins>`/`<del>` highlighting | Directly addresses Jenny's title-case-warning example | L | 2 |
| I6 | **Batch upload with live progress + IndexedDB resume** | Direct stakeholder ask (Janet, "for years") | M | 5 |
| I7 | **One-click "explain this rejection"** — Sonnet-generated plain-English per failed field | Addresses Dave's "judgment" concern | L | 3 |
| I8 | **Demo-mode sample labels** — 5 pre-loaded test labels covering pass/fail/edge cases | Removes friction in evaluation | L | 2 |
| I3 | **Auto-rotate / EXIF orientation correction** | Addresses Jenny's "weird angles" complaint | M | 4 |
| I11 | **Tiered model routing** — Haiku first, escalate to Sonnet only on low confidence; visible badge in UI | Cost+latency optimization that's also visible | M | 2 + 6 (badge) |

### STRETCH — if time permits

| # | Innovation | Phase |
|---|---|---|
| I5 | Streaming progressive results | 6 |
| I12 | Keyboard-first batch review (j/k/space) | 6 |
| I1 | Confidence heatmap with bounding boxes | 6 (reach goal) |

### CUT — not worth take-home time

- Synthetic data generator (invisible)
- PDF export of results (compliance theatre)

---

## Loop 2: Architecture Decisions

### Architecture Decision Records (ADR)

#### ADR-1: Single Next.js monolith on Vercel
**Choice:** Next.js 16 App Router on Vercel Hobby. Server Actions for single-label; client-orchestrated POSTs for batch.
**Rejected:** (a) Cloudflare Pages + Workers — extra wiring; (b) Multi-service backend — overkill; (c) Next.js + Cloudflare R2 for images — no persistence needed.
**Why:** Vercel's 10s function + 4.5MB body limits are dodgeable: single label fits in one Server Action call (<5s); batch is 1-image-per-request POST loop on the client. Zero infra work, fastest deploy.
**Risk if wrong:** Cold-start latency — mitigated by `/api/warm` ping on page load.

#### ADR-2: Claude Haiku 4.5 primary + Sonnet 4.5 verification, all via OpenRouter
**Choice:** Route all LLM calls through **OpenRouter** using the OpenAI SDK with `baseURL: 'https://openrouter.ai/api/v1'`. Haiku 4.5 (`anthropic/claude-haiku-4.5`) for parallel field extraction; Sonnet 4.5 (`anthropic/claude-sonnet-4.5`) for warning sub-call (parallel) and low-confidence escalation. Pin provider to Anthropic via `provider: { order: ['anthropic'], allow_fallbacks: false }` so OpenRouter doesn't silently re-route to a clone that might break tool shape or vision.
**Rejected:**
- Direct Anthropic SDK — would still work, but the user has OpenRouter credits already paid for; routing through OpenRouter costs nothing extra and the dashboard gives demo-time visibility we'd otherwise need Helicone for.
- Gemini 2.5 Flash — 3× cheaper input but cost gap meaningless at take-home scale; Haiku 4.5 latency overlaps Flash's; would force two model adapters instead of one.
**Why:** Latency budget still hits ~2.5-3.5s p50 with parallel calls; ~$0.005/label end-to-end. OpenRouter adds typical 30-80ms gateway overhead (within budget). Centralized in `lib/vlm/models.ts` so swapping models is a one-line change — preserves the OpenRouter abstraction's value.
**Risk if wrong:** (a) Stylized-font extraction errors — mitigated by confidence-threshold escalation to Sonnet (per-field). (b) OpenRouter outage — mitigated by `OPENROUTER_DISABLED=true` flag that falls back to direct Anthropic SDK if `ANTHROPIC_API_KEY` is also set (optional belt-and-suspenders).

#### ADR-3: VLM-only extraction, no dedicated OCR
**Choice:** sharp resize → Haiku VLM → Zod-validated structured output.
**Rejected:** Google Vision / Textract / Azure DI — they cost the same as the VLM ($1.50/1k pages) and lose on stylized alcohol-label fonts; PaddleOCR is strong but adds GPU/install cost.
**Why:** A modern VLM is the OCR + the reasoning in one call.

#### ADR-4: Hybrid fuzzy match for fields, exact match for warning
**Choice:** Normalize (NFKC, lowercase, smart-quote→straight, whitespace collapse) → Jaro-Winkler ≥0.95 = match, 0.85-0.95 = LLM tiebreak (Sonnet), <0.85 = mismatch.
**Rejected:** Pure LLM judgment per field — slow, expensive, less reproducible; pure algorithmic — too rigid for real-world variations.
**Why:** Domain research confirms TTB has no rule mandating case-sensitive matching; cheapest path to handle the "STONE'S THROW" case while keeping bills small and tests reproducible.

#### ADR-5: Government warning is exact-match against canonical text
**Choice:** VLM extracts the warning verbatim → server normalizes whitespace + paragraph markers → string-equality compares to the 27 CFR 16.21 canonical text.
**Rejected:** LLM judgment — too risky for a regulation that's literally a fixed string.
**Why:** TTB rejects COLAs over a missing comma. Exact-match is the right primitive; UX shows a red-line diff to make failures obvious.

#### ADR-6: Beverage-type-aware verifier
**Choice:** Required-field set is parameterized by `beverageType`. Wine ≤14% can omit ABV; beer often omits ABV; spirits always require ABV.
**Rejected:** "All fields required" — would over-flag wine/beer.
**Why:** Domain research; otherwise demo-breaking false positives on common wine labels.

#### ADR-7: Stateless server + IndexedDB for batch history
**Choice:** No DB. Server is pure functions. Batch results persist to browser IndexedDB for resume across reloads.
**Rejected:** Neon Postgres — overkill, adds env var, not needed for prototype; localStorage — too small for 300 results; SQLite on Vercel — ephemeral filesystem kills it.
**Why:** Brief says no persistence required; reviewer wants it to "just work."
**Patch (G2):** if IndexedDB unavailable (Safari incognito), graceful in-memory fallback with toast.

#### ADR-8: Senior-friendly defaults from first commit
**Choice:** Tailwind base = 18px (vs default 16); shadcn Button default `h-12 px-6`; all interactive targets ≥48px; high-contrast slate palette.
**Rejected:** Default shadcn sizes — too small for Dave persona.
**Why:** Brief is emphatic. Cheaper to bake in defaults than retrofit later.

---

## Loop 3: Refinement

### Failure modes (all designed)

13 failure modes identified (F1-F13), each with a specific mitigation and phase assignment. Headline:

| F# | Mode | Mitigation |
|---|---|---|
| F1 | Anthropic API down/429 | Retry 200ms/800ms; explicit toast; Sentry alert |
| F2 | VLM call >5s | 4.5s hard timeout; partial result with `review` |
| F3 | Image >4.5MB | Client resize before upload; reject >5MB friendly |
| F4 | Poor-image extraction | Confidence threshold + "re-photograph" UX |
| F5 | Prompt injection on label | Extract-then-compare separation; deterministic matcher |
| F6 | Batch mid-flight reload | IndexedDB persist + resume button |
| F7 | Batch hits rate limit | Concurrency 6 + retry with backoff |
| F8 | Non-label image | `is_alcohol_label` sanity flag; fail-fast |
| F9 | Multi-face label | Out of scope; documented |
| F10 | Wrong beverageType | Trust application; flag if VLM disagrees |
| F11 | Concurrent routes | Stateless, no global queue |
| F12 | API key leak | Server-only env vars |
| F13 | Sonnet escalation pushes >5s | Run in parallel, not serial |

### Security

| Threat | Mitigation |
|---|---|
| Prompt injection | Extract-then-compare separation; verifier never relies on VLM verdict |
| Image-borne malware | sharp re-encodes to JPEG; strips EXIF except orientation |
| API key exposure | Server-only env vars; never NEXT_PUBLIC_ |
| Cost runaway | OpenRouter per-key spend cap at $5/day; per-IP rate limit |
| CSRF | Next.js Server Action token validation |
| Abuse | 30 verifies/min/IP; 1 batch/min/IP |

### Latency budget (p95 target 4.5s)

| Step | Target |
|---|---|
| Client → server upload (post-resize ≤1.5MB) | 200-400ms |
| sharp resize 1568px JPEG q85 | ~50ms |
| Image hash + cache check | ~5ms |
| OpenRouter gateway overhead (per call) | 30-80ms |
| Haiku field extract via OpenRouter (parallel) | 1.5-2.5s |
| Sonnet warning extract via OpenRouter (parallel) | 1.5-2.5s |
| Optional Sonnet escalation (rare) | +1s |
| Server fuzzy match | <5ms |
| LLM tiebreak (rare 0.85-0.95) | +800ms |
| UI render | 100-200ms |
| **p50** | **~2.6-3.6s** |
| **p95** | **~4.6s** |

### Cost

| Volume | Per-label | Monthly |
|---|---|---|
| Demo (10 labels) | ~$0.005 | <$0.05 |
| 100 labels | ~$0.005 | $0.50 |
| 1K labels | ~$0.005 | $5 |
| 10K labels | ~$0.005 | $50 |
| 150K/yr (TTB scale) | ~$0.005 | ~$750/yr (vs. $4.2M rebuild quote) |

### Out of scope (explicit)

- Multi-image label submission (front + back)
- COLA system integration
- Persistent multi-user storage
- Authentication
- Mobile-native app
- PDF export of results
- ABV lab-vs-label tolerance enforcement (only form-vs-label)

---

## Loop 5: Evaluation Criteria Mapping

| # | Criterion | "Meets" | **"Clearly Exceptional"** | Our Approach |
|---|---|---|---|---|
| C1 | Correctness | All fields compared, warning checked | Beverage-type-aware verifier; wine 14% rule; canonical warning byte-equal match | Phase 2 + domain research |
| C2 | Code quality | Reasonable structure, some tests | 35+ tests; Zod everywhere; strict TS; Biome zero-warning | Phases 2/4/5 |
| C3 | Tech choices | Reasonable stack | Justified vs alternatives in APPROACH.md (Gemini, Cloudflare, Neon) | Phase 7 writeup |
| C4 | UX | Works, looks fine | Senior-friendly defaults; warning red-line; explain-rejection | Phases 2-3 |
| C5 | Attention | Hits obvious requirements | Every brief sentence mapped (§4.4); Janet named in writeup | Phase 7 |
| C6 | Creativity | One feature beyond requirements | 6 visible innovations, each tied to a stakeholder quote | Phases 2-6 |

---

## Loop 6: Gap Analysis

39/39 brief requirements traced to phases + tests. 10 gaps found, all patched into the phase plan. Highest-confidence decisions: stack pick, latency budget. Lowest-confidence: VLM accuracy on stylized brand text (mitigated by confidence-threshold escalation + "review" status).

**Key risks:**
- Most likely: VLM mishandles fancy-script brand text → false REVIEW (mitigated)
- Most catastrophic: Latency budget blown on real demo (mitigated by warmup + client resize + prompt cache + 4.5s timeout failsafe)
- Underestimated: Phase 5 batch (5h not 4h)

---

## Decision log

| When | Decision | Status |
|---|---|---|
| L0 | Use VLM-only, skip dedicated OCR | LOCKED |
| L0 | Use Anthropic Claude (vs Gemini), routed via OpenRouter (user has credits) | LOCKED |
| L1 | <5s p95 single-label is hard constraint | LOCKED |
| L1 | No persistent storage | LOCKED |
| L1 | Senior-friendly UI is top-3 eval criterion | LOCKED |
| L1.5 | 6 CORE innovations, 4 STRETCH, 2 CUT | LOCKED |
| L2 | Next.js 16 + Vercel + shadcn + Tailwind v4 | LOCKED |
| L2 | Server Action for single, client batch with concurrency 6 | LOCKED |
| L2 | Hybrid fuzzy match (normalize → JW → LLM tiebreak) | LOCKED |
| L2 | Two-prong warning: VLM extract + canonical exact-match | LOCKED |
| L2 | Beverage-type-aware verifier | LOCKED |
| L2 | IndexedDB for batch resume; no DB | LOCKED |
| L3 | 4.5s VLM timeout; retry once with backoff | LOCKED |
| L3 | Per-IP rate limit; OpenRouter per-key spend cap | LOCKED |
| L4 | 7-phase plan, 21h total | LOCKED |
| L6 | 10 patches applied; 39/39 requirements mapped | LOCKED |
