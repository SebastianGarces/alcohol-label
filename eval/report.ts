import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import type { EvalCaseResult, EvalRun } from "./types";

export type ReportInputs = {
  runs: EvalRun[];
  generatedAt?: string;
  commitSha?: string;
};

function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtMs(ms: number): string {
  if (ms <= 0) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtUsd(n: number): string {
  if (n === 0) return "$0.0000";
  // 4 significant digits, leading "$".
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(4)}`;
}

function ratio(c: number, t: number): string {
  if (t === 0) return "0/0";
  return `${c}/${t} (${fmtPct(c / t)})`;
}

function getCommitSha(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    const out = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    return out.slice(0, 7);
  } catch {
    return "unknown";
  }
}

function modeLabel(mode: string): string {
  switch (mode) {
    case "tiered":
      return "**Tiered** (Haiku extract + warning, Sonnet escalate/tiebreak — default)";
    case "haiku-only":
      return "Haiku only (no Sonnet escalate/tiebreak)";
    case "sonnet-warning":
      return "Sonnet warning (the pre-2026-04-30 Tiered)";
    case "sonnet-only":
      return "Sonnet only";
    default:
      return mode;
  }
}

function summaryRow(run: EvalRun): string {
  return `| ${modeLabel(run.mode)} | ${ratio(run.correctCases, run.totalCases)} | ${fmtMs(run.p50LatencyMs)} | ${fmtMs(run.p95LatencyMs)} | ${fmtUsd(run.totalCostUsd)} | ${fmtUsd(run.costPerLabelUsd)} |`;
}

function summaryTable(runs: EvalRun[]): string {
  const header = [
    "| Mode | Verdict accuracy | p50 latency | p95 latency | Total cost | Cost/label |",
    "|---|---|---|---|---|---|",
  ];
  return [...header, ...runs.map(summaryRow)].join("\n");
}

const SLO_P95_MS = 5_000;

function headlineLine(runs: EvalRun[]): string | null {
  const tiered = runs.find((r) => r.mode === "tiered");
  const haiku = runs.find((r) => r.mode === "haiku-only");
  if (!tiered || !haiku) return null;

  const tieredAcc = (tiered.accuracy * 100).toFixed(1);
  const haikuAcc = (haiku.accuracy * 100).toFixed(1);
  const tieredP95 = (tiered.p95LatencyMs / 1000).toFixed(1);
  const haikuP95 = (haiku.p95LatencyMs / 1000).toFixed(1);
  const costRatio = haiku.totalCostUsd > 0 ? (haiku.totalCostUsd / tiered.totalCostUsd) * 100 : 0;
  const tieredHitsSlo = tiered.p95LatencyMs <= SLO_P95_MS;
  const haikuHitsSlo = haiku.p95LatencyMs <= SLO_P95_MS;

  const sloStrip =
    tieredHitsSlo && haikuHitsSlo
      ? "Both modes meet the <5s p95 SLO."
      : !tieredHitsSlo && haikuHitsSlo
        ? `Haiku-only meets the <5s p95 SLO; Tiered does not (${tieredP95}s).`
        : !tieredHitsSlo && !haikuHitsSlo
          ? `Neither mode meets the <5s p95 SLO (Tiered ${tieredP95}s, Haiku-only ${haikuP95}s).`
          : `Tiered meets the <5s p95 SLO; Haiku-only does not (${haikuP95}s).`;

  return [
    `**Headline:** Tiered ${tieredAcc}% accuracy / p95 ${tieredP95}s vs Haiku-only ${haikuAcc}% / p95 ${haikuP95}s — Haiku-only runs at **${costRatio.toFixed(0)}%** of Tiered's cost. ${sloStrip}`,
  ].join("\n");
}

function perFieldTable(run: EvalRun): string {
  const lines: string[] = [
    `## Per-field accuracy (${humanMode(run.mode)})`,
    "",
    "> Per-field accuracy scores **outcome correctness**, not label-match. For cases the manifest expects to pass/review, the field counts correct iff its status is `match`, `fuzzy_match`, or `skipped`. For expected-fail cases, the field counts correct iff the per-case verdict matched expectation — `mismatch` is the *right* outcome there, and shouldn't be counted as a verifier error. Fields not present on a given case are excluded from its denominator.",
    "",
    "| Field | Correct | Total | Accuracy |",
    "|---|---|---|---|",
  ];
  for (const [key, stats] of Object.entries(run.perFieldAccuracy)) {
    if (!stats) continue;
    lines.push(
      `| ${key} | ${stats.correct} | ${stats.total} | ${fmtPct(stats.correct / stats.total)} |`,
    );
  }
  return lines.join("\n");
}

function verdictDifferencesTable(run: EvalRun): string {
  const diffs = run.results.filter((r) => !r.aborted && !r.correct);
  if (diffs.length === 0) {
    return [
      `## Verdict differences (${humanMode(run.mode)})`,
      "",
      "_No differences — every case matched the expected verdict._",
    ].join("\n");
  }
  const lines: string[] = [
    `## Verdict differences (${humanMode(run.mode)})`,
    "",
    "| File | Expected | Got | Notes |",
    "|---|---|---|---|",
  ];
  for (const r of diffs) {
    lines.push(`| ${shortFile(r.caseId)} | ${r.expected} | ${r.got ?? "error"} | ${noteFor(r)} |`);
  }
  return lines.join("\n");
}

function modeFailuresTable(runs: EvalRun[]): string {
  if (runs.length < 2) return "";
  const allFiles = new Set<string>();
  for (const run of runs) {
    for (const r of run.results) {
      if (!r.correct || r.aborted) allFiles.add(r.caseId);
    }
  }
  if (allFiles.size === 0) {
    return ["## Mode-by-mode failures (compare runs)", "", "_No failures across any mode._"].join(
      "\n",
    );
  }
  const sortedFiles = Array.from(allFiles).sort();
  const headerRow = ["File", "Expected", ...runs.map((r) => humanMode(r.mode))].join(" | ");
  const sep = ["---", "---", ...runs.map(() => "---")].join(" | ");
  const lines: string[] = [
    "## Mode-by-mode failures (compare runs)",
    "",
    `| ${headerRow} |`,
    `| ${sep} |`,
  ];
  for (const file of sortedFiles) {
    const first = runs[0]!.results.find((r) => r.caseId === file);
    const expected = first?.expected ?? "?";
    const cells = runs.map((run) => {
      const r = run.results.find((x) => x.caseId === file);
      if (!r) return "—";
      if (r.aborted) return "_aborted_";
      if (r.correct) return `OK (${r.got})`;
      return `**${r.got ?? "error"}**`;
    });
    lines.push(`| ${shortFile(file)} | ${expected} | ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}

function methodologySection(runs: EvalRun[]): string {
  const total = runs[0]?.totalCases ?? 0;
  return [
    "## Methodology",
    "",
    `- Cases: 5 single + 24 batch + 12 hard-conditions (${total} total). Hard cases apply sharp transforms (low-light, glare, tilt, blur, perspective shear) on top of clean batch labels — see \`scripts/generate-hard.ts\`.`,
    "- Each mode is a `Partial<VerifierDeps>` override on the production verifier (`lib/verifier/index.ts`). No code path forks.",
    "- All calls go through OpenRouter with `provider: { order: ['anthropic'], allow_fallbacks: false }` so model identity is pinned.",
    "- Cost computed from token usage × pricing in `lib/vlm/pricing.ts` (Anthropic public pricing for Claude 4.5 family; cached input billed at 1/10).",
    "- Latency is wall-clock per case, including image read and any in-process retries.",
    "- Concurrency 4. Per-case timeout 60s. Total run cost cap $1.00 per mode (aborts remaining cases on breach).",
    "- Run with: `bun run eval:compare`",
  ].join("\n");
}

function limitationsSection(runs: EvalRun[]): string {
  const total = runs[0]?.totalCases ?? 0;
  return [
    "## Limitations",
    "",
    `- **Sample size (${total}).** Even with the hard set added, mode-vs-mode accuracy deltas of 1–2 cases are inside the noise floor. Treat ties as ties.`,
    "- **Synthetic degradations.** The hard set is sharp transforms (modulate, blur, affine, white-radial composites) on top of clean SVG-rendered labels. Real phone shots add chromatic noise, JPEG compression artifacts, and motion blur the synthetic pipeline doesn't reproduce. Consider this an upper-bound on real-world accuracy.",
    "- **No font diversity.** All labels use Georgia + Helvetica. A real production eval would source 50+ TTB-public COLA artwork samples across designers and printers.",
    "- **Government warning is canonical English text only.** Spanish-language warnings (TTB allows them in some markets) and unusual layouts (warning split across two faces) are out of scope for this prototype.",
    "- **Sonnet escalation/tiebreak rate is rare on this set.** If the route doesn't fire, you can't measure its contribution from these numbers — see telemetry counts (`telemetry.routerEscalations`) per case to confirm.",
  ].join("\n");
}

export function renderReport(input: ReportInputs): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const commitSha = getCommitSha(input.commitSha);
  const totalCost = input.runs.reduce((s, r) => s + r.totalCostUsd, 0);

  const lines: string[] = [
    "# Eval Results",
    "",
    `> Generated: ${generatedAt} · Commit: ${commitSha} · Run cost: ${fmtUsd(totalCost)}`,
    "",
    "## Summary",
    "",
    summaryTable(input.runs),
    "",
  ];

  const headline = headlineLine(input.runs);
  if (headline) {
    lines.push(headline, "");
  }

  // Per-field uses the tiered run if present, else the first run.
  const tieredRun = input.runs.find((r) => r.mode === "tiered") ?? input.runs[0];
  if (tieredRun) {
    lines.push(perFieldTable(tieredRun), "");
    lines.push(verdictDifferencesTable(tieredRun), "");
  }

  const modeFailures = modeFailuresTable(input.runs);
  if (modeFailures) {
    lines.push(modeFailures, "");
  }

  if (tieredRun) {
    lines.push(splitBySourceTable(input.runs), "");
  }

  lines.push(limitationsSection(input.runs), "");
  lines.push(methodologySection(input.runs), "");
  return lines.join("\n");
}

function splitBySourceTable(runs: EvalRun[]): string {
  // Show accuracy split by source (single / batch / hard) per mode so the
  // hard-conditions impact is visible. The runner doesn't carry source on
  // results directly, so derive from caseId prefix.
  const sources = ["single", "batch", "hard"] as const;
  const sourceLabel: Record<(typeof sources)[number], string> = {
    single: "single",
    batch: "batch",
    hard: "hard (degraded)",
  };
  const headerCells = ["Source", ...runs.map((r) => humanMode(r.mode))];
  const lines: string[] = [
    "## Accuracy by case source",
    "",
    "> Hard-conditions are sharp-degraded labels (low-light, glare, tilt, blur, shear). Numbers there are an upper bound — see Limitations.",
    "",
    `| ${headerCells.join(" | ")} |`,
    `| ${headerCells.map(() => "---").join(" | ")} |`,
  ];
  for (const src of sources) {
    const cells: string[] = [sourceLabel[src]];
    for (const run of runs) {
      const filtered = run.results.filter((r) => r.caseId.startsWith(`${src}/`));
      if (filtered.length === 0) {
        cells.push("—");
        continue;
      }
      const correct = filtered.filter((r) => r.correct).length;
      cells.push(`${correct}/${filtered.length} (${fmtPct(correct / filtered.length)})`);
    }
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}

export function writeReport(input: ReportInputs, path: string): string {
  const md = renderReport(input);
  writeFileSync(path, md, "utf8");
  return md;
}

function humanMode(mode: string): string {
  switch (mode) {
    case "tiered":
      return "Tiered mode";
    case "haiku-only":
      return "Haiku-only mode";
    case "sonnet-warning":
      return "Sonnet-warning mode";
    case "sonnet-only":
      return "Sonnet-only mode";
    default:
      return mode;
  }
}

function shortFile(caseId: string): string {
  // strip the `single/` or `batch/` prefix for readability
  const parts = caseId.split("/");
  return parts[parts.length - 1] ?? caseId;
}

function noteFor(r: EvalCaseResult): string {
  if (r.error) return `error: ${r.error}`;
  const mismatched = r.fields.filter((f) => f.status === "mismatch" || f.status === "missing");
  if (mismatched.length > 0) {
    const first = mismatched[0]!;
    return `${first.field} ${first.status}: "${first.applicationValue ?? ""}" vs "${first.labelValue ?? ""}"`.replace(
      /\|/g,
      "\\|",
    );
  }
  if (r.warning && r.warning.status !== "pass") {
    const first = r.warning.failures[0];
    return `warning ${r.warning.status}${first ? `: ${first.kind}` : ""}`;
  }
  return "verdict differs";
}
