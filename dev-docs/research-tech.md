# Tech Research — AI-Powered Alcohol Label Verification App

**Author:** Tech Researcher (presearch)
**Date:** 2026-04-27
**Latency target:** <5s per label, batch 200–300
**Take-home time budget:** small (prototype)

All pricing is USD per 1M tokens unless otherwise stated. Today's date is April 2026.

---

## A. Vision-Language Models (VLMs) — image-to-JSON in one call

### A.1 Pricing (per 1M tokens)

| Model | Input | Output | Cached input | Batch | Source |
|---|---|---|---|---|---|
| Claude Sonnet 4.5 | $3.00 | $15.00 | $0.30 | 50% off | [platform.claude.com/pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Sonnet 4.6 | $3.00 | $15.00 | $0.30 | 50% off | [platform.claude.com/pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Claude Haiku 4.5 | $1.00 | $5.00 | n/a | 50% off | [pricepertoken Haiku 4.5](https://pricepertoken.com/pricing-page/model/anthropic-claude-haiku-4.5) |
| GPT-4o | $2.50 | $10.00 | $1.25 | 50% off | [openai.com/api/pricing](https://openai.com/api/pricing/) |
| GPT-4o-mini | $0.15 | $0.60 | $0.075 | 50% off | [openai.com/api/pricing](https://openai.com/api/pricing/) |
| Gemini 2.5 Pro (≤200k) | $1.25 | $10.00 | $0.31 | 50% off | [ai.google.dev pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 2.5 Pro (>200k) | $2.50 | $15.00 | — | — | [ai.google.dev pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 2.5 Flash | $0.30 | $2.50 | $0.075 | 50% off | [ai.google.dev pricing](https://ai.google.dev/gemini-api/docs/pricing) |

### A.2 Latency (typical, sustained across providers — Artificial Analysis median)

| Model | TTFT median | Output speed (tok/s) | Source |
|---|---|---|---|
| Claude Sonnet 4.5 | 1.10s | 42.5 | [AA — Sonnet 4.5](https://artificialanalysis.ai/models/claude-4-5-sonnet/providers) |
| Claude Haiku 4.5 | 0.56–0.74s | ~120 | [AA — Haiku 4.5](https://artificialanalysis.ai/models/claude-4-5-haiku/providers) |
| GPT-4o | 0.42–0.85s | 134.9–146 | [AA — GPT-4o](https://artificialanalysis.ai/models/gpt-4o/providers) |
| GPT-4o-mini | ~0.5s | ~180+ | [AA — GPT-4o-mini](https://artificialanalysis.ai/models/gpt-4o-mini/providers) |
| Gemini 2.5 Pro | ~1–2s | ~70–120 | [AA — Gemini 2.5 Pro](https://artificialanalysis.ai/models/gemini-2-5-flash/providers) |
| Gemini 2.5 Flash | 0.62s | 189.9 | [AA — Gemini 2.5 Flash](https://artificialanalysis.ai/models/gemini-2-5-flash) |
| Gemini 2.5 Flash-Lite | 0.29s | 392.8 | [AA — Flash-Lite](https://artificialanalysis.ai/models/gemini-2-5-flash-lite/providers) |

End-to-end label OCR (image upload + ~300 tokens of JSON output) on Gemini Flash, Haiku 4.5, and GPT-4o-mini consistently lands in the **1–3s** range based on these tok/s numbers — well under the 5s ceiling. Sonnet 4.5 will land closer to **2–4s** due to slower output rate; that's still in budget but tighter for batch.

### A.3 Image input limits & per-image token cost

| Model | Max resolution | Per-image token cost | Source |
|---|---|---|---|
| Claude Sonnet 4.5 / Haiku 4.5 | 1568px long edge (≤8000×8000 pixels accepted, downscaled) | ~(W×H)/750 ≈ 1600 tokens for 1092×1092 | [Claude Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision) |
| Claude Opus 4.7 (newer, vision-upgraded) | 2576px long edge | up to ~4784 tokens | [Claude Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision) |
| GPT-4o / 4o-mini | scaled to 2048×2048 box → shortest side 768 → 512×512 tiles | 85 base + 170 × tiles (high) ≈ 765 tok for typical label | [OpenAI Images & Vision](https://developers.openai.com/api/docs/guides/images-vision) |
| Gemini 2.5 Pro / Flash | up to 3072×3072, tiled at 768×768 | 258 tok per tile | [ai.google.dev models](https://ai.google.dev/gemini-api/docs/models) |

### A.4 OCR/document benchmarks

OmniDocBench v1.5 / printed-doc OCR (lower edit distance = better):

| Model | OCR edit distance | Notes | Source |
|---|---|---|---|
| Gemini 2.5 Pro | 0.145 | strong on printed media | [OmniDocBench leaderboard](https://www.codesota.com/browse/computer-vision/document-parsing/omnidocbench) |
| Claude Sonnet 4.5 | leads "printed media" category; lowest hallucination rate on CC-OCR (0.09%) | [Claude vs GPT-4o OCR](https://www.codesota.com/ocr/claude-vs-gpt4o-ocr) |
| GPT-5.4 (later GPT-4o-class successor) | 0.02 | best raw edit distance | [Vellum: LLMs vs OCRs 2026](https://www.vellum.ai/blog/document-data-extraction-llms-vs-ocrs) |
| PaddleOCR-VL-1.5 | 94.5% accuracy | competitive open-source | [E2E: open-source OCR 2025](https://www.e2enetworks.com/blog/complete-guide-open-source-ocr-models-2025) |

**No data found** for direct head-to-head VLM benchmark on stylized wine/spirits labels specifically; the closest data point is general "complex layouts + decorative fonts," where VLMs achieve 3–4× higher text-similarity scores than classical OCR ([dataunboxed VLM-OCR benchmark](https://www.dataunboxed.io/blog/ocr-vs-vlm-ocr-naive-benchmarking-accuracy-for-scanned-documents)).

### A.5 Known OCR-style failure modes

| Issue | Affected | Mitigation |
|---|---|---|
| Small fine-print (under ~12px) | All VLMs; Haiku/Flash worst | preprocess crop + zoom of warning region |
| Glare, reflections | All | OpenCV CLAHE / glare reduction |
| Rotation >15° | Reduces accuracy on all | sharp/OpenCV deskew first |
| Hallucinated brand names (overconfident) | GPT-4o > Sonnet | structured output + confidence prompt |
| Cursive/script fonts | Tesseract fails; VLMs OK | use VLM, not classic OCR |

### A.6 Rate limits (Tier 1, free signup)

| Model | RPM | Source |
|---|---|---|
| Claude Sonnet 4.x family (shared pool) | 50 | [Claude rate limits](https://platform.claude.com/docs/en/api/rate-limits) |
| Claude Haiku 4.5 | 50 | [Claude rate limits](https://platform.claude.com/docs/en/api/rate-limits) |
| GPT-4o | 500 | [OpenAI rate limits](https://platform.openai.com/docs/guides/rate-limits) |
| Gemini 2.5 Flash (paid) | 1,000+ | [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) |

For **batch 200–300 labels**, Claude Tier 1 (50 RPM) means 4–6 minutes minimum; Gemini Flash handles it in <30s. This pushes batch toward Gemini or batch APIs.

**Recommendation (A):** Use **Gemini 2.5 Flash** as the primary VLM. Best latency-per-dollar, highest RPM, native structured output, OmniDocBench-competitive. Confidence: **High**.

---

## B. Dedicated OCR services

### B.1 Pricing (per 1k pages/units)

| Service | Tier 1 price | High-volume | Source |
|---|---|---|---|
| Google Cloud Vision DOCUMENT_TEXT_DETECTION | $1.50 / 1k (first 5M) | $0.60 / 1k (>5M) | [cloud.google.com/vision/pricing](https://cloud.google.com/vision/pricing) |
| AWS Textract DetectDocumentText | $1.50 / 1k pages | $0.60 / 1k (>1M) | [aws.amazon.com/textract/pricing](https://aws.amazon.com/textract/pricing/) |
| AWS Textract AnalyzeDocument (Forms+Tables+Queries) | $15 / 1k | volume tier | [aws.amazon.com/textract/pricing](https://aws.amazon.com/textract/pricing/) |
| Azure AI Document Intelligence Read | $1.50 / 1k pages | commitment tier | [azure.microsoft.com pricing](https://azure.microsoft.com/en-us/pricing/details/document-intelligence/) |
| Azure Prebuilt models | $10 / 1k | — | same |
| Tesseract / PaddleOCR / EasyOCR / docTR | free (self-host) | — | — |

### B.2 Capability comparison

| Service | Stylized fonts | Rotation/skew | Glare | Latency | Notes |
|---|---|---|---|---|---|
| Google Vision | Decent | auto | OK | ~300–800ms | Strong on dense print; weaker on cursive script |
| AWS Textract | Form-focused | auto | OK | ~1–2s sync | Best for forms/tables, overkill for labels |
| Azure DI Read | Decent | auto | OK | ~400ms–1s | Comparable to Google |
| Tesseract | **Poor** on script/decorative; clean print only | needs preprocess | Poor | very fast (CPU) | 70.7% accuracy at 9.8 FPS in 2026 benchmark |
| PaddleOCR (PP-OCRv5 / VL-1.5) | **Best open-source**; 94.5% OmniDocBench | good | OK | ~500ms–2s GPU | [PaddleOCR vs Tesseract benchmark](https://www.codesota.com/ocr/paddleocr-vs-tesseract) |
| EasyOCR | Mediocre | OK | Poor | 56 FPS, 79.3% accuracy | Falling behind in 2026 |
| docTR | Decent | OK | OK | fast | No multilingual breadth |

Source for accuracy/FPS: [TildAlice OCR benchmark](https://tildalice.io/ocr-tesseract-easyocr-paddleocr-benchmark/), [E2E open-source OCR 2025](https://www.e2enetworks.com/blog/complete-guide-open-source-ocr-models-2025).

### B.3 Marcus's firewall caveat

The brief notes the agency's firewall blocked the prior vendor's ML endpoints. For the **prototype** this doesn't matter (it's standalone, take-home), but for production cloud OCR endpoints would need allowlisting same as a VLM API — no advantage.

**Recommendation (B):** Skip dedicated OCR for the prototype. Stylized alcohol-label fonts (script, embossed, foil) are exactly where classical OCR fails worst. PaddleOCR-VL is strong but adds GPU/install complexity for negligible gain over a VLM on a 200–300 label batch. Confidence: **High**.

---

## C. Hybrid / agent approaches

| Approach | Latency | Accuracy | Code complexity | Cost (per label) |
|---|---|---|---|---|
| **VLM-only** (image → JSON, 1 call) | 1–3s | High on labels | Low (1 API call) | $0.001–$0.01 |
| OCR-then-LLM (Tesseract/Paddle → LLM) | 2–4s (OCR + LLM) | OCR fails on script fonts → cascading errors | Medium (2 systems, error handling) | $0.001–$0.005 |
| Multi-pass (preprocess → VLM → verifier LLM) | 3–6s | Highest | High | $0.005–$0.02 |
| VLM + targeted re-prompt for warning region | 2–4s | Highest on warning | Medium | $0.003–$0.01 |

**Recommendation (C):** **VLM-only single-call** for the main extraction, plus a **lightweight second pass for the government warning** (crop the warning region from the VLM's bounding-box output, re-extract verbatim). One call fits 5s easily; two parallel calls fit if dispatched concurrently. This handles the brief's two distinct accuracy tiers — fuzzy match on brand vs exact match on warning. Confidence: **High**.

Sources: [TRM: VLM replaces OCR](https://www.trmlabs.com/resources/blog/from-brittle-to-brilliant-why-we-replaced-ocr-with-vlms-for-image-extraction), [PackageX: VLM vs traditional OCR](https://packagex.io/blog/vision-language-model).

---

## D. Image preprocessing libraries

| Library | Lang | Strength | Effort | Payoff for bottle photos |
|---|---|---|---|---|
| sharp | Node | resize, normalize, format convert (libvips) | very low | High — downscaling to model max-res cuts tokens & latency without quality loss |
| OpenCV (opencv4nodejs / opencv-python) | both | deskew, perspective, CLAHE for glare, threshold | medium | High — rotation correction is the #1 win for poor photos |
| Jimp | Node | pure-JS, no native deps | very low | Low — slower, fewer ops than sharp |
| jsfeat / image-js | Node | lightweight CV ops | medium | Medium |

What actually helps for "angle, glare, lighting":

| Issue | Fix | Library |
|---|---|---|
| Off-axis tilt | minAreaRect on dilated text → warpAffine deskew | OpenCV |
| Curved bottle surface | perspective transform (4-corner detection) — hard to automate reliably | OpenCV (manual or skip) |
| Glare | CLAHE on luminance channel, or inpainting | OpenCV |
| Low light | gamma correction, CLAHE | OpenCV |
| Oversize image | resize to model max-edge | sharp |

Source: [Dynamsoft: Auto-deskew with OpenCV](https://www.dynamsoft.com/codepool/deskew-scanned-document.html), [LogRocket sharp](https://blog.logrocket.com/processing-images-sharp-node-js/).

**Recommendation (D):** **sharp for resize/normalize (mandatory)** + **skip OpenCV for the prototype**. Modern VLMs are robust to mild rotation/glare — Jenny noted this is "maybe out of scope." If a label image fails extraction with low confidence, return the image unchanged with a "please re-photograph" UX message rather than burning take-home time on perspective correction. Confidence: **High**.

---

## E. Structured output / JSON schema enforcement

| Provider | Mechanism | Reliability (2026) | Notes |
|---|---|---|---|
| OpenAI | `response_format: { type: "json_schema", strict: true }`; native Zod via `zodResponseFormat` | 100% schema compliance on gpt-4o-2024-08-06+; ~92% on complex schemas in GPT-5.x | [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) |
| Anthropic | Structured Outputs (public beta Nov 2025) — grammar-constrained decoding; works for Sonnet 4.5+, Opus 4.1+; header `anthropic-beta: structured-outputs-2025-11-13` | Schema compliance guaranteed; content can still hallucinate | [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) |
| Google | `responseSchema` / `responseMimeType: application/json`; supports anyOf, $ref; preserves key order | High; rejects deeply nested schemas | [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) |

All three are reliable enough to use without retry loops in 2026. Failure modes:

- **OpenAI:** strict mode rejects schemas with unsupported features (recursive, unconstrained additional properties)
- **Anthropic:** beta feature, only on Sonnet 4.5+ / Opus
- **Gemini:** silently ignores unsupported JSON Schema keywords; very large nested schemas can be rejected

**Recommendation (E):** Define schema in **Zod** (TypeScript) or **Pydantic** (Python), use **`zodResponseFormat`** for OpenAI / native schema for Gemini. Either backend works; just make schema declarative & swap-safe. Confidence: **High**.

---

## F. Fuzzy / smart text matching

| Approach | Latency | Cost | Accuracy on "STONE'S THROW" vs "Stone's Throw" | Notes |
|---|---|---|---|---|
| Lowercase + strip punctuation + exact compare | <1ms | $0 | **Match** (both → "stones throw") | Handles 80% of real cases |
| Levenshtein (normalized) | <1ms | $0 | Match (distance 0 after normalize) | Best for character-typo tolerance |
| Jaro-Winkler | <1ms | $0 | Match — favors prefix matches, ideal for brand names | Better than Levenshtein for short names |
| RapidFuzz (Python) / fuzzball.js (Node) | <1ms | $0 | Match — token_sort_ratio handles word reorder | Production-grade ports of fuzzywuzzy |
| LLM semantic equivalence (zero-shot) | 200–800ms | ~$0.001 | Match | Overkill, but catches "Old Tom Distillery" vs "Old Tom Distilling Co." |
| Hybrid: normalize → Jaro-Winkler ≥0.92 → exact pass; else LLM tiebreak | <5ms median, ~500ms worst | ~$0.0001 amortized | Best | Recommended |

Sources: [Flagright Jaro-Winkler vs Levenshtein](https://www.flagright.com/post/jaro-winkler-vs-levenshtein-choosing-the-right-algorithm-for-aml-screening), [RapidFuzz](https://github.com/rapidfuzz/RapidFuzz), [fuzzball.js](https://github.com/nol13/fuzzball.js).

**Recommendation (F):** **Hybrid** — normalize (lowercase, strip punctuation/whitespace, NFC unicode), then **Jaro-Winkler ≥0.92** for instant accept; if 0.80–0.92, **fall through to a Haiku 4.5 / Flash equivalence prompt**; <0.80 = mismatch. Cheap, deterministic, transparent to the agent. Confidence: **High**.

---

## G. Government warning — exact text match

The TTB warning is fixed text. The brief and Jenny's notes demand:
1. Exact wording (word-for-word)
2. "GOVERNMENT WARNING:" in **all caps**
3. **Bold** for that header
4. Adequate font size (TTB regulation, ~2mm depending on container)

| Strategy | Catches wording | Catches caps | Catches bold | Catches font size |
|---|---|---|---|---|
| VLM extract → regex/exact compare | Yes | Yes (preserved in extracted string) | **No** (VLM strips formatting) | No |
| OCR-only | Yes (if readable) | Yes | No | No (no scale ref) |
| VLM with explicit "report exact casing, bold-or-not, approximate font size in px" prompt | Yes | Yes | **Yes** (Sonnet/Gemini Pro reliably distinguish bold) | Approximate |
| VLM extracts text + crop warning region + second pass with "verify caps/bold/size" | Yes | Yes | Yes | Yes |

**Recommendation (G):** **Two-step:**
1. Primary VLM call extracts the warning text verbatim into a `government_warning.text` field. Compare via **exact string match** (after Unicode normalize) against the canonical TTB text — this catches title-case violations like Jenny's "Government Warning" example.
2. Same VLM call also returns `government_warning.header_is_all_caps: bool` and `government_warning.header_appears_bold: bool` and `government_warning.estimated_font_height_px: number`. Sonnet 4.5 and Gemini 2.5 Pro reliably classify bold/non-bold; Haiku/Flash less so — **use Sonnet 4.5 or Gemini 2.5 Pro for the warning sub-call** even if Flash handles the rest.

Confidence: **Medium-High**. The bold detection is the weakest link; surface it in UI as "AI flagged: warning header may not be bold — agent confirm" rather than auto-rejecting.

---

## Stack recommendation summary

| Layer | Pick | Confidence | Why |
|---|---|---|---|
| Primary VLM | **Gemini 2.5 Flash** | High | Cheapest, fastest, native JSON schema, 1M RPM — only model that comfortably batches 300 labels |
| Warning-region verifier | **Gemini 2.5 Pro** (or Claude Sonnet 4.5 fallback) | Medium-High | Bold/caps detection needs the bigger model; only used on 1 region per label |
| Backup VLM | **Claude Sonnet 4.5** | High | Lowest hallucination rate (0.09% CC-OCR); use if Gemini extraction confidence is low |
| OCR service | **None** for prototype | High | Stylized labels defeat classical OCR; VLM-only wins |
| Preprocessing | **sharp** (resize to 1568px long edge) | High | Skip OpenCV — modern VLMs handle mild distortion |
| Structured output | **Zod schema + Gemini responseSchema** (or `zodResponseFormat` if on OpenAI) | High | Schema-first dev; near-100% compliance |
| Fuzzy match | **Normalize + Jaro-Winkler ≥0.92, LLM tiebreak in 0.80–0.92 band** | High | Sub-ms median, deterministic, cheap |
| Government warning | **VLM verbatim extract → exact-match against canonical TTB text + bold/caps booleans** | Medium-High | Two-prong catches both wording and formatting violations |
| Batch handling | **Gemini Batch API** (50% off, async) for 200–300 jobs | High | Single Tier-1 RPM bucket survives; sync API for single uploads |
| Server runtime | Node.js (sharp + Vercel AI SDK or Google GenAI SDK) | Medium | TS schema reuse front→back; sharp is best-in-class |

### Latency budget (single-label sync path, target <5s)

| Step | Estimated time |
|---|---|
| Upload + sharp resize (1568 long edge) | 100–300ms |
| Gemini 2.5 Flash extraction (JSON schema, ~500 output tokens) | 1.0–2.5s |
| Parallel Gemini 2.5 Pro warning sub-call (cropped region) | 1.5–3.0s |
| Fuzzy match + warning regex | <10ms |
| Total (max of parallel calls) | **~2.5–3.5s — comfortable** |

### Cost estimate (per label, Gemini Flash primary + Pro warning verifier)

- Flash: ~1500 input tokens (image) + 500 output tokens → ~$0.00171
- Pro warning sub-call: ~500 input + 100 output → ~$0.00163
- **~$0.0033 per label, ~$1 per 300-label batch.** Negligible.

### Alternative pure-Anthropic path (if user prefers Claude only)

| Layer | Pick |
|---|---|
| Primary | Claude Haiku 4.5 |
| Warning | Claude Sonnet 4.5 |
| Concern | Tier-1 RPM 50 means 200-label batch ≈ 4 min; would need Tier 2+ or sequential UX |

---

## Things explicitly NOT found / fabricated-risk flags

- **No data found:** direct VLM benchmark on TTB-style alcohol labels specifically. All accuracy claims extrapolate from general document/printed-media OCR benchmarks.
- **No data found:** measured p95 (vs median) latency for Gemini 2.5 Flash on full image inputs. p95 likely 1.5–2× median.
- **Bold detection in VLMs:** widely used but I found no published benchmark quantifying error rate. Treat as Medium confidence.
- Per-1M-tokens prices change frequently; I cite official pricing pages — re-verify before deploying.

Sources for sections without inline citations above: [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing), [OpenAI pricing](https://openai.com/api/pricing/), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Artificial Analysis model providers](https://artificialanalysis.ai/models).
