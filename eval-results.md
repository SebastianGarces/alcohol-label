# Eval Results

> Generated: 2026-04-30T16:16:39.792Z · Commit: ade683d · Run cost: $1.34

## Summary

| Mode | Verdict accuracy | p50 latency | p95 latency | Total cost | Cost/label |
|---|---|---|---|---|---|
| **Tiered** (Haiku extract + warning, Sonnet escalate/tiebreak — default) | 41/44 (93.2%) | 3.2s | 5.0s | $0.3554 | $0.0081 |
| Haiku only (no Sonnet escalate/tiebreak) | 42/44 (95.5%) | 3.1s | 4.8s | $0.3524 | $0.0080 |
| Sonnet warning (the pre-2026-04-30 Tiered) | 43/44 (97.7%) | 3.9s | 6.1s | $0.6359 | $0.0145 |

**Headline:** Tiered 93.2% accuracy / p95 5.0s vs Haiku-only 95.5% / p95 4.8s — Haiku-only runs at **99%** of Tiered's cost. Both modes meet the <5s p95 SLO.

## Per-field accuracy (Tiered mode)

> Per-field accuracy scores **outcome correctness**, not label-match. For cases the manifest expects to pass/review, the field counts correct iff its status is `match`, `fuzzy_match`, or `skipped`. For expected-fail cases, the field counts correct iff the per-case verdict matched expectation — `mismatch` is the *right* outcome there, and shouldn't be counted as a verifier error. Fields not present on a given case are excluded from its denominator.

| Field | Correct | Total | Accuracy |
|---|---|---|---|
| brandName | 44 | 44 | 100.0% |
| classType | 44 | 44 | 100.0% |
| alcoholContent | 44 | 44 | 100.0% |
| netContents | 44 | 44 | 100.0% |
| bottlerName | 44 | 44 | 100.0% |
| bottlerAddress | 44 | 44 | 100.0% |
| importerName | 2 | 2 | 100.0% |
| importerAddress | 2 | 2 | 100.0% |
| countryOfOrigin | 2 | 2 | 100.0% |

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
| single | 8/8 (100.0%) | 8/8 (100.0%) | 8/8 (100.0%) |
| batch | 23/24 (95.8%) | 23/24 (95.8%) | 23/24 (95.8%) |
| hard (degraded) | 10/12 (83.3%) | 11/12 (91.7%) | 12/12 (100.0%) |

## Limitations

- **Sample size (44).** Even with the hard set added, mode-vs-mode accuracy deltas of 1–2 cases are inside the noise floor. Treat ties as ties.
- **Synthetic degradations.** The hard set is sharp transforms (modulate, blur, affine, white-radial composites) on top of clean SVG-rendered labels. Real phone shots add chromatic noise, JPEG compression artifacts, and motion blur the synthetic pipeline doesn't reproduce. Consider this an upper-bound on real-world accuracy.
- **No font diversity.** All labels use Georgia + Helvetica. A real production eval would source 50+ TTB-public COLA artwork samples across designers and printers.
- **Government warning is canonical English text only.** Spanish-language warnings (TTB allows them in some markets) and unusual layouts (warning split across two faces) are out of scope for this prototype.
- **Sonnet escalation/tiebreak rate is rare on this set.** If the route doesn't fire, you can't measure its contribution from these numbers — see telemetry counts (`telemetry.routerEscalations`) per case to confirm.

## Methodology

- Cases: 5 single + 24 batch + 12 hard-conditions (44 total). Hard cases apply sharp transforms (low-light, glare, tilt, blur, perspective shear) on top of clean batch labels — see `scripts/generate-hard.ts`.
- Each mode is a `Partial<VerifierDeps>` override on the production verifier (`lib/verifier/index.ts`). No code path forks.
- All calls go through OpenRouter with `provider: { order: ['anthropic'], allow_fallbacks: false }` so model identity is pinned.
- Cost computed from token usage × pricing in `lib/vlm/pricing.ts` (Anthropic public pricing for Claude 4.5 family; cached input billed at 1/10).
- Latency is wall-clock per case, including image read and any in-process retries.
- Concurrency 4. Per-case timeout 60s. Total run cost cap $1.00 per mode (aborts remaining cases on breach).
- Run with: `bun run eval:compare`
