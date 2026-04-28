/**
 * Render the 5 demo label JPEGs from SVG so the fixtures are deterministic.
 * Run: bun scripts/generate-samples.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import {
  GOVERNMENT_WARNING_HEADER,
  GOVERNMENT_WARNING_TEXT,
} from "../lib/canonical/government-warning";

const OUT_DIR = join(process.cwd(), "public", "samples");

type Variant = {
  filename: string;
  brand: string;
  classType: string;
  abv: string;
  netContents: string;
  bottlerLine1: string;
  bottlerLine2: string;
  warningHeader: string;
  warningHeaderBold: boolean;
  warningBody: string;
  rotateCcw90?: boolean;
};

const CANONICAL_HEADER = `${GOVERNMENT_WARNING_HEADER}:`;
// The canonical body without the header prefix, line-broken for the SVG.
const CANONICAL_BODY = GOVERNMENT_WARNING_TEXT.slice(`${CANONICAL_HEADER} `.length);

const baseVariant: Omit<Variant, "filename"> = {
  brand: "STONE'S THROW",
  classType: "Kentucky Straight Bourbon Whiskey",
  abv: "45% alc/vol",
  netContents: "750 mL",
  bottlerLine1: "Bottled by Stone's Throw Distillery",
  bottlerLine2: "123 Main Street, Louisville, KY",
  warningHeader: CANONICAL_HEADER,
  warningHeaderBold: true,
  warningBody: CANONICAL_BODY,
};

const variants: Variant[] = [
  { filename: "01-clean-bourbon.jpg", ...baseVariant, brand: "Stone's Throw" },
  { filename: "02-stones-throw.jpg", ...baseVariant }, // brand is all-caps "STONE'S THROW"
  {
    filename: "03-title-case-warning.jpg",
    ...baseVariant,
    brand: "Stone's Throw",
    warningHeader: "Government Warning:", // title-case → header_not_all_caps
    warningHeaderBold: false, // → header_not_bold
  },
  {
    filename: "04-wrong-abv.jpg",
    ...baseVariant,
    brand: "Stone's Throw",
    abv: "40% alc/vol", // application says 45%
  },
  {
    filename: "05-rotated-bourbon.jpg",
    ...baseVariant,
    brand: "Stone's Throw",
    rotateCcw90: true, // physically sideways; EXIF orientation 6 says "rotate 90° CW to view"
  },
];

const W = 1024;
const H = 1280;

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = `${current} ${word}`.trim();
    if (candidate.length > maxCharsPerLine) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSvg(v: Variant): string {
  const warningLines = wrapText(v.warningBody, 64);
  const warningStartY = 920;
  const lineHeight = 22;

  const headerWeight = v.warningHeaderBold ? "700" : "400";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#f4ecd8"/>
  <rect x="32" y="32" width="${W - 64}" height="${H - 64}" fill="none" stroke="#3b2a1a" stroke-width="3"/>

  <!-- decorative top band -->
  <rect x="32" y="32" width="${W - 64}" height="120" fill="#1a0f08"/>
  <text x="${W / 2}" y="115" font-family="Georgia, 'Times New Roman', serif"
        font-size="56" font-weight="700" fill="#f4ecd8" text-anchor="middle"
        letter-spacing="6">KENTUCKY BOURBON</text>

  <!-- brand -->
  <text x="${W / 2}" y="280" font-family="Georgia, 'Times New Roman', serif"
        font-size="${v.brand.length > 16 ? 70 : 92}" font-weight="700"
        fill="#1a0f08" text-anchor="middle" letter-spacing="4">${escapeXml(v.brand)}</text>

  <!-- class / type -->
  <text x="${W / 2}" y="360" font-family="Georgia, 'Times New Roman', serif"
        font-size="34" font-style="italic" fill="#1a0f08" text-anchor="middle">${escapeXml(v.classType)}</text>

  <!-- divider -->
  <line x1="240" y1="410" x2="${W - 240}" y2="410" stroke="#1a0f08" stroke-width="2"/>

  <!-- ABV + net contents -->
  <text x="${W / 2}" y="470" font-family="Georgia, 'Times New Roman', serif"
        font-size="32" font-weight="600" fill="#1a0f08" text-anchor="middle">${escapeXml(v.abv)} · ${escapeXml(v.netContents)}</text>

  <!-- big swirl glyph -->
  <text x="${W / 2}" y="640" font-family="Georgia, serif" font-size="220"
        fill="#3b2a1a" text-anchor="middle" opacity="0.18">❦</text>

  <!-- aged statement -->
  <text x="${W / 2}" y="780" font-family="Georgia, 'Times New Roman', serif"
        font-size="22" fill="#3b2a1a" text-anchor="middle"
        letter-spacing="4">AGED 6 YEARS · SMALL BATCH</text>

  <!-- government warning -->
  <text x="80" y="${warningStartY - 6}" font-family="Helvetica, Arial, sans-serif"
        font-size="20" font-weight="${headerWeight}" fill="#1a0f08">${escapeXml(v.warningHeader)}</text>
  ${warningLines
    .map(
      (line, i) =>
        `<text x="80" y="${warningStartY + 22 + i * lineHeight}" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="#1a0f08">${escapeXml(line)}</text>`,
    )
    .join("\n  ")}

  <!-- bottler -->
  <text x="${W / 2}" y="${H - 110}" font-family="Helvetica, Arial, sans-serif"
        font-size="18" fill="#1a0f08" text-anchor="middle">${escapeXml(v.bottlerLine1)}</text>
  <text x="${W / 2}" y="${H - 84}" font-family="Helvetica, Arial, sans-serif"
        font-size="18" fill="#1a0f08" text-anchor="middle">${escapeXml(v.bottlerLine2)}</text>
</svg>`;
}

async function renderVariant(v: Variant): Promise<void> {
  const svg = buildSvg(v);
  let pipeline = sharp(Buffer.from(svg)).flatten({ background: "#f4ecd8" });

  if (v.rotateCcw90) {
    // Rotate the pixels 90° CCW (so the file is sideways) and tag EXIF
    // orientation = 6 ("rotate 90° CW to view correctly"). sharp's
    // .rotate() with no args honors that tag in the verifier pipeline.
    pipeline = pipeline.rotate(-90).withMetadata({ orientation: 6 });
  }

  const out = await pipeline.jpeg({ quality: 88 }).toBuffer();
  await writeFile(join(OUT_DIR, v.filename), out);
  console.log(`wrote ${v.filename} (${out.length} bytes)`);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  for (const v of variants) {
    await renderVariant(v);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
