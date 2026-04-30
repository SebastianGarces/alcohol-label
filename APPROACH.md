# Approach

This document is the submission writeup for the TTB Label Verifier prototype. It mirrors the structure asked for in the brief and explains the *why* behind each decision. The ADRs and full decision log live in `presearch.md`.

---

## 1. Design philosophy

> **Working core > ambitious incomplete.**

The brief is unambiguous: "We're more impressed by a working core application with clean code than ambitious but incomplete features." Every architectural choice answered to that. The plan was structured so the project would be deployable at the end of Phase 4 (single-label MVP), then again at the end of Phase 5 (full batch demo), and only *then* layered with stretch innovations in Phase 6.

This drove three concrete habits:

1. **Phase boundaries are deployable.** Each phase produces something that could ship if I had to stop. Single-label was demo-ready before batch was started.
2. **No speculative abstractions.** No event bus, no plugin system, no DB schema "for later." `lib/verifier/` orchestrates pure functions; the server has zero stored state.
3. **Domain correctness over surface polish.** I read the actual TTB regulations (27 CFR Parts 4/5/7/16) before writing any matching code. The government warning isn't "verified by the model" — it's exact-match-compared against the canonical text from `lib/canonical/government-warning.ts`. That's the part the agency cares most about.

---

## 2. Tech stack — choices and tradeoffs

| Choice | Rejected alternative | Why this won |
|---|---|---|
| Next.js 16 + Vercel Hobby | Cloudflare Pages + Workers | Vercel's 10s function + 4.5MB body limits are dodgeable for this workload; Server Actions + zero-config deploy save hours |
| OpenRouter via `openai` SDK | Direct Anthropic SDK | User had OpenRouter credits; one SDK + one model registry (`lib/vlm/models.ts`) means swapping Haiku↔Flash is a one-line change |
| Anthropic Claude (Haiku 4.5 + Sonnet 4.5) | Gemini 2.5 Flash | Gemini is ~3× cheaper input, but the gap is meaningless at take-home scale; Haiku 4.5 wins on stylized-font reading in informal tests; provider-pinned through OpenRouter to avoid silent reroutes |
| VLM-only (no dedicated OCR) | Google Vision / Textract / PaddleOCR | A modern VLM is OCR + reasoning in one call; OCR services tie on stylized alcohol-label fonts and add latency |
| No database; server is stateless; IndexedDB only for the I7 explanation cache | Neon Postgres / SQLite | Marcus's IT note ("not storing anything sensitive for this exercise") made statelessness the simplest defensible choice for a prototype; the batch is client-orchestrated in-memory and the 24-label demo button reseeds it in one click |
| sharp pipeline (rotate → 1280px → JPEG q85) | Cloudinary / serverless image API | 1280 is enough for ≥10pt body text on TTB labels (Anthropic's max is 1568) and saves ~600ms of p95 latency; sharp also strips EXIF (security) and fixes orientation (Jenny's "weird angles" complaint) |
| Server-side rate limit (in-memory per-IP) | Upstash / Redis | No infra to provision; per-instance counters are fine for prototype scale |
| Biome + Vitest | ESLint + Prettier + Jest | Single tool for lint+format with zero config drift; Vitest is faster and matches Bun's defaults |

**What I deliberately *didn't* add:**

- **No Postgres / Redis / SQLite.** Stateless server is the entire deployment story.
- **No OpenCV / dedicated image preprocessing.** sharp's 4 lines of code do the job.
- **No auth.** Out of scope for a prototype.
- **No e2e tests.** The deployed prototype is the runtime check — brief deliverables don't require e2e.

Full ADR-by-ADR rationale is in `presearch.md` (13 ADRs).

---

## 3. AI strategy — tiered routing rationale

Every label produces between two and three LLM calls, and I chose the model for each one deliberately.

```
                         ┌─── Haiku 4.5: extract all fields  ──────┐
   Server Action / API ──┤                                          ├──> verify + match
                         └─── Sonnet 4.5: extract gov. warning  ───┘     (deterministic)

   For each field with confidence < 0.7:
       ─────────────────> Sonnet 4.5: re-extract that single field
                          (merged into result; field marked `escalated=true`)

   Optional, on user request:
       ─────────────────> Sonnet 4.5: explain a specific rejection
```

**Why this split:**

- **Haiku 4.5 for the bulk read.** It's fast (~1.5–2.5s), cheap, and accurate enough for clean labels. Returning structured JSON via OpenAI-style tool-use is reliable when the schema is small.
- **Sonnet 4.5 for the warning.** The government warning is the highest-stakes output — a single wrong character is a real-world FAIL. Sonnet's better at faithful long-text transcription including the structural flags (`headerIsAllCaps`, `headerAppearsBold`).
- **Parallel calls.** Field-extract and warning-extract share no state, so they run in `Promise.all`. That's the difference between ~4s and ~7s end-to-end.
- **Per-field escalation, not whole-label.** If one of nine fields comes back at 0.5 confidence, only that one field is re-extracted. The user sees a `Reviewed by Sonnet` badge with a tooltip, and a `TieredRoutingNote` summarizes the strategy on every result — the routing is *visible*, not magic.
- **Sonnet for the human-readable rejection.** When a reviewer clicks "Why did this fail?", that's a Sonnet call producing one short paragraph. Worth the cost; not on the hot path.

**Reliability disciplines, all enforced in `lib/vlm/`:**

- Hard `AbortController` timeout of 4.5s per VLM call (latency budget is 5s p95 end-to-end).
- One retry on 429/5xx with `(200ms, 800ms)` exponential backoff. No retries on 401.
- Provider pinning via OpenRouter: `provider: { order: ['anthropic'], allow_fallbacks: false }` so we don't silently get re-routed to a different vendor that might break tool-call shape or vision.
- Anthropic ephemeral prompt-cache markers (`cache_control: { type: 'ephemeral' }`) wired on every system message via `buildCachedSystemMessage`. **Caveat**: empirically verified that caching does *not* fire at our prompt size — Anthropic enforces a ≥1024-token cached-prefix minimum and our system + tools + user-text comes to ~600-700 tokens before the image. Confirmed via fetch-spy on the outgoing request body (markers present and correctly placed) and back-to-back identical extracts (`cached_tokens` stays 0). Wiring is intentionally left in place: it's correct and harmless, and if a future iteration bakes TTB regulation excerpts or canonical examples into the system prompt, caching will start firing without code changes. See `lib/vlm/call.ts` for the inline rationale and the would-be cache-cost line in `lib/vlm/pricing.ts`.

**Prompt-injection defense (architectural, not heuristic):**

The VLM extracts; the server compares. The model never sees both the application data and the label image in one call, so it can't be social-engineered into "deciding" the result. Prompts ask for *facts* ("what is the brand name?"), never for *judgments* ("does this label pass?"). The verdict is computed deterministically in `lib/match/`.

**Observability — prototype today, span-level tracing tomorrow.**

For prototype-stage observability I leaned on two artifacts: OpenRouter's per-key dashboard (cost, latency, finish-reason per request, screenshot in README) and a committed `eval-results.md` produced by the harness in `eval/`. For production I'd wire **Langfuse** (or Helicone, or Braintrust — all comparable in this category) for span-level tracing — extract / warning / escalate / tiebreak as a tree, with tags for `escalated=true` cohorts and `mode=tiered|haiku-only|sonnet-only` if the routing is ever hot-reconfigurable. The decisive factor for not wiring it now: a take-home reviewer doesn't navigate to a third dashboard; the README screenshots and the in-product cost/latency footer (I14) already deliver the same signal at zero reviewer friction.

---

## 4. Verifier algorithm

### 4.1 Field matching ladder

For each field in `Application` (filtered by beverage type):

1. Find corresponding `LabelExtract` field.
2. **Normalize both:** NFKD → strip combining marks (diacritics) → trim → collapse whitespace → smart quotes → straight quotes → lowercase.
3. If raw values equal → `MATCH (method: exact)`.
4. If normalized values equal → `REVIEW (status: fuzzy_match, method: normalized)` — Dave's "STONE'S THROW vs Stone's Throw" lands here, as does "Destilería" vs "Destileria". Surfaces the yellow "Match (normalized)" badge so an experienced agent confirms typographic equivalence.
5. Otherwise compute Jaro-Winkler similarity.
   - `≥ 0.95` → `REVIEW (status: fuzzy_match, method: normalized)` — for typos and near-misses.
   - `0.85 – 0.95` → call Sonnet for an LLM tiebreak; LLM verdict drives the result, marked `method: llm_tiebreak`.
   - `< 0.85` → `MISMATCH` with a character-level diff.
6. **Field-specific overrides:**
   - **ABV:** parse to numeric; equal to one decimal place; "45%" ≡ "45.0% alc/vol" ≡ "45 percent".
   - **Net contents:** parse "750 mL" / "750ml" / "750 ML" / "750 milliliters" to a single canonical.
   - **Addresses:** join multi-line, normalize separators; token-set ratio ≥ 0.9.
7. **Wine 14% rule:** if labeled and application ABV cross the 14% line, FAIL with code `wine_14pp_rule` regardless of similarity (27 CFR Part 4 calls these out as different classes).

### 4.2 Government warning — two-prong exact verification

The warning is the load-bearing failure case. It is *not* judged by the LLM:

1. VLM extracts `fullText`, `headerIsAllCaps`, `headerAppearsBold`.
2. Server normalizes whitespace and drops `(1)` / `(2)` paragraph markers.
3. **Exact equality** against the canonical text in `lib/canonical/government-warning.ts` (verbatim from 27 CFR 16.21).
4. PASS iff *all three*: text equal, `headerIsAllCaps`, `headerAppearsBold`.
5. Failures populate a typed `WarningFailure[]` for the red-line view.

This was a deliberate design choice. The TTB rejects applications over missing commas in the warning. An LLM that "reads the warning and decides if it's compliant" is one prompt drift away from a real-world compliance miss. Exact-match is the right primitive; UX makes failures obvious via the side-by-side `<ins>`/`<del>` red-line.

### 4.3 Bottler ↔ importer category-swap detection

**Problem.** TTB treats bottler (27 CFR 5.66) and importer (27 CFR 5.67/5.68) as distinct mandatory fields, and the schema reflects that — `bottlerName/Address` and `importerName/Address` are separate slots. But for an imported product whose US importer is also the responsible packager, applicants frequently file the same entity under the bottler column even though the label only carries an "Imported by …" statement. A naive slot-to-slot match flags both bottler fields as MISSING (red), which is misleading: the value isn't missing from the label — it's classified differently.

**Resolution.** After `runFieldChecks` resolves each slot independently, the orchestrator runs a synchronous `applyCategorySwapDetection` pass. For any field whose status is `missing` *and* the application carries a value, the detector looks up the partner slot (`bottlerName ↔ importerName`, `bottlerAddress ↔ importerAddress`) on the label extract. If the application's value matches the partner's label value (Jaro-Winkler ≥ 0.85 for names, token-set ratio ≥ 0.9 for addresses, mirroring the in-slot thresholds), the FieldResult is rewritten:

- `status: missing → fuzzy_match`
- `method: absent → category_swap`
- `labelValue` filled in from the partner slot
- `rationale`: "The application lists this value under bottler, but the label shows the same entity as the importer (27 CFR 5.66 vs 5.67). Confirm the correct role."

That single rationale change downgrades the row from FAIL (red) to REVIEW (yellow) and threads through `explainRejection` so the human-readable explanation describes the *role mismatch*, not a phantom missing value. The detection is symmetric — a missing importer matched on the bottler side gets the same treatment with the citation reversed.

**Why this is the right primitive.** Same-entity-multiple-roles is structurally common for imported beverages, and an experienced agent (Dave from the brief) already does this reasoning by eye in seconds. Demoting MISSING → REVIEW preserves the agent's authority — they still *see* and *confirm* the row — while killing the false-red that erodes trust in batch triage.

**Tradeoff.** A real applicant who legitimately needs both a US bottler *and* a foreign importer named separately, and who only filled one, would also land in REVIEW rather than FAIL. Mitigation: REVIEW always surfaces to the agent for explicit confirmation; we never silently pass the swap.

### 4.4 Beverage-type-aware required fields

Required-field sets are parameterized by `beverageType`:

| Field | Spirits | Wine ≤14% | Wine >14% | Beer |
|---|---|---|---|---|
| brandName, classType, netContents | required | required | required | required |
| alcoholContent | required | optional* | required | optional* |
| countryOfOrigin (imports) | conditional | conditional | conditional | required (27 CFR 7.69) |

This stops the verifier from over-flagging wine/beer labels that legally omit ABV.

---

## 5. What I cut (and why)

| Cut | Why |
|---|---|
| Multi-image submissions (front/back/side) | Brief implies single image; multi-image triples preprocessing complexity for marginal coverage |
| COLA / TTB Online integration | Not in scope; would require auth + government API access I don't have |
| PDF export of results | Compliance theatre — CSV is the format reviewers actually paste into spreadsheets |
| ABV lab-vs-label tolerance enforcement | Brief is form-vs-label only; tolerance is a policy question for the agency |
| Persistent server-side history / multi-tenant | Marcus's IT note framed statelessness as fine for a prototype; persistence + multi-tenant is the next-hour-of-work, not this hour |
| Auth, RBAC, audit log | Out of scope for a prototype; would be the *next* hour of work after this |
| True OCR fallback | VLM-only; if the model can't read the label, the user is told to retry with a clearer photo |
| Synthetic data generator | Invisible to the reviewer; not worth take-home time |
| I5 streaming progressive results, I1 confidence-bbox heatmap | Phase 6 stretch; deferred — see §7 |
| IndexedDB batch resume (originally planned in PRD Phase 5) | Half-broken without image blob persistence: a reload loses the in-memory `File` objects, so "resume" would force the user to re-upload every image — that defeats the entire point. A correct resume needs blob storage (IndexedDB blobs or server-side), which is out of scope for a stateless prototype. The 24-label demo seed button is the actual evaluation path; a real batch run that needs reliability would belong on a queue worker with persistent storage, not in the browser. |

The full out-of-scope list is in `presearch.md → §3.5`.

---

## 6. Evaluation-criteria mapping

This is the table from `presearch.md → Loop 5`, with what was actually shipped:

| # | Criterion | What "Clearly Exceptional" means here | What I shipped |
|---|---|---|---|
| C1 | **Correctness & completeness** | Beverage-type-aware verifier; wine 14% rule; canonical warning byte-equal match | Phase 2 verifier core; 18 unit tests on the matching ladder + warning |
| C2 | **Code quality & organization** | 35+ tests, Zod everywhere, strict TS, Biome zero-warning | 135 unit tests across 21 files; Zod boundary at every cross-module type; `bun run lint` clean; `bunx tsc --noEmit` clean |
| C3 | **Appropriate tech choices** | Justified vs alternatives in writeup | This document's §2; ADRs in `presearch.md` |
| C4 | **UX & error handling** | Senior-friendly defaults; warning red-line; one-click explain | 18px base, ≥48px targets, single primary action per screen, status banner with icon+color+text, explicit loading copy ("Reading label…", "Verifying warning…"), all error states designed |
| C5 | **Attention to requirements** | Every brief sentence mapped to a phase | `PRD.md → MVP Validation Checklist` traces all 16 brief requirements to a phase + a test; Janet, Dave, Jenny, Sarah named in the writeup |
| C6 | **Creative problem-solving** | Multiple visible innovations, each tied to a stakeholder quote | 7 CORE innovations (I2, I3, I4, I6, I7, I8, I11) shipped + 1 STRETCH (I12) |

---

## 7. Innovation inventory — what shipped

### CORE (all shipped, all visible in demo)

| # | Innovation | Where it lives | Stakeholder it answers |
|---|---|---|---|
| I2 | Smart-match transparency — `method: normalized` badge with tooltip | `components/result/FieldRow.tsx`, `lib/match/field.ts` | Dave: "STONE'S THROW ≡ Stone's Throw" |
| I3 | EXIF auto-rotate via sharp | `lib/vlm/image.ts` | Jenny: "weird angles" |
| I4 | Government warning red-line view (`<ins>`/`<del>`) | `components/result/WarningRedline.tsx`, `lib/match/warning.ts` | Jenny: "title-case warning header" |
| I6 | Batch upload with live progress, concurrency-6 queue, sortable + filterable results, CSV export, retry-failed, one-click 24-label demo seed | `components/batch/*`, `lib/batch/*` | Janet: Seattle batch case, "for years" |
| I7 | One-click "Explain this rejection" (Sonnet) | `components/result/ExplainRejection.tsx`, `lib/vlm/explain.ts` | Dave: "judgment, not just matching" |
| I8 | Demo-mode sample labels (5 pre-loaded, SVG-rendered deterministically) | `public/samples/`, `scripts/generate-samples.ts`, `app/page.tsx` | Friction-free evaluation |
| I11 | Tiered model routing — Haiku → Sonnet escalation; visible badge + tooltip + summary note | `lib/verifier/index.ts`, `lib/vlm/escalate.ts`, `components/result/FieldRow.tsx`, `components/result/TieredRoutingNote.tsx` | Cost+latency optimization that's also visible |
| I13 | Bottler ↔ importer category-swap detection — demotes MISSING → REVIEW with a "wrong slot" rationale when the application's bottler value appears on the label as the importer (or vice versa) | `lib/match/field.ts → detectCategorySwap`, `lib/verifier/index.ts → applyCategorySwapDetection` | Dave: "judgment, not just matching"; matches how an experienced agent reads imported labels |
| I14 | Cost & latency telemetry surfaced in-product — every result card and the batch progress bar show the real $/call and ms/call from the OpenRouter usage payload, scored against pricing in `lib/vlm/pricing.ts` | `lib/vlm/call.ts`, `lib/vlm/pricing.ts`, `components/result/TelemetryFooter.tsx`, `components/batch/ProgressHeader.tsx` | Sarah's "5-second rule" + Marcus's $4.2M-rebuild quote — the verifier isn't a black box; reviewers can see it answer those concerns at a glance |
| I15 | Golden-dataset eval harness with 3-mode comparison — runs all 41 samples (5 single + 24 batch + 12 hard-conditions) through Tiered / Haiku-only / Sonnet-only against real OpenRouter, asserts verdict accuracy + p50/p95 + cost, commits the report so a reviewer can clone, re-run, and verify | `eval/`, `eval-results.md`, `bun run eval:compare` | The methodology a hiring partner can re-run — surfaced a counter-intuitive result (Sonnet-only is *worse* than Tiered or Haiku-only on stylized labels) that reshaped the production roadmap |

### STRETCH (Phase 6)

| # | Innovation | Status |
|---|---|---|
| I11 visibility | Tooltip on the "Reviewed by Sonnet" badge + always-on `TieredRoutingNote` summary | **Shipped** |
| I12 | Keyboard-first batch review (`j`/`k` move, `space` cycles approve/reject, `?` opens help, `Enter` toggles row) | **Shipped** |
| I5 | Streaming progressive results | **Cut** — would have required reshaping the Server Action; not worth the regression risk in Phase 6's 3h budget |
| I1 | Confidence heatmap with bbox overlay | **Cut** — depends on Haiku reliably returning bboxes; spike was a coin-flip, abandoned per PRD's "if no, abandon" guidance |

---

## 8. Stakeholder receipts

Pulled from the brief; explicit acknowledgement that the prototype answers them by name:

- **Sarah Chen** (Deputy Director) wanted throughput. Batch mode at `/batch` runs 200–300 labels with concurrency 6 + per-row progress + CSV export.
- **Dave Morrison** (28-year veteran) wanted UI that doesn't fight him and judgment, not just matching. The "STONE'S THROW vs Stone's Throw" sample is the second card on the landing page; the smart-match badge tells him *why* it matched; the "Explain this rejection" button gives him a one-paragraph human-readable reason. Tailwind base is 18px and every interactive target is ≥48px.
- **Jenny Park** (8 months in) wanted the warning verification to be airtight and the photos from her phone to "just work." The warning is exact-match against canonical text with a side-by-side red-line on failure. sharp's `.rotate()` handles the EXIF orientation flag from her sideways phone shots.
- **Janet (Seattle)** wanted the batch case "for years." It's at `/batch`: drag-drop a folder of images + a CSV (or click "Load demo batch (24 labels)" to seed instantly), watch live progress with concurrency 6, sort and filter results by status, expand any row for the full per-field detail, export to CSV, and one-click retry of failed rows. Keyboard nav (`j`/`k`/space/`?`) keeps a queue reviewer's hands on the keys.

---

## 9. Time spent

| Phase | Plan | Actual |
|---|---|---|
| Phase 1 — Scaffold + deploy + warmup | ~2h | matched |
| Phase 2 — Single-label verifier core | ~5h | matched |
| Phase 3 — Senior-friendly UI polish | ~3h | matched |
| Phase 4 — Hardening | ~2h | matched |
| Phase 5 — Batch mode | ~5h | slightly over (~5.5h) |
| Phase 6 — Stretch (I11 visibility + I12 keyboard nav) | ~3h | matched |
| Phase 7 — README + APPROACH + demo | ~2h | matched |
| **Total** | **~22h over 2–3 calendar days** | **~22h** |

---

## 10. If I had another day

The eval harness (I15) shipped, so the regression-catch-for-prompt-drift item is done; the in-product telemetry footer (I14) shipped, so the latency-visibility item is done. What's left is production-readiness, in priority order:

1. **Land Tiered's p95 back under the 5s SLO.** The eval surfaced Tiered's p95 at 6.7s on the 41-case set — over the SLO, while Haiku-only sits at 4.4s. Sonnet's warning sub-call is the obvious candidate to demote: Haiku-only is 92.7% vs Tiered's 97.6% (a 2-case gap, all in the hard-conditions set), so a focused warning-only eval on Haiku is the gate. If Haiku reads the warning verbatim with the structural flags (`headerIsAllCaps`, `headerAppearsBold`) intact, flip `lib/vlm/models.ts` and the SLO is back. If it doesn't, the fallback is per-route Sonnet only on warnings whose Haiku confidence is low.
2. **Promote diacritic + category-swap UX.** The single Tiered miss on `10-velvet-crow-tequila.jpg` is a VLM occasionally dropping a combining mark on `Destilería`. The verifier's REVIEW outcome is product-correct (the label *might* be wrong; the human should look), but in production this case wants a one-line "diacritic mismatch" explainer surfaced at the row level so the agent doesn't have to read the diff to understand it.
3. **Span-level tracing via Langfuse / Helicone / Braintrust.** OpenRouter's dashboard shows *what* happened per-call but not *why* — span-level tracing on extract / warning / escalate / tiebreak with `escalated=true` tags would make production debugging a five-minute job instead of a one-hour one. README has the production-roadmap rationale for not wiring it for the prototype.
4. **Cron-driven golden-set eval.** `bun run eval:compare` nightly on main, deltas to Slack, model upgrades gated on no-accuracy-regression. Closest thing to "CI for the AI."
5. **I5 streaming.** Render fields progressively as Haiku and Sonnet calls return. Perceived-latency win without changing the verifier — pure-frontend work and the next thing I'd touch if priority shifted from production-hardening to UX polish.
