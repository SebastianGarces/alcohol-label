# Engineering Research — AI Alcohol Label Verification (Take-Home)

Scope: deployment, frontend stack, dev-velocity tradeoffs for a 1-3 day prototype that needs batch upload (200-300 images), <5s single-label verification, public URL, env-secret-managed LLM calls, and a senior-friendly UI. All numbers below are cited from current docs/pricing pages (April 2026).

---

## 1. Deployment Platforms

The hard constraints from the brief: image uploads of a few MB each, batches of 200-300, server-side LLM calls, env secrets, and "free or near-free" for demo traffic. The two non-negotiable technical filters are **request body size** (image upload path) and **function duration** (batch processing).

| Platform | Free tier exists? | Function timeout (free / paid) | Body size limit | Deploy from `git push` | 2026 notes |
|---|---|---|---|---|---|
| Vercel Hobby | Yes (non-commercial) | 10s Hobby / 300s default, 800s max on Pro w/ Fluid Compute | 4.5 MB per request | ~30s after push (auto on push) | Hobby restricts commercial use; 1M function invocations + 100GB transfer/mo free |
| Railway | Trial only ($5 one-time, expires 30d) | No function-style timeout (long-running container) | No platform-level body cap | ~1-2 min from connected repo | No free tier anymore; Hobby is $5/mo with $5 included usage |
| Fly.io | No (trial: 2 VM-hours / 7 days) | None (long-running VM) | None | ~1-3 min via `fly deploy` | Free tier removed Oct 2024; pay-as-you-go, ~$5/mo minimum |
| Render | Yes (web service) | None (long-running, but spins down after 15 min idle, ~60s cold start) | None | ~2-3 min from connected repo | Free Postgres expires after 30 days; 100GB bandwidth, 500 build min/mo |
| Cloudflare Pages + Workers | Yes (very generous) | No HTTP duration limit; CPU time capped (10ms free / 30s+ paid) | 100 MB per request (Workers) | ~30-60s | Free plan: 100k req/day; subrequest hard limits removed Feb 2026 but free still capped at 50 external subrequests per invocation |
| Cloudflare R2 (image storage) | 10 GB + 1M Class A + 10M Class B ops/mo free | n/a | n/a | n/a | $0 egress is the killer feature |
| VPS (Hetzner/DO + Docker) | No (~$5/mo cheapest) | None | None | 5-15 min initial; subsequent via CI | Overkill for 1-3 day take-home unless you already have a stack ready |

**Source citations:** Vercel function limits ([vercel.com/docs/functions/limitations](https://vercel.com/docs/functions/limitations), [vercel.com/docs/limits](https://vercel.com/docs/limits)); Vercel Fluid Compute 800s ([vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute)); Vercel 4.5 MB bypass ([vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)); Railway pricing ([railway.com/pricing](https://railway.com/pricing), [docs.railway.com/pricing/free-trial](https://docs.railway.com/pricing/free-trial)); Fly.io free tier dead ([community.fly.io/t/free-tier-is-dead/20651](https://community.fly.io/t/free-tier-is-dead/20651), [fly.io/docs/about/pricing/](https://fly.io/docs/about/pricing/)); Render free service ([render.com/docs/free](https://render.com/docs/free)); Cloudflare Workers limits ([developers.cloudflare.com/workers/platform/limits/](https://developers.cloudflare.com/workers/platform/limits/), [developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/)); R2 pricing ([developers.cloudflare.com/r2/pricing/](https://developers.cloudflare.com/r2/pricing/)).

### The 4.5 MB Vercel gotcha (matters for batch)

Vercel's 4.5 MB body limit is per-request to a Function. For 200-300 images at "a few MB each," you cannot POST a single archive through a Function — you'd need either (a) client-side parallel single-file POSTs that each fit, or (b) presigned uploads direct to object storage (R2/S3/Vercel Blob) bypassing the Function entirely. Vercel Blob is the documented bypass path. Either pattern is fine for a take-home; pattern (a) is simpler if each image is <4.5 MB.

### The 10s Hobby timeout

Single-label verification has a 5s budget — Hobby's 10s ceiling is fine for one image. Batch is the worry: if you process server-side serially in one Function call you will trip 10s. Solution: client orchestrates the batch (parallel POSTs, one-image-per-Function-call), each call easily fits in 10s. This also gives you free per-item progress for the UI. No Pro upgrade needed.

**Recommendation for this take-home:** **Vercel Hobby + client-driven batch fan-out**. Zero-config deploy, env vars in dashboard, public URL on `git push`, free fits the demo, and the 10s/4.5MB limits are dodgeable with the right client pattern. Cloudflare Pages is the runner-up if you specifically want R2 for image persistence.

---

## 2. Frontend Framework + Routing

| Framework | Maturity (Apr 2026) | Server-side LLM calls | Streaming UI | Image upload story | Take-home fit |
|---|---|---|---|---|---|
| Next.js 16 (App Router) | Stable; v16.2.4 current; React 19.2 under the hood | Server Actions, Route Handlers, RSC | Suspense + PPR built-in | FormData + Route Handler, or Server Action | Excellent — Vercel-native, biggest ecosystem |
| React Router v7 (Framework Mode) | Stable; v7.14 current; Remix merged into it | Loaders/actions, runs on Vite + Node/Edge | Defer + streaming via Vite | Standard FormData action | Good — but no first-class Vercel adapter feel |
| SvelteKit | Stable since 1.0 (2022); Svelte 5 mature | Form actions, +server.ts | Streaming SSR | FormData in actions | Good DX but smaller ecosystem; risk for AI/LLM SDK examples |
| Vite + React + Hono on Bun | All stable, but it's "you build the wiring" | Hono routes, manual | Manual SSE | Manual | Worst velocity for take-home |

**Source citations:** Next.js 16 release ([nextjs.org/blog/next-16](https://nextjs.org/blog/next-16)); App Router streaming ([nextjs.org/docs/app/guides/streaming](https://nextjs.org/docs/app/guides/streaming)); React Router v7 framework mode ([remix.run/blog/react-router-v7](https://remix.run/blog/react-router-v7), [remix.run/blog/merging-remix-and-react-router](https://remix.run/blog/merging-remix-and-react-router)); SvelteKit 2026 ([svelte.dev/blog/whats-new-in-svelte-march-2026](https://svelte.dev/blog/whats-new-in-svelte-march-2026)).

For a take-home, "biggest ecosystem of copy-paste examples" is the dominant factor — every Anthropic / OpenAI Vision SDK quickstart targets Next.js first. RSC + Server Actions also collapse the form-upload-and-verify path to roughly 30 lines of code. The senior-friendly UI requirement does not push the framework choice; UI library does (see §3). Vanilla Vite + Hono is faster at runtime but slower to scaffold the API+SSR+routing+streaming wiring you'd otherwise get free.

A common 2026 gotcha: Next 16 changed default caching to **opt-in** (Cache Components), so old "I added a fetch and it cached forever" footguns are gone — but you still need to be aware that `dynamic` runs at request time by default now. Don't waste time fighting cache during a take-home.

**Recommendation for this take-home:** **Next.js 16 App Router**. Best example density, native to Vercel, server-side LLM calls land in a Route Handler in 5 minutes, streaming partial results comes free.

---

## 3. UI Component Library + Styling

The brief explicitly invokes a 73-year-old user and "Dave still prints emails." This means: large hit targets (44-64px), high contrast, generous spacing, obvious primary actions, no disappearing affordances. The library should make these defaults *easy*, not require fighting design tokens.

| Library | Bundle weight | Accessibility (WAI-ARIA) | Big-button defaults | Customization for "senior-friendly" | Velocity for take-home |
|---|---|---|---|---|---|
| shadcn/ui + Tailwind v4 | Tree-shakeable, you copy code; v4 = single CSS | Built on Radix; full WAI-ARIA | Default Button is medium (~36px); easy to enlarge via Tailwind size-* utilities | Highest — you own the source, edit token CSS once | High once you've used it before |
| Radix primitives only | Tiny, headless | Best-in-class WAI-ARIA | None (unstyled) | Maximum, but you're styling from zero | Low for 1-3 days |
| Mantine | Heavier; bundled package | WAI-ARIA, 120+ components | Components have `size="xl"` props out of the box | Lower — overriding theme needs MantineProvider config | High — most "batteries-included" of the four |
| Chakra UI / Park UI | Mid | Good WAI-ARIA | Sizing props on all components | Theme tokens via Panda CSS (Park) or Chakra theme | Medium |

**Source citations:** shadcn Tailwind v4 status ([ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4), [ui.shadcn.com/docs/changelog](https://ui.shadcn.com/docs/changelog)); Mantine vs shadcn ([saasindie.com/blog/mantine-vs-shadcn-ui-comparison](https://saasindie.com/blog/mantine-vs-shadcn-ui-comparison), [zenn.dev/ui_memo/articles/4d49d34685e027](https://zenn.dev/ui_memo/articles/4d49d34685e027?locale=en)).

For "big buttons, obvious affordances, generous whitespace," **shadcn + Tailwind v4** wins because (a) the components are *your* code so you bump `h-10 px-4` to `h-14 px-8 text-lg` once and it propagates, (b) Tailwind v4 `@theme` makes token edits one-line, (c) the senior-friendly look (oversized buttons, plain text labels, no hidden hover states) is a 5-minute Tailwind tweak rather than a theme provider config. Mantine is a strong second if you've never used shadcn — its `size="xl"` props get you 80% of the senior look immediately, but customizing typography scale requires more commitment than the deadline allows.

**Recommendation for this take-home:** **shadcn/ui + Tailwind v4**, with one global tweak: bump default button to `h-12 text-base`, set base font to 18px, and use a 2-color palette (one safe, one warning). This is ~15 lines of CSS-token override total.

---

## 4. File Upload UX Patterns

| Pattern | Memory cost | Progress UX | Failure recovery | Fit for 200-300 file batch |
|---|---|---|---|---|
| Single multipart POST of all files | High (server holds all in memory) | All-or-nothing | All-or-nothing — catastrophic | Bad |
| Client-side queue, parallel POSTs (4-8 concurrent) | Low — browser streams each | Per-file progress is trivial | Per-file retry, partial success | Excellent |
| Single zip upload | Medium client / high server (unzip) | Coarse | Hard | OK only if individual files are tiny |
| Presigned URL → direct to S3/R2 → notify backend | Lowest server load | Per-file via XHR upload events | Per-file | Best for production; slight extra wiring for take-home |
| Chunked / resumable (tus, UploadThing) | Low | Excellent | Excellent | Overkill for take-home |

**Source citations:** ([pkgpulse.com/blog/best-file-upload-libraries-react-2026](https://www.pkgpulse.com/blog/best-file-upload-libraries-react-2026), [docs.uploadthing.com/api-reference/react](https://docs.uploadthing.com/api-reference/react), [react-dropzone.js.org](https://react-dropzone.js.org/)).

Library picks in 2026: **react-dropzone** remains the dominant headless drag-drop hook (~5M weekly downloads). UploadThing is a managed full-stack alternative but adds a vendor and an account; not worth it for a take-home where you control the backend. Native `<input type="file" multiple>` with a styled wrapper is also defensible — react-dropzone is mostly a few hundred lines of accessibility and validation niceties on top.

For 200-300 files: client builds a queue, runs N=4-6 in parallel (browser-side concurrency limit), each POST is one image to a Route Handler that does one LLM call. Backpressure is automatic from the queue. Per-file status feeds a progress UI (TanStack Query mutations + a Zustand store works great here). This dodges Vercel's 4.5 MB body limit (single image fits) and the 10s timeout (single-image LLM call is well under 5s per the brief). Total wall time for 300 files at ~3s/call with 6 concurrent ≈ 150s — perfectly fine for batch.

Client-side image preview (thumbnail via `URL.createObjectURL`) and rotation (canvas `rotate()` before re-encoding to blob) are 30-line utilities. EXIF orientation handling matters — `browser-image-compression` is the lightest 2026 lib that reads EXIF and re-orients before upload.

**Recommendation for this take-home:** **react-dropzone + client-queued parallel POSTs (concurrency=6) + TanStack Query mutations for per-file status.** Skip presigned URLs unless you hit the 4.5 MB ceiling.

---

## 5. State Management / Data Fetching

| Tool | Use case | Take-home cost |
|---|---|---|
| Server Actions (Next.js) | Form submit → server LLM call → return | Lowest — built in |
| TanStack Query v5 | Per-file mutation state, batch progress, cache | Medium — `npm i`, set up provider |
| Zustand | Ephemeral UI state (modal open, selected file) | Tiny — 1 file, no provider |
| Redux / RTK | — | Don't |
| Jotai | — | Optional alt to Zustand |

**Source citations:** ([tanstack.com/query/v5/docs/framework/react/overview](https://tanstack.com/query/v5/docs/framework/react/overview), [tanstack.com/blog/react-server-components](https://tanstack.com/blog/react-server-components)).

The leanest pattern for this app:
- **Server Actions** for the verify-one-label endpoint (JSON in, JSON out).
- **TanStack Query mutations** to fan out 300 mutations from the client, surfacing per-item `isPending / isError / data`. Built-in concurrency control via custom mutation keys + a manual semaphore (or just `Promise.all` over chunks of 6).
- **Zustand** only if you need a global "current batch" store the components share without prop drilling. For a take-home, `useState` in a top-level page is usually enough.

TanStack Query v5 explicitly does not consume `'use server'` actions — you call them like normal async functions inside `mutationFn`. That's the canonical pattern in 2026 RSC codebases.

**Recommendation for this take-home:** **Server Actions + TanStack Query for mutations, Zustand only if you need it.** Skip Redux/Jotai.

---

## 6. Testing / Lint / Typecheck

| Tool | Setup time | Signals quality | Skip for take-home? |
|---|---|---|---|
| TypeScript strict | Already on in Next template | Yes | Never skip |
| Biome (lint+format) | <2 min, single config | Yes | Use it |
| ESLint + Prettier | 10-15 min, multiple configs | Yes but slower | Skip in favor of Biome |
| Vitest (unit) | 5 min | Yes for pure functions (LLM response parsers, validators) | Keep ~3-5 tests |
| Playwright (e2e) | 30+ min, flaky on time budget | High signal but expensive | Skip; do a recorded demo instead |
| `tsc --noEmit` in CI | 1 min | Yes | Always |

**Source citations:** ([pkgpulse.com/blog/biome-vs-eslint-prettier-linting-2026](https://www.pkgpulse.com/blog/biome-vs-eslint-prettier-linting-2026), [fireup.pro/news/pre-commit-hooks-15x-faster-biome-vs-eslint-case-study](https://fireup.pro/news/pre-commit-hooks-15x-faster-biome-vs-eslint-case-study)).

Biome is 10-25× faster than ESLint+Prettier on TypeScript codebases (50k+ LOC), and it's a single config file plus single binary versus 6+ packages. The known gap is type-aware rules and `eslint-plugin-react-hooks` / `next` plugin coverage. For a 1-3 day take-home, the rule gap is irrelevant — you'll write a few thousand LOC with no plugin needs. Biome saves you the entire `.eslintrc + .prettierrc + override config` rabbit hole.

Test budget for a take-home:
- 3-5 Vitest tests on the LLM-response → typed-result parser (this is the highest-value place to demonstrate quality — it's where the AI integration is most likely to break).
- A Zod schema for the LLM JSON output, with a "schema validates known good fixture" test.
- `tsc --noEmit` in a tiny GitHub Action.
- No Playwright. Replace with a 90-second screen-recorded demo committed as `demo.mp4`.

**Recommendation for this take-home:** **Biome + TypeScript strict + Vitest for the parser layer + tsc in CI.** Skip Playwright; record a demo instead.

---

## 7. Observability for a Prototype

| Tool | Free tier (2026) | Wire-up time | Demo-day value |
|---|---|---|---|
| Sentry | 5k errors + 10k perf units / mo, 30-day retention, 1 user | 5 min via wizard | High — catches LLM JSON parse failures live |
| Helicone | 10k requests/mo free, one-line proxy | 2 min (just change base URL) | High — full LLM trace + cost per call |
| Langfuse Cloud | Generous free tier (trace-based pricing) | 10 min (SDK + decorators) | Higher fidelity, but more code |
| `console.log` to Vercel Logs | Free, built-in | 0 min | Low but adequate |

**Source citations:** ([sentry.io/pricing](https://sentry.io/pricing/), [docs.sentry.io/pricing/](https://docs.sentry.io/pricing/)); Helicone ([github.com/helicone/helicone](https://github.com/helicone/helicone), [morphllm.com/comparisons/helicone-vs-langsmith](https://www.morphllm.com/comparisons/helicone-vs-langsmith)); Langfuse ([langfuse.com/docs/observability/overview](https://langfuse.com/docs/observability/overview)).

For a demo-day prototype, the highest-leverage trace is the LLM call itself. **Helicone** is the cheapest possible win: change the OpenAI/Anthropic `baseURL` to Helicone's proxy URL, add a header with your API key, and you instantly get every request, response, latency, and cost in a dashboard you can show during the interview. That's a 60-second integration with massive demo polish.

Sentry is also worth it for catching the inevitable "JSON parse failed because the model returned prose" error on stage. The Next.js Sentry wizard (`npx @sentry/wizard@latest -i nextjs`) is a 5-minute install and the free tier easily covers a take-home demo.

Skip Langfuse — it's the more powerful tool but the wiring (decorators, sessions, scoring) is overkill for one prompt called from one Route Handler.

**Recommendation for this take-home:** **Helicone proxy + Sentry via Next.js wizard.** Combined: ~7 minutes setup, both visible during the live demo.

---

## 8. Database — Does this app need one?

The brief says no PII and no persistent storage required. But there's an asymmetric upside: showing batch *history* during the demo (a list of "jobs you ran" with their results) is a strong visual differentiator that almost no other candidate will bother with.

| Option | Infra | Persistence across deploys | Demo upside | Cost |
|---|---|---|---|---|
| No DB (pure stateless) | None | None | Lowest | $0 |
| In-memory + localStorage | None | Per-browser only | Some — batch survives reload | $0 |
| SQLite file + Drizzle | Bundled with app | Lost on Vercel redeploy (ephemeral FS); fine on Render/Fly with volume | Medium | $0 |
| libSQL / Turso + Drizzle | One env var, 9GB free | Survives | High | $0 |
| Neon Postgres | One env var | Survives; 0.5 GB / 100 CU-hours free per project | High | $0 |
| Supabase | One env var, includes auth + storage | Survives | High but bigger surface area | $0 to start |

**Source citations:** Drizzle SQLite ([orm.drizzle.team/docs/get-started-sqlite](https://orm.drizzle.team/docs/get-started-sqlite)); better-sqlite3 vs libsql ([pkgpulse.com/blog/better-sqlite3-vs-libsql-vs-sql-js-sqlite-nodejs-2026](https://www.pkgpulse.com/blog/better-sqlite3-vs-libsql-vs-sql-js-sqlite-nodejs-2026)); Neon free tier ([neon.com/pricing](https://neon.com/pricing), [neon.com/blog/new-usage-based-pricing](https://neon.com/blog/new-usage-based-pricing)).

The trap to avoid: **don't put `better-sqlite3` on Vercel**. Vercel Functions have ephemeral, per-instance filesystems — the SQLite file is reset between cold starts, and concurrent Functions can't share it. SQLite *only* works with a deploy target that gives you a persistent volume (Fly.io, Render with disk, or libSQL/Turso as a network DB).

Given Vercel is the deploy recommendation, the practical persistence picks are:
- **localStorage** (zero infra, scoped per browser — fine for "demo on my laptop" but loses points if the interviewer reloads from another device)
- **Neon Postgres + Drizzle** (one connection string env var, a `jobs` and `results` table, ~30 min total wiring including schema and migration)

Neon's free tier (0.5 GB storage, 100 CU-hours/mo per project, branching included) is plenty for a demo. Supabase is more powerful but you don't need auth or row-level security for this brief.

**Recommendation for this take-home:** **Neon Postgres + Drizzle** if you want batch history visible (recommended for the senior-judge polish). **localStorage only** if you're tight on time on day 1 — you can add Neon on day 2 without rewriting anything since the schema is small.

---

## Recommended Stack Table

| Layer | Pick | Why | Confidence |
|---|---|---|---|
| Deployment | Vercel Hobby | `git push` to public URL, env-secret UI, free, native to Next.js, Hobby's 10s/4.5MB limits dodged by client-driven batch | High |
| Framework | Next.js 16 (App Router) | Largest example density for LLM SDKs, RSC + Server Actions collapse upload+verify path, streaming free | High |
| UI library | shadcn/ui + Tailwind v4 | You own the component code, so "bigger buttons / 18px base / 2-color palette" for senior-friendly is a 15-line edit | High |
| File upload | react-dropzone + client queue (concurrency 6) + TanStack Query mutations | Per-file progress, parallel speed, fits inside Vercel limits per request | High |
| State / data | Server Actions + TanStack Query v5 + (optional) Zustand | Leanest 2026 pattern; no Redux | High |
| LLM call | Direct from Route Handler via official SDK; route through Helicone proxy | Single-line proxy gives free observability + cost tracking | High |
| Persistence | Neon Postgres + Drizzle (or localStorage only on day 1) | Free tier covers demo, adds batch-history demo polish; SQLite would be a Vercel footgun | Medium |
| Lint/format | Biome | 10-25× faster, single config, no plugin friction in a small repo | High |
| Typecheck | TypeScript strict + `tsc --noEmit` in CI | Baseline quality signal | High |
| Tests | Vitest on the LLM-response Zod parser (~5 tests) | Highest-value test surface for AI integration | High |
| E2E | Skip; record a 90s demo video | Playwright cost > value at this budget | High |
| Observability | Helicone (proxy) + Sentry (Next.js wizard) | Two short installs, both visible in demo, both free for this volume | High |
| Image storage | None (process and forget); R2 if you want thumbnails persisted | Brief says no persistence required; only add R2 if Neon-backed history needs image URLs | Medium |

### Two non-obvious risks the architect should price in

1. **Vercel Hobby's "non-commercial" clause.** The brief is a take-home for a commercial company. Strictly, Hobby is not licensed for commercial use. In practice nobody enforces this for an interview prototype, but if the agent wants to be cautious, Cloudflare Pages is a clean alternative with no commercial-use restriction.
2. **The 5s single-label budget is mostly an LLM latency budget, not an infra budget.** Anthropic Claude vision and OpenAI GPT-4o vision both typically return in 2-4s for a single image at standard prompt sizes; trim the prompt and request short JSON output to stay safe. If the chosen model has p95 > 5s, infra choices won't save you.

Sources:
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Vercel Limits](https://vercel.com/docs/limits)
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby)
- [Vercel maxDuration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Vercel Fluid Compute changelog](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute)
- [Vercel body-size bypass guide](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)
- [Railway Pricing](https://railway.com/pricing)
- [Railway Free Trial](https://docs.railway.com/pricing/free-trial)
- [Fly.io Pricing](https://fly.io/docs/about/pricing/)
- [Fly.io free tier dead thread](https://community.fly.io/t/free-tier-is-dead/20651)
- [Render Free Docs](https://render.com/docs/free)
- [Render Pricing](https://render.com/pricing)
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers subrequests changelog Feb 2026](https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Next.js 16 release notes](https://nextjs.org/blog/next-16)
- [Next.js streaming guide](https://nextjs.org/docs/app/guides/streaming)
- [React Router v7 announcement](https://remix.run/blog/react-router-v7)
- [Remix → React Router merge](https://remix.run/blog/merging-remix-and-react-router)
- [SvelteKit March 2026 update](https://svelte.dev/blog/whats-new-in-svelte-march-2026)
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui changelog](https://ui.shadcn.com/docs/changelog)
- [Mantine vs shadcn (SaaSIndie)](https://saasindie.com/blog/mantine-vs-shadcn-ui-comparison)
- [Best file upload libraries 2026](https://www.pkgpulse.com/blog/best-file-upload-libraries-react-2026)
- [react-dropzone](https://react-dropzone.js.org/)
- [UploadThing React docs](https://docs.uploadthing.com/api-reference/react)
- [TanStack Query v5 overview](https://tanstack.com/query/v5/docs/framework/react/overview)
- [TanStack RSC blog](https://tanstack.com/blog/react-server-components)
- [Biome vs ESLint+Prettier 2026](https://www.pkgpulse.com/blog/biome-vs-eslint-prettier-linting-2026)
- [Biome pre-commit case study](https://fireup.pro/news/pre-commit-hooks-15x-faster-biome-vs-eslint-case-study)
- [Sentry pricing](https://sentry.io/pricing/)
- [Sentry pricing docs](https://docs.sentry.io/pricing/)
- [Helicone GitHub](https://github.com/helicone/helicone)
- [Helicone vs LangSmith 2026](https://www.morphllm.com/comparisons/helicone-vs-langsmith)
- [Langfuse observability docs](https://langfuse.com/docs/observability/overview)
- [Drizzle SQLite docs](https://orm.drizzle.team/docs/get-started-sqlite)
- [better-sqlite3 vs libsql 2026](https://www.pkgpulse.com/blog/better-sqlite3-vs-libsql-vs-sql-js-sqlite-nodejs-2026)
- [Neon Pricing](https://neon.com/pricing)
- [Neon usage-based pricing blog](https://neon.com/blog/new-usage-based-pricing)
