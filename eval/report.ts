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
      return "**Tiered** (Haiku + Sonnet, default)";
    case "haiku-only":
      return "Haiku only";
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

function headlineLine(runs: EvalRun[]): string | null {
  const tiered = runs.find((r) => r.mode === "tiered");
  const sonnet = runs.find((r) => r.mode === "sonnet-only");
  if (!tiered || !sonnet) return null;
  if (sonnet.accuracy === 0 || sonnet.totalCostUsd === 0) return null;
  const acc = (tiered.accuracy / sonnet.accuracy) * 100;
  const cost = (tiered.totalCostUsd / sonnet.totalCostUsd) * 100;
  return `**Headline:** Tiered routing is **${acc.toFixed(1)}%** as accurate as all-Sonnet at **${cost.toFixed(0)}%** of the cost.`;
}

function perFieldTable(run: EvalRun): string {
  const lines: string[] = [
    `## Per-field accuracy (${humanMode(run.mode)})`,
    "",
    "> Per-field accuracy treats `match`, `fuzzy_match`, and `skipped` as correct (the field passed verification or was not required for this case). `mismatch` and `missing` are wrong. Fields not present on a given case are excluded from its denominator.",
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

function methodologySection(): string {
  return [
    "## Methodology",
    "",
    "- Cases: 5 single-label samples + 24 batch samples (29 total).",
    "- Each mode is a `Partial<VerifierDeps>` override on the production verifier (`lib/verifier/index.ts`). No code path forks.",
    "- All calls go through OpenRouter with `provider: { order: ['anthropic'], allow_fallbacks: false }` so model identity is pinned.",
    "- Cost computed from token usage × pricing in `lib/vlm/pricing.ts` (Anthropic public pricing for Claude 4.5 family; cached input billed at 1/10).",
    "- Latency is wall-clock per case, including image read and any in-process retries.",
    "- Concurrency 4. Per-case timeout 60s. Total run cost cap $1.00 (aborts remaining cases on breach).",
    "- Run with: `bun run eval:compare`",
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

  lines.push(methodologySection(), "");
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
