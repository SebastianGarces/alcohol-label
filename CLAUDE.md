# Alcohol Label Verifier — Project Conventions

> Auto-generated from `presearch.md`. Read that for the *why* behind each decision; this file is the *what*.

## Tech Stack (LOCKED)

| Layer | Choice | Version |
|---|---|---|
| Runtime | Node | 22 (Vercel default) |
| Package manager | Bun | latest |
| Framework | Next.js (App Router) | 16.x |
| Language | TypeScript | latest, strict |
| UI library | shadcn/ui | latest |
| CSS | Tailwind CSS | v4 |
| Forms | react-hook-form + Zod resolver | latest |
| Validation | Zod | 4.x |
| LLM gateway | **OpenRouter** (via OpenAI SDK with `baseURL`) | — |
| LLM SDK | openai (used as the OpenRouter client) | latest |
| Image processing | sharp | latest |
| Drag-drop upload | react-dropzone | latest |
| Async state | @tanstack/react-query | v5 |
| CSV parsing | papaparse | latest |
| Diff rendering | diff | latest |
| Toasts | sonner | latest |
| Icons | lucide-react | latest |
| Lint + format | Biome | latest |
| Tests | Vitest | latest |
| Errors | Sentry | Next.js wizard latest |
| Deploy | Vercel Hobby | — |
| Storage | None (server) + IndexedDB (client cache for `explainRejection` results only) | — |

**No: ESLint, Prettier, Playwright, Postgres, SQLite, OpenCV, dedicated OCR services.** Add only if a documented gap forces it.

## Commands

```bash
bun install              # install deps
bun dev                  # start Next.js dev (http://localhost:3000)
bun run build            # production build
bun test                 # Vitest unit tests
bun test --watch         # watch mode
bun run lint             # Biome lint + format check
bun run format           # Biome format apply
bunx tsc --noEmit        # type check
bunx shadcn@latest add <component>   # add shadcn component
```

## Project Structure

```
app/
  page.tsx                    # single-label verifier UI
  batch/page.tsx              # batch upload UI
  about/page.tsx              # how-it-works page
  api/
    verify-one/route.ts       # batch unit endpoint (POST)
    warm/route.ts             # cold-start warmup
  actions.ts                  # Server Actions: verifyLabelAction, explainRejectionAction
lib/
  verifier/                   # orchestrates extract → match → result
  vlm/                        # Anthropic client wrappers (Haiku, Sonnet)
  match/                      # fuzzy match ladder, normalizers, address utils
  canonical/                  # canonical TTB texts (government warning)
  schema/                     # Zod schemas: Application, LabelExtract, etc.
  rate-limit/                 # in-memory IP rate limiter
  storage/                    # IndexedDB wrapper (rejection-explanation cache)
components/
  ui/                         # shadcn components
  result/                     # result-display components (FieldRow, WarningRedline, etc.)
  upload/                     # dropzone + queue UI
public/
  samples/                    # demo label images + samples.json manifest
```

## Architecture Rules

- **Server Action for single-label flow.** `app/actions.ts → verifyLabel(formData)`. Returns `VerificationResult`.
- **API route for batch unit work.** `/api/verify-one` accepts FormData (image + JSON application string). Client orchestrates 200-300 of these with concurrency 6.
- **No DB.** Server is pure functions. Batch state is in-memory and lost on reload (intentional — see `APPROACH.md` §5; real resume would need image blob persistence). IndexedDB is used only to cache `explainRejection` results so the second click is instant.
- **Module boundaries:**
  - `lib/vlm/` is the only module that imports the `openai` SDK (configured for OpenRouter)
  - `lib/match/` has no LLM dependencies (deterministic fuzzy match)
  - `lib/verifier/` orchestrates and is the only public-facing entrypoint
- **Zod everywhere.** Every cross-boundary type (form input, VLM output, IndexedDB record) has a Zod schema in `lib/schema/`. Use `z.infer` for types.
- **No `any`.** Use `unknown` + validation at boundaries.
- **Named exports only.** No default exports outside Next.js framework files.

## AI Rules (load-bearing)

- **All LLM traffic goes through OpenRouter.** Use the `openai` SDK with `baseURL: 'https://openrouter.ai/api/v1'` and `apiKey: process.env.OPENROUTER_API_KEY`. Recommended optional headers: `HTTP-Referer` (your deploy URL) and `X-Title: 'TTB Label Verifier'` so the OpenRouter dashboard tags requests.
- **Primary VLM: Claude Haiku 4.5** via OpenRouter slug (likely `anthropic/claude-haiku-4.5` — confirm at runtime against OpenRouter's `/models` endpoint). All field extraction.
- **Verification VLM: Claude Sonnet 4.5** via OpenRouter (likely `anthropic/claude-sonnet-4.5`). Used for: (a) low-confidence single-field escalation, (b) Jaro-Winkler tiebreak, (c) human-readable rejection explanation. The government warning sub-call also defaults to Haiku since 2026-04-30 — see `lib/vlm/warning.ts` for the eval-driven rationale.
- **Centralize model slugs in one place** (`lib/vlm/models.ts`) so swapping (Sonnet ↔ Opus, Haiku ↔ Flash) is a one-line change. OpenRouter's value is the abstraction — preserve it.
- **Routing rule:** if any extracted field has confidence <0.7, re-extract that one field via Sonnet; merge result; mark `escalated=true` on that field.
- **Parallel calls.** Field-extract Haiku call and warning Sonnet call run concurrently via `Promise.all` — they share no state.
- **Prompt cache** markers are wired on every system message via `buildCachedSystemMessage` in `lib/vlm/call.ts` — `cache_control: { type: 'ephemeral' }` is sent in the system content-block array, which OpenRouter passes through to Anthropic. **Known limitation:** Anthropic requires a ≥1024-token cached prefix; our system + tools + user-text comes to ~600-700 tokens, so cache hits don't fire today (`cached_tokens` stays 0 in the OpenRouter dashboard — verified empirically). Wiring is left in place because it's correct and harmless, and will start firing if/when system prompts grow (e.g., baking TTB regulation excerpts into the prompt). Don't remove the wiring without re-verifying.
- **Image input:** sharp pipeline mandatory: `.rotate()` (EXIF auto-orient) → `.resize(MAX_EDGE_PX, MAX_EDGE_PX, {fit: 'inside'})` → `.jpeg({ quality: 85 })`. Send as a `data:image/jpeg;base64,...` URL inside an OpenAI-format `image_url` content part. `MAX_EDGE_PX = 1280` in `lib/vlm/image.ts` (chosen for the <5s p95 SLO; Anthropic's documented max is 1568, but 1280 is sufficient for ≥10pt body text on TTB labels and saves ~600ms of p95 latency).
- **Structured output via tool use.** Use the OpenAI-style `tools` + `tool_choice: { type: 'function', function: { name: 'extract_label' } }`. Schema is the Zod schema converted with `zod-to-json-schema`. Parse `tool_calls[0].function.arguments` into the Zod schema; reject if it fails.
- **Hard timeout 4.5s** per VLM call (`AbortController`). On timeout, return partial result with `timeout=true`; don't crash.
- **Retry once** on 429 / 5xx with exp backoff (200ms, 800ms). On 401, do NOT retry — surface "Server config error."
- **Prompt-injection defense: extract-then-compare separation.** The VLM extracts; server-side `lib/match/` compares. The VLM never sees both label and application. Prompts ask for facts ("what is the brand name?"), never decisions ("does this label pass?").
- **Provider routing on OpenRouter:** specify `provider: { order: ['anthropic'], allow_fallbacks: false }` in the request to pin Claude (avoid silent re-routing to a different provider that might break tool-use shape or vision). Confirm this matches OpenRouter's current API in `lib/vlm/`.

## Verification Algorithm

For each field in `Application` (filtered by `beverageType`):
1. Find corresponding `LabelExtract` field
2. Normalize both: NFKC → trim → collapse whitespace → smart-quote→straight → lowercase
3. If equal → MATCH (`method: 'exact'`)
4. Compute Jaro-Winkler similarity
   - ≥0.95 → MATCH (`method: 'normalized'`)
   - 0.85-0.95 → Sonnet tiebreak; LLM answer drives result
   - <0.85 → MISMATCH with diff
5. Field-specific overrides:
   - **ABV:** parse numeric, exact-match number to 1 decimal place; format leniency on suffix
   - **netContents:** parse "750 mL" / "750ml" / "750 ML" as same canonical
   - **addresses:** join multi-line, normalize separators, token-set ratio ≥0.9
6. Wine 14% rule: if labeled and application ABV cross the 14% line, FAIL with code `wine_14pp_rule`

Government warning is special:
1. VLM extracts `fullText`, `headerIsAllCaps`, `headerAppearsBold`
2. Normalize whitespace + drop "(1)" / "(2)" markers
3. Exact-match against canonical text (`lib/canonical/government-warning.ts`)
4. Pass iff: text exact-match AND `headerIsAllCaps` AND `headerAppearsBold`
5. On fail, build `WarningFailure[]` for UI red-line

## Beverage-Type-Aware Required Fields

| Field | Spirits | Wine ≤14% | Wine >14% | Beer |
|---|---|---|---|---|
| brandName | required | required | required | required |
| classType | required | required | required | required |
| alcoholContent | required | optional* | required | optional* |
| netContents | required | required | required | required |
| bottlerName + bottlerAddress | required | required | required | required |
| importerName + importerAddress | conditional (imports) | conditional | conditional | conditional |
| countryOfOrigin | conditional (imports) | conditional | conditional | required (imports per 27 CFR 7.69) |
| governmentWarning | required | required | required | required |

\* Optional means: if absent on the label and the application also doesn't supply it, that's not a failure. If supplied on either, the comparison runs.

## API Rules

- All Server Actions and API routes accept and return JSON-serializable shapes that pass a Zod parse.
- All errors thrown from Server Actions become typed `Result<T, AppError>` returns to the client (don't leak stack traces to the UI).
- All API routes apply per-IP rate limiting (`lib/rate-limit/`).
- Never expose API keys to the client. No `NEXT_PUBLIC_ANTHROPIC_*`.
- File uploads: max 5MB upfront, then sharp resize to ≤1.5MB before forwarding to VLM.

## Database Rules

There is no database. The only browser persistence is an IndexedDB cache for the I7 "Explain rejection" feature:
- DB name: `label-verifier`
- Store: `explanations` (key: `${resultId}:${field}`, value: cached Sonnet plain-English rationale)
- Always wrap IndexedDB calls in try/catch with in-memory fallback (Safari incognito, blocked storage, etc.)
- Single-label and batch state are in-memory only — a reload starts fresh. A real batch resume would need image blob persistence; intentionally cut (see `APPROACH.md` §5).

## Security Rules

- Server-only env vars only: `OPENROUTER_API_KEY`, `OPENROUTER_SITE_URL?`, `OPENROUTER_APP_NAME?`, `SENTRY_DSN`. Never `NEXT_PUBLIC_*`.
- All user-uploaded images get re-encoded by sharp (strips EXIF except orientation, prevents image-based attacks).
- Rate limit: 30 single-verifies/min/IP, 1 batch/min/IP.
- OpenRouter spend cap configured per-key in dashboard at $5/day.
- No PII logged. Log image SHA-256 + dimensions + duration; never raw bytes.
- Sentry source maps uploaded via Vercel integration.

## UI / Design Rules

- **Senior-friendly defaults:** Tailwind base font 18px (override). shadcn Button default `h-12 px-6 text-base`. All interactive targets ≥48px.
- **Single primary action visible per screen.**
- **Color + icon + text** for status (never color alone).
- **Loading states are explicit:** "Reading label…" → "Verifying warning…" → "Comparing fields…" — not just a spinner.
- **Errors tell the user what to do**, not what failed technically. ("Image too dark. Try a brighter photo." not "VLM_LOW_CONFIDENCE")
- **Status palette:**
  - PASS — `green-700` / `green-50` bg, check icon
  - REVIEW — `amber-700` / `amber-50` bg, eye icon
  - FAIL — `red-700` / `red-50` bg, x-circle icon
- **Senior personas to test against:** Dave (28-year veteran, prints emails) and Sarah's mother (73, just learned to video call). If they couldn't use it, simplify.

## Testing Rules

- **Vitest** for all tests; co-located in `__tests__/` or `*.test.ts` next to source.
- Mock Anthropic SDK in tests — never make real API calls in CI.
- Minimum coverage by phase:
  - Phase 2 (verifier core): 18 tests
  - Phase 3 (UI polish): 2 tests for `explainRejection`
  - Phase 4 (hardening): 5 tests
  - Phase 5 (batch): 12 tests
- Test naming: `describe('verifier > brand name')`, not implementation-detail names.
- **No e2e tests.** The deployed prototype is the runtime check; brief deliverables don't require e2e or video.

## Environment Variables

| Var | Required | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | LLM gateway (routes to Anthropic Claude) |
| `OPENROUTER_SITE_URL` | No (recommended) | Deploy URL; tags requests on OpenRouter dashboard |
| `OPENROUTER_APP_NAME` | No (default `TTB Label Verifier`) | Shows in OpenRouter dashboard |
| `SENTRY_DSN` | Yes (prod) | Error monitoring |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Vercel-managed | Source map upload |

`.env.example` must list all of these. `.env.local` is gitignored.

## Key Constraints (non-negotiable)

- **<5s p95 single-label latency.** Drives every architecture decision.
- **No PII storage.** No DB. Image bytes never logged.
- **Government warning verification is exact-match.** No LLM judgment in the verdict path.
- **Senior-friendly UX.** Top-3 evaluation criterion.
- **Working core > ambitious incomplete.** Phase 4 must be shippable on its own.

## Reference Documents

- `presearch.md` — full decision log + ADRs
- `PRD.md` — phased implementation plan with acceptance criteria
- `dev-docs/brief.txt` — original take-home brief
- `dev-docs/research-domain.md` — TTB regulations
- `dev-docs/research-tech.md` — VLM/OCR comparison
- `dev-docs/research-eng.md` — deployment + frontend stack
- `APPROACH.md` (Phase 7) — submission writeup with eval-criteria mapping

## Stakeholder Receipts (from brief)

When in doubt, optimize for these specific people from the brief:
- **Sarah Chen** (Deputy Director) — wants throughput; batch matters
- **Dave Morrison** (28 years) — UI must not fight him; "STONE'S THROW vs Stone's Throw" must work
- **Jenny Park** (8 months) — warning verification must be airtight; auto-rotate matters
- **Janet (Seattle)** — batch upload, by name in writeup
