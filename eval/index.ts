import { join } from "node:path";
import type { VerifierDeps } from "@/lib/verifier";
import * as verifierCache from "@/lib/verifier/cache";
import { MODELS } from "@/lib/vlm/models";
import { loadCases } from "./cases";
import { ALL_MODES, type ModeName, modeDeps } from "./modes";
import { writeReport } from "./report";
import { runEval } from "./runner";
import type { EvalRun } from "./types";

function parseArgs(argv: string[]): { modes: ModeName[]; dryRun: boolean; outPath: string } {
  let modes: ModeName[] = ["tiered"];
  let dryRun = false;
  let outPath = join(process.cwd(), "eval-results.md");
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--mode=")) {
      const list = arg.slice("--mode=".length);
      const tokens = list
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (tokens.length === 1 && tokens[0] === "all") {
        modes = ALL_MODES;
      } else {
        modes = tokens.map((t) => {
          if (!ALL_MODES.includes(t as ModeName)) {
            throw new Error(`Unknown mode: ${t}. Valid modes: ${ALL_MODES.join(", ")}`);
          }
          return t as ModeName;
        });
      }
    } else if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length);
    }
  }
  return { modes, dryRun, outPath };
}

function dryRunDeps(): Partial<VerifierDeps> {
  let counter = 0;
  return {
    prepareImage: async (bytes) => {
      const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
      counter += 1;
      return {
        buffer,
        base64: "STUB",
        dataUrl: "data:image/jpeg;base64,STUB",
        hash: `stub-${counter}-${buffer.length}`,
        width: 1024,
        height: 1024,
        meanBrightness: 128,
        quality: {
          lowQuality: false,
          reasons: [],
          width: 1024,
          height: 1024,
          meanBrightness: 128,
        },
      };
    },
    extractLabel: async () => ({
      value: {
        is_alcohol_label: true,
        brandName: { value: "Stone's Throw", confidence: 0.99 },
        classType: { value: "Kentucky Straight Bourbon Whiskey", confidence: 0.99 },
        alcoholContent: { value: "45%", confidence: 0.99 },
        netContents: { value: "750 mL", confidence: 0.99 },
        bottlerName: { value: "Stone's Throw Distillery", confidence: 0.99 },
        bottlerAddress: { value: "123 Main Street, Louisville, KY", confidence: 0.99 },
        importerName: { value: null, confidence: 0 },
        importerAddress: { value: null, confidence: 0 },
        countryOfOrigin: { value: null, confidence: 0 },
      },
      telemetry: {
        model: MODELS.HAIKU,
        latencyMs: 5,
        usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
        costUsd: 0,
      },
    }),
    extractWarning: async () => ({
      value: {
        fullText:
          "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
        headerIsAllCaps: true,
        headerAppearsBold: true,
        confidence: 0.99,
      },
      telemetry: {
        model: MODELS.SONNET,
        latencyMs: 5,
        usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
        costUsd: 0,
      },
    }),
    escalateField: async () => ({
      value: { value: null, confidence: 0 },
      telemetry: {
        model: MODELS.SONNET,
        latencyMs: 5,
        usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
        costUsd: 0,
      },
    }),
    tiebreak: async () => ({
      value: { same: true, reason: "stub" },
      telemetry: {
        model: MODELS.SONNET,
        latencyMs: 5,
        usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
        costUsd: 0,
      },
    }),
  };
}

async function main(): Promise<void> {
  const { modes, dryRun, outPath } = parseArgs(process.argv.slice(2));
  const cases = loadCases();
  // eslint-disable-next-line no-console
  console.log(
    `[eval] loaded ${cases.length} cases (${cases.filter((c) => c.source === "single").length} single, ${cases.filter((c) => c.source === "batch").length} batch)`,
  );
  // eslint-disable-next-line no-console
  console.log(`[eval] running modes: ${modes.join(", ")}${dryRun ? " (dry-run)" : ""}`);

  const runs: EvalRun[] = [];
  for (const mode of modes) {
    // eslint-disable-next-line no-console
    console.log(`[eval] starting mode=${mode}`);
    // Drop the verifier's in-process LRU cache so identical (hash, application)
    // pairs from a previous mode don't return cached results — we'd score the
    // wrong model. (The cache is keyed on image+application, not on the
    // VerifierDeps used to produce the result.)
    verifierCache.clear();
    const start = Date.now();
    const deps = dryRun ? dryRunDeps() : modeDeps(mode);
    const run = await runEval(cases, mode, deps);
    runs.push(run);
    // eslint-disable-next-line no-console
    console.log(
      `[eval] mode=${mode} done in ${((Date.now() - start) / 1000).toFixed(1)}s · accuracy=${(run.accuracy * 100).toFixed(1)}% · cost=$${run.totalCostUsd.toFixed(4)}${run.aborted ? " (cost cap hit)" : ""}`,
    );
  }

  writeReport({ runs }, outPath);
  // eslint-disable-next-line no-console
  console.log(`[eval] wrote ${outPath}`);
  // eslint-disable-next-line no-console
  console.log(`[eval] total cost: $${runs.reduce((s, r) => s + r.totalCostUsd, 0).toFixed(4)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[eval] failed:", err);
  process.exit(1);
});
