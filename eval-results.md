# Eval Results

> Generated: 2026-04-30T14:24:48.176Z · Commit: 24d0744 · Run cost: $1.75

## Summary

| Mode | Verdict accuracy | p50 latency | p95 latency | Total cost | Cost/label |
|---|---|---|---|---|---|
| **Tiered** (Haiku extract + Sonnet warning/escalate, default) | 40/41 (97.6%) | 4.7s | 6.7s | $0.5897 | $0.0144 |
| Haiku only | 38/41 (92.7%) | 3.5s | 4.4s | $0.3274 | $0.0080 |
| Sonnet only | 37/41 (90.2%) | 6.0s | 7.0s | $0.8291 | $0.0202 |

**Headline:** Tiered 97.6% accuracy / p95 6.7s vs Haiku-only 92.7% / p95 4.4s — Haiku-only runs at **56%** of Tiered's cost. Haiku-only meets the <5s p95 SLO; Tiered does not (6.7s).

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

## Mode-by-mode failures (compare runs)

| File | Expected | Tiered mode | Haiku-only mode | Sonnet-only mode |
| --- | --- | --- | --- | --- |
| 02-black-pine-malt.jpg | pass | OK (pass) | OK (pass) | **fail** |
| 09-old-anchor-rye.jpg | pass | OK (pass) | OK (pass) | **fail** |
| 10-velvet-crow-tequila.jpg | pass | **review** | **review** | **fail** |
| 02-black-pine-glare.jpg | pass | OK (pass) | OK (pass) | **fail** |
| 03-wildflower-tilt-12.jpg | pass | OK (pass) | **fail** | OK (pass) |
| 12-sundown-tilt-25.jpg | pass | OK (pass) | **fail** | OK (pass) |

## Accuracy by case source

> Hard-conditions are sharp-degraded labels (low-light, glare, tilt, blur, shear). Numbers there are an upper bound — see Limitations.

| Source | Tiered mode | Haiku-only mode | Sonnet-only mode |
| --- | --- | --- | --- |
| single | 5/5 (100.0%) | 5/5 (100.0%) | 5/5 (100.0%) |
| batch | 23/24 (95.8%) | 23/24 (95.8%) | 21/24 (87.5%) |
| hard (degraded) | 12/12 (100.0%) | 10/12 (83.3%) | 11/12 (91.7%) |

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
