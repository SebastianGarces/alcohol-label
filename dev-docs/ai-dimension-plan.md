# AI-Dimension Plan

> Goal: maximize AI-Native Software Engineer signal in the take-home submission by adding production-grade evaluation, observability, and cost transparency around the existing verifier. No new infra (no Langfuse, no DB, no Vercel Blob). All work lands in the same repo and deploys with the existing Vercel project.

**Pinned interfaces below are authoritative.** When phases interact, they interact through these shapes. If a phase needs to change a pinned shape, it must propose the change to the team lead first.

---

## Phases & ownership

| Phase | Owner agent | Wave | Hours | Status |
|---|---|---|---|---|
| A. Telemetry capture in `lib/vlm/` + model parameterization | `instrumentation` | 1 | 1.5 | pending |
| C. In-product telemetry UI | `ui-telemetry` | 2 | 1.0 | pending |
| D+E. Eval harness + report renderer | `eval-harness` | 2 | 3.5 | pending |
| F. Docs (README + APPROACH + production-roadmap) | `docs` | 3 | 1.0 | pending |
| Buffer | — | — | 1.0 | — |
| **Total** | | | **8.0** | |

Wave 1 must complete before Wave 2 starts (Wave 2 depends on the telemetry shape). Wave 2 agents run in parallel; they touch disjoint files. Wave 3 runs after Wave 2.

---

## Phase A — Telemetry capture (Wave 1, owner: `instrumentation`)

### What

1. **Refactor `lib/vlm/call.ts`** — `callChat()` currently returns the raw `ChatCompletion`. Replace with a wrapper that returns `VlmCallResult` (see *Pinned interface 1* below). Capture `latencyMs` from `Date.now()` deltas around the SDK call. Capture `usage` from `completion.usage` (OpenRouter passes through `prompt_tokens`, `completion_tokens`, and — when caching is active — `prompt_tokens_details.cached_tokens`).
2. **Parameterize the model** in each VLM wrapper:
   - `extractLabel(dataUrl, opts, model = MODELS.HAIKU)`
   - `extractWarning(dataUrl, opts, model = MODELS.SONNET)`
   - `escalateField(dataUrl, field, opts, model = MODELS.SONNET)`
   - `tiebreak(field, app, label, opts, model = MODELS.SONNET)`
   - Defaults preserve current behavior. The eval harness overrides them for mode comparison.
3. **Return telemetry from each wrapper.** Each wrapper currently returns its parsed payload only. Change the return type to `{ value: T, telemetry: VlmCallTelemetry }`. Update all call sites in `lib/verifier/index.ts`.
4. **Aggregate in the verifier.** Collect per-call telemetry into `VerificationResult.telemetry` (see *Pinned interface 2*). Sum `costUsd` and `latencyMs` across all calls in the verification.
5. **Cost lookup table** in `lib/vlm/pricing.ts`:
   ```ts
   export const PRICING_USD_PER_MTOK: Record<ModelSlug, { input: number; output: number; cachedInput: number }> = {
     [MODELS.HAIKU]:  { input: 1.0, output: 5.0,  cachedInput: 0.10 }, // Anthropic public pricing for Claude Haiku 4.5 (verify against the live OpenRouter /models endpoint at runtime if uncertain — leave a TODO if so)
     [MODELS.SONNET]: { input: 3.0, output: 15.0, cachedInput: 0.30 },
   };
   export function computeCostUsd(model: ModelSlug, usage: VlmUsage): number { ... }
   ```
6. **Schema update.** Add `telemetry` field to `VerificationResult` Zod schema in `lib/schema/result.ts`. Make it optional initially so old cached results in IndexedDB don't blow up Zod parses (defensive; cache is in-memory, so realistically not an issue, but easier than a migration).
7. **Tests** in `lib/vlm/__tests__/call.test.ts` and `lib/verifier/__tests__/verifier.test.ts`:
   - `callChat` returns `latencyMs > 0` and forwards `usage` from a mocked completion
   - `computeCostUsd` math is correct (verify with a hand-computed case)
   - `verifyLabel` aggregates per-call telemetry into `VerificationResult.telemetry` (sum cost, sum latency, per-call breakdown)
   - Cached results preserve telemetry from the original verification (don't double-count)

### Pinned interface 1 — `VlmCallResult`

```ts
// lib/vlm/call.ts
export type VlmUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number; // 0 if no cache hit
};

export type VlmCallTelemetry = {
  model: ModelSlug;
  latencyMs: number;
  usage: VlmUsage;
  costUsd: number;
};

export type VlmCallResult<T> = {
  value: T;
  telemetry: VlmCallTelemetry;
};
```

### Pinned interface 2 — `VerificationResult.telemetry`

```ts
// lib/schema/result.ts
export const VerificationTelemetry = z.object({
  totalLatencyMs: z.number(),
  totalCostUsd: z.number(),
  calls: z.array(z.object({
    purpose: z.enum(["extract", "warning", "escalate", "tiebreak"]),
    model: z.string(),  // model slug
    latencyMs: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    cachedInputTokens: z.number(),
    costUsd: z.number(),
  })),
});

// VerificationResult gets:  telemetry: VerificationTelemetry.optional()
```

### Acceptance for Phase A

- [ ] All existing 90 tests still pass (`bun run test`)
- [ ] New tests added for telemetry capture + cost math
- [ ] `bunx tsc --noEmit` clean
- [ ] `bun run lint` clean
- [ ] Manually verify in `bun dev` that a single label produces a `VerificationResult` with populated `telemetry`
- [ ] No regression in p95 latency (telemetry is bookkeeping; should add <1ms)

### Hand-off to Wave 2

Once Phase A merges, the `instrumentation` agent posts a SendMessage to `team-lead` with:
- The exact `VerificationResult.telemetry` shape (in case it drifted)
- One example real `telemetry` payload from a manual `bun dev` run

`team-lead` (me) then unblocks Wave 2 agents.

---

## Phase C — In-product telemetry UI (Wave 2, owner: `ui-telemetry`)

### What

1. **Single-label result** (`components/result/ResultDisplay.tsx`):
   - Add a footer row beneath the field-by-field section
   - Format: `Verified in 2.4s · $0.0028 · 2 model calls (Haiku $0.0009 · Sonnet $0.0019)`
   - Cost displayed to 4 significant digits, rounded
   - Hidden if `result.telemetry` is undefined (graceful degradation)
   - Senior-friendly: 16px text, muted color (graphite), no jargon
2. **Batch header** (`components/batch/ProgressHeader.tsx`):
   - Add to the live progress bar: `42/300 · 3 review · 1 fail · $0.118 spent · avg 2.6s · ETA 2m 14s`
   - Compute spent as `sum(rows.where(r => r.status === 'done').result.telemetry.totalCostUsd)`
   - Compute avg as `sum(rows.done.result.telemetry.totalLatencyMs) / count(rows.done)`
   - Survives partial state (some rows have telemetry, some don't)
3. **Batch row detail** (`components/batch/ResultsTable.tsx`):
   - Expanded row already shows the full `ResultDisplay`; the new footer comes for free
4. **No new lib files.** Pure presentation. If you find yourself writing currency-formatting logic, put it in `lib/utils.ts` (already exists).
5. **Tests** — minimum 2:
   - `ResultDisplay` renders cost/latency footer when telemetry present
   - `ResultDisplay` hides footer cleanly when telemetry absent (e.g., cached result from before telemetry shipped)

### Acceptance for Phase C

- [ ] Tests pass; lint + typecheck clean
- [ ] Manual: load `/`, run a sample, see footer with real numbers
- [ ] Manual: load `/batch`, run the 24-label demo, see live cost rolling up in the progress header
- [ ] Cost format: `$0.0028` not `$0.002800` not `$2.8e-3`
- [ ] No regression in existing component tests

### Coordination with `eval-harness`

If you discover the telemetry shape from Phase A is missing something useful for the UI (e.g., the verifier didn't surface `cachedInputTokens` per-call), SendMessage `team-lead` to negotiate.

---

## Phase D+E — Eval harness + report (Wave 2, owner: `eval-harness`)

### What

1. **Directory layout:**
   ```
   eval/
     index.ts        # CLI entry: parses args, dispatches modes, writes report
     cases.ts        # Loads 5 single + 24 batch cases from public/samples/
     runner.ts       # runEval(cases, mode) → EvalRun
     modes.ts        # Three mode definitions (tiered, haiku-only, sonnet-only)
     report.ts       # Renders eval-results.md from one or more EvalRuns
     types.ts        # EvalCase, EvalRun, EvalCaseResult shapes
   ```

2. **`package.json` scripts** (add):
   ```json
   {
     "eval": "bun eval/index.ts --mode=tiered",
     "eval:compare": "bun eval/index.ts --mode=tiered,haiku-only,sonnet-only",
     "eval:dry": "bun eval/index.ts --mode=tiered --dry-run"
   }
   ```

3. **Cases** (29 total):
   - 5 single from `public/samples/samples.json` (image path + applicationData + expectedStatus)
   - 24 batch from `public/samples/batch/manifest.json` joined with `public/samples/batch/applications.csv` by `filename`. Use `papaparse` for the CSV (already a dep).

4. **Modes** — implemented as `Partial<VerifierDeps>` overrides:
   - `tiered`: empty override (default behavior — Haiku extract + Sonnet for warning, escalate, tiebreak)
   - `haiku-only`: override `extractWarning`, `escalateField`, `tiebreak` to use Haiku
   - `sonnet-only`: override `extractLabel` to use Sonnet
   - All other deps preserved.
   - Use Phase A's parameterized model arg to swap.

5. **Runner** (`eval/runner.ts`):
   - Loads each case, reads image bytes from disk, calls `verifyLabel(buffer, application, modeDeps)`
   - Per-case timeout: 60s (10× the user-facing 5s budget — eval is allowed to be slow)
   - **Hard cost cap: $1.00 total per `runEval` invocation.** Track running cost; if exceeded, log a warning, abort remaining cases, mark them `aborted`, return partial results.
   - **Concurrency: 4** (lower than batch's 6 — eval runs are accuracy-sensitive, we don't want OpenRouter rate-limit retries to skew p95 timings)
   - Captures per-case: verdict, expected verdict, fields, warning, telemetry, latency, errors

6. **Report** (`eval/report.ts`) writes `eval-results.md` at repo root. **Format pinned below — see *Pinned interface 3*.** Commit-SHA from `process.env.VERCEL_GIT_COMMIT_SHA ?? execSync('git rev-parse HEAD').toString().trim()`.

7. **Tests** (`eval/__tests__/`):
   - `cases.test.ts`: loads 29 cases, validates shape, no missing files
   - `runner.test.ts`: with mocked verifier deps, verdict-comparison logic works (correct verdict = pass, wrong verdict = fail)
   - `report.test.ts`: renders deterministic markdown given a fixed `EvalRun` fixture

8. **Run it once for real before submission.** Commit the resulting `eval-results.md`. The committed file is part of the deliverable.

### Pinned interface 3 — `eval-results.md` shape

```markdown
# Eval Results

> Generated: 2026-04-29T03:14:22Z · Commit: ebaa27f · Run cost: $0.31

## Summary

| Mode | Verdict accuracy | p50 latency | p95 latency | Total cost | Cost/label |
|---|---|---|---|---|---|
| **Tiered** (Haiku + Sonnet, default) | 28/29 (96.6%) | 2.4s | 3.8s | $0.084 | $0.0029 |
| Haiku only | 26/29 (89.7%) | 1.8s | 2.9s | $0.038 | $0.0013 |
| Sonnet only | 29/29 (100%) | 4.1s | 5.6s | $0.224 | $0.0077 |

**Headline:** Tiered routing is **96.6%** as accurate as all-Sonnet at **38%** of the cost.

## Per-field accuracy (Tiered mode)

| Field | Correct | Total | Accuracy |
|---|---|---|---|
| brandName | 29 | 29 | 100% |
| classType | 28 | 29 | 96.6% |
| alcoholContent | 29 | 29 | 100% |
| netContents | 29 | 29 | 100% |
| bottlerName | 27 | 28 | 96.4% |
| bottlerAddress | 26 | 28 | 92.9% |
| governmentWarning | 29 | 29 | 100% |

## Verdict differences (Tiered mode)

| File | Expected | Got | Notes |
|---|---|---|---|
| 17-westcliff-rose.jpg | pass | review | Vintage year confidence 0.62 → escalated to Sonnet, still review |

## Mode-by-mode failures (compare runs)

[Per-mode table of cases where verdict ≠ expected; helps spot which mode is the right tradeoff for which case type]

## Methodology

- Cases: 5 single-label samples + 24 batch samples (29 total)
- Each mode = a `Partial<VerifierDeps>` override on the production verifier
- All calls go through OpenRouter to Anthropic-pinned providers
- Cost computed from token usage × pricing table in `lib/vlm/pricing.ts`
- Run with: `bun run eval:compare`
```

### Acceptance for Phase D+E

- [ ] `bun run eval:dry` exits in <2s using fixtures, validates plumbing
- [ ] `bun run eval` runs in `tiered` mode, produces `eval-results.md`, real OpenRouter cost < $0.20
- [ ] `bun run eval:compare` runs all three modes; total cost stays under hard cap
- [ ] `eval-results.md` renders cleanly in GitHub preview
- [ ] All existing tests still pass; new eval tests pass
- [ ] Commit SHA in report matches HEAD
- [ ] If a case errors, it appears in the report with the error rather than silently dropping

### Coordination

If Phase A's telemetry shape doesn't include something you need (e.g., per-call cached-token detail for a "cache effectiveness" sub-table), SendMessage `team-lead`.

---

## Phase F — Docs (Wave 3, owner: `docs`)

### What

1. **README.md** — add two sections:
   - **Evaluation** (after Operations): one paragraph + link to `eval-results.md` + the headline number ("Tiered routing is 96.6% as accurate as all-Sonnet at 38% of the cost")
   - **Production roadmap** (after Known limits): bullets naming what was *intentionally* deferred — Langfuse for span-level tracing, Vercel Blob (or similar) for persistent batch image storage and resume, an OpenRouter-fallback path with direct Anthropic, etc. Keep it concrete and short — this is roadmap signal, not vapor.
2. **APPROACH.md** — three updates:
   - **§3 (AI strategy)** — add a paragraph at the end about the observability story: why we chose OpenRouter dashboard + committed `eval-results.md` over Langfuse/Helicone for a take-home (with a one-line "for production we'd wire Langfuse"). Show the reasoning.
   - **§7 (Innovation inventory)** — add two CORE rows:
     - I14: Cost & latency telemetry surfaced in-product (per-result + batch rollup)
     - I15: Golden-dataset eval harness with three-mode comparison
   - **§10 (If I had another day)** — drop "concurrent OpenRouter / direct-Anthropic dual path" if shipped, and the eval-harness item (now shipped); add the production roadmap items so this section stays a meaningful "what's next" list.
3. **Commit message hook** — when committing the doc updates, the message should explicitly call out the new artifacts so a reviewer browsing `git log` sees them.

### Acceptance for Phase F

- [ ] README has Evaluation + Production roadmap sections, both linkable from the table of contents (no TOC currently — skip if it doesn't have one)
- [ ] APPROACH §3, §7, §10 updated; numbers in §7 match what was actually shipped
- [ ] No claims that contradict implementation reality (no "real-time Langfuse traces" if we didn't wire it)
- [ ] `eval-results.md` link works (relative path)

---

## Out of scope (intentional cuts)

- Langfuse / Helicone / Braintrust wiring — see `APPROACH.md §3` for the rationale (added in Phase F)
- Persistent batch resume with image blob storage — see `APPROACH.md §5` (already there)
- CI integration of the eval (manual `bun run eval` only)
- Per-historical-commit eval regression (`git log` is the version history)
- New sample labels — the 29 we have cover the relevant cases
- New model providers (no Gemini, no GPT-4 — adds a fourth mode without strengthening the AI-Native narrative)

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `eval:compare` blows the cost cap before all modes run | Hard `$1.00` cap with abort + partial-results report |
| OpenRouter rate-limits during eval | Concurrency 4; existing retry-on-429 already in `callChat` |
| OpenRouter usage shape drifts (cached tokens schema changes) | Defensive parsing in `lib/vlm/pricing.ts`; treat missing fields as 0 |
| Phase A telemetry shape proves wrong for Phase C/D's needs | SendMessage to team-lead; renegotiate before Wave 2 ends |
| Doc claims drift from impl in Phase F | Phase F runs *last*; agent is told to verify each claim against the code |
| Two eval modes give nearly identical results, so the comparison is uninteresting | Acceptable; the methodology and infrastructure is the signal, not the magnitude of the deltas |
