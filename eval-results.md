# Eval Results

> Generated: 2026-04-29T02:22:52.203Z · Commit: 9306068 · Run cost: $1.34

## Summary

| Mode | Verdict accuracy | p50 latency | p95 latency | Total cost | Cost/label |
|---|---|---|---|---|---|
| **Tiered** (Haiku + Sonnet, default) | 28/29 (96.6%) | 4.0s | 5.8s | $0.4170 | $0.0144 |
| Haiku only | 28/29 (96.6%) | 3.2s | 6.8s | $0.2314 | $0.0080 |
| Sonnet only | 26/29 (89.7%) | 5.5s | 6.5s | $0.6939 | $0.0239 |

**Headline:** Tiered routing is **107.7%** as accurate as all-Sonnet at **60%** of the cost.

## Per-field accuracy (Tiered mode)

> Per-field accuracy treats `match`, `fuzzy_match`, and `skipped` as correct (the field passed verification or was not required for this case). `mismatch` and `missing` are wrong. Fields not present on a given case are excluded from its denominator.

| Field | Correct | Total | Accuracy |
|---|---|---|---|
| brandName | 29 | 29 | 100.0% |
| classType | 29 | 29 | 100.0% |
| alcoholContent | 26 | 29 | 89.7% |
| netContents | 29 | 29 | 100.0% |
| bottlerName | 29 | 29 | 100.0% |
| bottlerAddress | 29 | 29 | 100.0% |
| importerName | 1 | 1 | 100.0% |
| importerAddress | 1 | 1 | 100.0% |
| countryOfOrigin | 0 | 1 | 0.0% |

## Verdict differences (Tiered mode)

| File | Expected | Got | Notes |
|---|---|---|---|
| 10-velvet-crow-tequila.jpg | pass | fail | countryOfOrigin missing: "Mexico" vs "" |

## Mode-by-mode failures (compare runs)

| File | Expected | Tiered mode | Haiku-only mode | Sonnet-only mode |
| --- | --- | --- | --- | --- |
| 02-black-pine-malt.jpg | pass | OK (pass) | OK (pass) | **fail** |
| 09-old-anchor-rye.jpg | pass | OK (pass) | OK (pass) | **fail** |
| 10-velvet-crow-tequila.jpg | pass | **fail** | **fail** | **fail** |

## Methodology

- Cases: 5 single-label samples + 24 batch samples (29 total).
- Each mode is a `Partial<VerifierDeps>` override on the production verifier (`lib/verifier/index.ts`). No code path forks.
- All calls go through OpenRouter with `provider: { order: ['anthropic'], allow_fallbacks: false }` so model identity is pinned.
- Cost computed from token usage × pricing in `lib/vlm/pricing.ts` (Anthropic public pricing for Claude 4.5 family; cached input billed at 1/10).
- Latency is wall-clock per case, including image read and any in-process retries.
- Concurrency 4. Per-case timeout 60s. Total run cost cap $1.00 (aborts remaining cases on breach).
- Run with: `bun run eval:compare`
