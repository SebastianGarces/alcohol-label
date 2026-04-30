/**
 * Render hard-conditions variants of existing batch labels into
 * public/samples/hard/. Stresses the VLM with low-light, glare, tilt, blur,
 * and perspective skew — the "imperfectly shot" cases Jenny Park flagged
 * in the discovery interviews.
 *
 * Reads source JPEGs from public/samples/batch/ and applies sharp transforms.
 * Run: bun scripts/generate-hard.ts
 */
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const REPO_ROOT = process.cwd();
const SRC_DIR = join(REPO_ROOT, "public", "samples", "batch");
const OUT_DIR = join(REPO_ROOT, "public", "samples", "hard");

type Degradation =
  | { kind: "low_light"; brightness: number }
  | { kind: "glare"; cx: number; cy: number; radius: number; opacity: number }
  | { kind: "tilt"; degrees: number }
  | { kind: "blur"; sigma: number }
  | { kind: "perspective"; affine: [number, number, number, number] }
  | { kind: "stack"; steps: Degradation[] };

type HardCase = {
  /** New filename in public/samples/hard/ */
  filename: string;
  /** Source filename in public/samples/batch/ */
  source: string;
  /** Application CSV row inherited from the source */
  /** Applied to source pixels in order */
  degradation: Degradation;
  /** Expected verdict — must match what the verifier should produce */
  expected: "pass" | "review" | "fail";
  /** Brief description for the report */
  note: string;
};

// Subset of source labels chosen to give beverage-type coverage and avoid
// the velvet-crow case (has its own countryOfOrigin extraction issue).
const HARD_CASES: HardCase[] = [
  {
    filename: "01-stones-throw-low-light.jpg",
    source: "01-stones-throw-bourbon.jpg",
    degradation: { kind: "low_light", brightness: 0.45 },
    expected: "pass",
    note: "dim warehouse lighting",
  },
  {
    filename: "02-black-pine-glare.jpg",
    source: "02-black-pine-malt.jpg",
    degradation: { kind: "glare", cx: 720, cy: 280, radius: 360, opacity: 0.55 },
    expected: "pass",
    note: "glare across upper-right brand area",
  },
  {
    filename: "03-wildflower-tilt-12.jpg",
    source: "03-wildflower-vodka.jpg",
    degradation: { kind: "tilt", degrees: 12 },
    expected: "pass",
    note: "12° tilt (handheld phone)",
  },
  {
    filename: "04-copperhead-blur.jpg",
    source: "04-copperhead-tn-whiskey.jpg",
    degradation: { kind: "blur", sigma: 2.2 },
    expected: "pass",
    note: "mild motion blur",
  },
  {
    filename: "05-iron-crown-glare-brand.jpg",
    source: "05-iron-crown-gin.jpg",
    degradation: { kind: "glare", cx: 512, cy: 280, radius: 380, opacity: 0.7 },
    expected: "pass",
    note: "heavy glare on brand — verifier reads through it correctly",
  },
  {
    filename: "06-old-anchor-tilt+blur.jpg",
    source: "09-old-anchor-rye.jpg",
    degradation: {
      kind: "stack",
      steps: [
        { kind: "tilt", degrees: 8 },
        { kind: "blur", sigma: 1.4 },
      ],
    },
    expected: "pass",
    note: "tilt + slight blur (handheld + low shutter)",
  },
  {
    filename: "07-hollow-oak-glare-warning.jpg",
    source: "11-hollow-oak-cab.jpg",
    degradation: { kind: "glare", cx: 512, cy: 1020, radius: 340, opacity: 0.7 },
    expected: "pass",
    note: "glare on warning text — verifier still extracts canonical text + formatting flags",
  },
  {
    filename: "08-cedar-hill-perspective.jpg",
    source: "12-cedar-hill-pinot.jpg",
    // Slight horizontal shear to mimic an off-axis photo.
    degradation: { kind: "perspective", affine: [1, 0.18, 0, 1] },
    expected: "pass",
    note: "off-axis photo (shear)",
  },
  {
    filename: "09-stargazer-low-light.jpg",
    source: "18-stargazer-riesling.jpg",
    degradation: { kind: "low_light", brightness: 0.5 },
    expected: "pass",
    note: "ambient bar lighting",
  },
  {
    filename: "10-north-pier-glare-half.jpg",
    source: "19-north-pier-ipa.jpg",
    degradation: { kind: "glare", cx: 256, cy: 640, radius: 480, opacity: 0.6 },
    expected: "pass",
    note: "broad glare on left half of can",
  },
  {
    filename: "11-tall-oak-blur+lowlight.jpg",
    source: "20-tall-oak-pilsner.jpg",
    degradation: {
      kind: "stack",
      steps: [
        { kind: "blur", sigma: 1.6 },
        { kind: "low_light", brightness: 0.55 },
      ],
    },
    expected: "pass",
    note: "low shutter + dim lighting",
  },
  {
    filename: "12-sundown-tilt-25.jpg",
    source: "21-sundown-stout.jpg",
    degradation: { kind: "tilt", degrees: 25 },
    expected: "pass",
    note: "25° tilt (camera held sideways-ish)",
  },
];

const W = 1024;
const H = 1280;

function buildGlareSvg(cx: number, cy: number, radius: number, opacity: number): Buffer {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="g" cx="${cx}" cy="${cy}" r="${radius}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="${opacity}"/>
      <stop offset="60%" stop-color="#ffffff" stop-opacity="${opacity * 0.4}"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
</svg>`;
  return Buffer.from(svg);
}

async function applyDegradation(input: Buffer, deg: Degradation): Promise<Buffer> {
  switch (deg.kind) {
    case "low_light": {
      return sharp(input).modulate({ brightness: deg.brightness }).jpeg({ quality: 85 }).toBuffer();
    }
    case "glare": {
      const overlay = buildGlareSvg(deg.cx, deg.cy, deg.radius, deg.opacity);
      return sharp(input)
        .composite([{ input: overlay, top: 0, left: 0 }])
        .jpeg({ quality: 85 })
        .toBuffer();
    }
    case "tilt": {
      // Rotate with a sympathetic background (off-white) so the rotated label
      // sits on a frame rather than transparent corners.
      return sharp(input)
        .rotate(deg.degrees, { background: { r: 240, g: 240, b: 240 } })
        .resize(W, H, { fit: "contain", background: { r: 240, g: 240, b: 240 } })
        .jpeg({ quality: 85 })
        .toBuffer();
    }
    case "blur": {
      return sharp(input).blur(deg.sigma).jpeg({ quality: 85 }).toBuffer();
    }
    case "perspective": {
      // sharp's affine is [a, b, c, d] for the 2x2 transform matrix.
      return sharp(input)
        .affine(deg.affine, { background: { r: 240, g: 240, b: 240 } })
        .resize(W, H, { fit: "contain", background: { r: 240, g: 240, b: 240 } })
        .jpeg({ quality: 85 })
        .toBuffer();
    }
    case "stack": {
      let out = input;
      for (const step of deg.steps) {
        out = await applyDegradation(out, step);
      }
      return out;
    }
  }
}

type ApplicationRow = Record<string, string>;

function parseCsv(text: string): { headers: string[]; rows: ApplicationRow[] } {
  // Minimal CSV parser that handles quoted fields with embedded commas.
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === ",") {
          out.push(cur);
          cur = "";
        } else if (ch === '"') {
          inQuotes = true;
        } else {
          cur += ch;
        }
      }
    }
    out.push(cur);
    return out;
  };
  const headers = split(lines[0]!);
  const rows: ApplicationRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]!);
    const row: ApplicationRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = cells[j] ?? "";
    }
    rows.push(row);
  }
  return { headers, rows };
}

function csvField(v: string): string {
  if (v === "") return "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  const srcCsv = readFileSync(join(SRC_DIR, "applications.csv"), "utf8");
  const { headers, rows } = parseCsv(srcCsv);
  const bySource = new Map(rows.map((r) => [r.filename!, r]));

  const outRows: ApplicationRow[] = [];
  const manifestRows: {
    filename: string;
    brand: string;
    beverageType: string;
    expected: string;
  }[] = [];

  for (const c of HARD_CASES) {
    const srcRow = bySource.get(c.source);
    if (!srcRow) {
      throw new Error(`Hard case ${c.filename} references missing source ${c.source}`);
    }
    const inputBytes = readFileSync(join(SRC_DIR, c.source));
    const out = await applyDegradation(inputBytes, c.degradation);
    await writeFile(join(OUT_DIR, c.filename), out);
    console.log(`wrote ${c.filename} (${out.length} bytes) — ${c.note}`);

    outRows.push({ ...srcRow, filename: c.filename });
    manifestRows.push({
      filename: c.filename,
      brand: srcRow.brandName ?? "",
      beverageType: srcRow.beverageType ?? "",
      expected: c.expected,
    });
  }

  const csv = [
    headers.join(","),
    ...outRows.map((r) => headers.map((h) => csvField(r[h] ?? "")).join(",")),
  ].join("\n");
  await writeFile(join(OUT_DIR, "applications.csv"), `${csv}\n`);
  console.log(`wrote applications.csv (${outRows.length} rows)`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    rows: manifestRows,
    notes: HARD_CASES.map((c) => ({ filename: c.filename, source: c.source, note: c.note })),
  };
  await writeFile(join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote manifest.json`);

  const counts = manifestRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.expected] = (acc[r.expected] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`expected verdicts: ${JSON.stringify(counts)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
