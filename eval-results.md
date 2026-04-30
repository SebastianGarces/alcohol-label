# Eval Results

> Generated: 2026-04-30T14:43:06.793Z · Commit: 62c4192 · Run cost: $1.24

## Summary

| Mode | Verdict accuracy | p50 latency | p95 latency | Total cost | Cost/label |
|---|---|---|---|---|---|
| **Tiered** (Haiku extract + warning, Sonnet escalate/tiebreak — default) | 38/41 (92.7%) | 3.5s | 4.2s | $0.3274 | $0.0080 |
| Haiku only (no Sonnet escalate/tiebreak) | 39/41 (95.1%) | 3.4s | 3.9s | $0.3274 | $0.0080 |
| Sonnet warning (the pre-2026-04-30 Tiered) | 40/41 (97.6%) | 4.4s | 5.3s | $0.5897 | $0.0144 |

**Headline:** Tiered 92.7% accuracy / p95 4.2s vs Haiku-only 95.1% / p95 3.9s — Haiku-only runs at **100%** of Tiered's cost. Both modes meet the <5s p95 SLO.

## Per-field accuracy (Tiered mode)

> Per-field accuracy scores **outcome correctness**, not label-match. For cases the manifest expects to pass/review, the field counts correct iff its status is `match`, `fuzzy_match`, or `skipped`. For expected-fail cases, the field counts correct iff the per-case verdict matched expectation — `mismatch` is the *right* outcome there, and shouldn't be counted as a verifier error. Fields not present on a given case are excluded from its denominator.

| Field | Correct | Total | Accuracy |
|---|---|---|---|
| brandName | 41 | 41 | 100.0% |
| classType | 41 | 41 | 100.0% |
| alcoholContent | 41 | 41 | 100.0% |
| netContents | 41 | 41 | 100.0% |
| bottlerName | 41 | 41 | 100.0% |
| bottlerAddress | 41 | 41 | 100.0% |
| importerName | 1 | 1 | 100.0% |
| importerAddress | 1 | 1 | 100.0% |
| countryOfOrigin | 1 | 1 | 100.0% |

## Verdict differences (Tiered mode)

| File | Expected | Got | Notes |
|---|---|---|---|
| 10-velvet-crow-tequila.jpg | pass | review | verdict differs |
| 03-wildflower-tilt-12.jpg | pass | fail | warning fail: wording |
| 12-sundown-tilt-25.jpg | pass | fail | warning fail: wording |

## Mode-by-mode failures (compare runs)

| File | Expected | Tiered mode | Haiku-only mode | Sonnet-warning mode |
| --- | --- | --- | --- | --- |
| 10-velvet-crow-tequila.jpg | pass | **review** | **review** | **review** |
| 03-wildflower-tilt-12.jpg | pass | **fail** | **fail** | OK (pass) |
| 12-sundown-tilt-25.jpg | pass | **fail** | OK (pass) | OK (pass) |

## Accuracy by case source

> Hard-conditions are sharp-degraded labels (low-light, glare, tilt, blur, shear). Numbers there are an upper bound — see Limitations.

| Source | Tiered mode | Haiku-only mode | Sonnet-warning mode |
| --- | --- | --- | --- |
| single | 5/5 (100.0%) | 5/5 (100.0%) | 5/5 (100.0%) |
| batch | 23/24 (95.8%) | 23/24 (95.8%) | 23/24 (95.8%) |
| hard (degraded) | 10/12 (83.3%) | 11/12 (91.7%) | 12/12 (100.0%) |

## Limitations

- **Sample size (41).** Even with the hard set added, mode-vs-mode accuracy deltas of 1–2 cases are inside the noise floor. Treat ties as ties.
- **Synthetic degradations.** The hard set is sharp transforms (modulate, blur, affine, white-radial composites) on top of clean SVG-rendered labels. Real phone shots add chromatic noise, JPEG compression artifacts, and motion blur the synthetic pipeline doesn't reproduce. Consider this an upper-bound on real-world accuracy.
- **No font diversity.** All labels use Georgia + Helvetica. A real production eval would source 50+ TTB-public COLA artwork samples across designers and printers.
- **Government warning is canonical English text only.** Spanish-language warnings (TTB allows them in some markets) and unusual layouts (warning split across two faces) are out of scope for this prototype.
- **Sonnet escalation/tiebreak rate is rare on this set.** If the route doesn't fire, you can't measure its contribution from these numbers — see telemetry counts (`telemetry.routerEscalations`) per case to confirm.

## Methodology

- Cases: 5 single + 24 batch + 12 hard-conditions (41 total). Hard cases apply sharp transforms (low-light, glare, tilt, blur, perspective shear) on top of clean batch labels — see `scripts/generate-hard.ts`.
- Each mode is a `Partial<VerifierDeps>` override on the production verifier (`lib/verifier/index.ts`). No code path forks.
- All calls go through OpenRouter with `provider: { order: ['anthropic'], allow_fallbacks: false }` so model identity is pinned.
- Cost computed from token usage × pricing in `lib/vlm/pricing.ts` (Anthropic public pricing for Claude 4.5 family; cached input billed at 1/10).
- Latency is wall-clock per case, including image read and any in-process retries.
- Concurrency 4. Per-case timeout 60s. Total run cost cap $1.00 per mode (aborts remaining cases on breach).
- Run with: `bun run eval:compare`
