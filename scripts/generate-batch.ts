/**
 * Render a 24-label demo batch into public/samples/batch/.
 * Produces: NN-<slug>.jpg files, applications.csv, manifest.json.
 * Mix of pass / review / fail outcomes for a realistic batch demo.
 *
 * Run: bun scripts/generate-batch.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import {
  GOVERNMENT_WARNING_HEADER,
  GOVERNMENT_WARNING_TEXT,
} from "../lib/canonical/government-warning";

const OUT_DIR = join(process.cwd(), "public", "samples", "batch");
const W = 1024;
const H = 1280;

const CANONICAL_HEADER = `${GOVERNMENT_WARNING_HEADER}:`;
const CANONICAL_BODY = GOVERNMENT_WARNING_TEXT.slice(`${CANONICAL_HEADER} `.length);

type BeverageType = "distilled_spirits" | "wine" | "malt_beverage";

type Variant = {
  /** filename slug (no number prefix) */
  slug: string;
  /** Text rendered on the label */
  labelBrand: string;
  labelClass: string;
  labelAbv: string;
  labelNet: string;
  bottlerLine1: string;
  bottlerLine2: string;
  warningHeader: string;
  warningHeaderBold: boolean;
  /** What the CSV says — the application data */
  appBeverageType: BeverageType;
  appBrand: string;
  appClass: string;
  appAbv?: string;
  appNet: string;
  appBottler?: string;
  appBottlerAddress?: string;
  appImporter?: string;
  appImporterAddress?: string;
  appCountryOfOrigin?: string;
  /** Visual / aesthetic variation */
  palette: "bourbon" | "wine" | "beer";
  expected: "pass" | "review" | "fail";
};

const PALETTES = {
  bourbon: { bg: "#f4ecd8", ink: "#1a0f08", band: "#1a0f08", bandText: "#f4ecd8" },
  wine: { bg: "#fbeef0", ink: "#3d0a1a", band: "#3d0a1a", bandText: "#fbeef0" },
  beer: { bg: "#fff7e0", ink: "#3a2a08", band: "#3a2a08", bandText: "#fff7e0" },
} as const;

const BANNER: Record<Variant["palette"], string> = {
  bourbon: "KENTUCKY BOURBON",
  wine: "ESTATE BOTTLED",
  beer: "CRAFT BREWERY",
};

const passWarning = { warningHeader: CANONICAL_HEADER, warningHeaderBold: true };
const titleCaseWarning = { warningHeader: "Government Warning:", warningHeaderBold: false };

const variants: Variant[] = [
  // --- Spirits (10) ---
  {
    slug: "stones-throw-bourbon",
    labelBrand: "Stone's Throw",
    labelClass: "Kentucky Straight Bourbon Whiskey",
    labelAbv: "45% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Stone's Throw Distillery",
    bottlerLine2: "123 Main Street, Louisville, KY",
    appBeverageType: "distilled_spirits",
    appBrand: "Stone's Throw",
    appClass: "Kentucky Straight Bourbon Whiskey",
    appAbv: "45%",
    appNet: "750 mL",
    appBottler: "Stone's Throw Distillery",
    appBottlerAddress: "123 Main Street, Louisville, KY",
    palette: "bourbon",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "black-pine-malt",
    labelBrand: "Black Pine",
    labelClass: "Single Malt Whiskey",
    labelAbv: "43% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Distilled & bottled by Black Pine Spirits Co.",
    bottlerLine2: "44 Cedar Lane, Asheville, NC",
    appBeverageType: "distilled_spirits",
    appBrand: "Black Pine",
    appClass: "Single Malt Whiskey",
    appAbv: "43%",
    appNet: "750 mL",
    appBottler: "Black Pine Spirits Co.",
    appBottlerAddress: "44 Cedar Lane, Asheville, NC",
    palette: "bourbon",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "wildflower-vodka",
    labelBrand: "Wildflower Reserve",
    labelClass: "Vodka",
    labelAbv: "40% alc/vol",
    labelNet: "1 L",
    bottlerLine1: "Bottled by Wildflower Distilling Co.",
    bottlerLine2: "210 Prairie Road, Lawrence, KS",
    appBeverageType: "distilled_spirits",
    appBrand: "Wildflower Reserve",
    appClass: "Vodka",
    appAbv: "40%",
    appNet: "1 L",
    appBottler: "Wildflower Distilling Co.",
    appBottlerAddress: "210 Prairie Road, Lawrence, KS",
    palette: "bourbon",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "copperhead-tn-whiskey",
    labelBrand: "Copperhead",
    labelClass: "Tennessee Whiskey",
    labelAbv: "47% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Copperhead Distillery",
    bottlerLine2: "5 River Bend Drive, Lynchburg, TN",
    appBeverageType: "distilled_spirits",
    appBrand: "Copperhead",
    appClass: "Tennessee Whiskey",
    appAbv: "47%",
    appNet: "750 mL",
    appBottler: "Copperhead Distillery",
    appBottlerAddress: "5 River Bend Drive, Lynchburg, TN",
    palette: "bourbon",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "iron-crown-gin",
    labelBrand: "Iron Crown",
    labelClass: "London Dry Gin",
    labelAbv: "41.5% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Iron Crown Distillers",
    bottlerLine2: "9 Royal Street, Portland, OR",
    appBeverageType: "distilled_spirits",
    appBrand: "Iron Crown",
    appClass: "London Dry Gin",
    appAbv: "41.5%",
    appNet: "750 mL",
    appBottler: "Iron Crown Distillers",
    appBottlerAddress: "9 Royal Street, Portland, OR",
    palette: "bourbon",
    expected: "pass",
    ...passWarning,
  },
  {
    // smart-match: label all-caps, application title case
    slug: "stones-throw-allcaps",
    labelBrand: "STONE'S THROW",
    labelClass: "Kentucky Straight Bourbon Whiskey",
    labelAbv: "45% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Stone's Throw Distillery",
    bottlerLine2: "123 Main Street, Louisville, KY",
    appBeverageType: "distilled_spirits",
    appBrand: "Stone's Throw",
    appClass: "Kentucky Straight Bourbon Whiskey",
    appAbv: "45%",
    appNet: "750 mL",
    appBottler: "Stone's Throw Distillery",
    appBottlerAddress: "123 Main Street, Louisville, KY",
    palette: "bourbon",
    expected: "review",
    ...passWarning,
  },
  {
    // wrong ABV — label says 45%, app says 50%
    slug: "salt-marsh-rum",
    labelBrand: "Salt Marsh",
    labelClass: "Aged Rum",
    labelAbv: "45% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Salt Marsh Spirits Co.",
    bottlerLine2: "12 Harbor Way, Charleston, SC",
    appBeverageType: "distilled_spirits",
    appBrand: "Salt Marsh",
    appClass: "Aged Rum",
    appAbv: "50%",
    appNet: "750 mL",
    appBottler: "Salt Marsh Spirits Co.",
    appBottlerAddress: "12 Harbor Way, Charleston, SC",
    palette: "bourbon",
    expected: "fail",
    ...passWarning,
  },
  {
    // title-case warning — non-compliant header
    slug: "rolling-glen-bourbon",
    labelBrand: "Rolling Glen",
    labelClass: "Kentucky Bourbon Whiskey",
    labelAbv: "46% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Rolling Glen Distillery",
    bottlerLine2: "77 Glen Road, Bardstown, KY",
    appBeverageType: "distilled_spirits",
    appBrand: "Rolling Glen",
    appClass: "Kentucky Bourbon Whiskey",
    appAbv: "46%",
    appNet: "750 mL",
    appBottler: "Rolling Glen Distillery",
    appBottlerAddress: "77 Glen Road, Bardstown, KY",
    palette: "bourbon",
    expected: "fail",
    ...titleCaseWarning,
  },
  {
    slug: "old-anchor-rye",
    labelBrand: "Old Anchor",
    labelClass: "Straight Rye Whiskey",
    labelAbv: "50% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Old Anchor Distillery",
    bottlerLine2: "401 Wharf Street, Baltimore, MD",
    appBeverageType: "distilled_spirits",
    appBrand: "Old Anchor",
    appClass: "Straight Rye Whiskey",
    appAbv: "50%",
    appNet: "750 mL",
    appBottler: "Old Anchor Distillery",
    appBottlerAddress: "401 Wharf Street, Baltimore, MD",
    palette: "bourbon",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "velvet-crow-tequila",
    labelBrand: "Velvet Crow",
    labelClass: "Tequila Reposado",
    labelAbv: "40% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Imported by Velvet Crow Spirits LLC",
    bottlerLine2: "88 Mission Street, San Diego, CA",
    appBeverageType: "distilled_spirits",
    appBrand: "Velvet Crow",
    appClass: "Tequila Reposado",
    appAbv: "40%",
    appNet: "750 mL",
    appBottler: "Velvet Crow Spirits LLC",
    appBottlerAddress: "88 Mission Street, San Diego, CA",
    appImporter: "Velvet Crow Spirits LLC",
    appImporterAddress: "88 Mission Street, San Diego, CA",
    appCountryOfOrigin: "Mexico",
    palette: "bourbon",
    expected: "pass",
    ...passWarning,
  },

  // --- Wine (8) ---
  {
    slug: "hollow-oak-cab",
    labelBrand: "Hollow Oak",
    labelClass: "Cabernet Sauvignon",
    labelAbv: "13.5% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Hollow Oak Vineyards",
    bottlerLine2: "1450 Estate Road, Napa, CA",
    appBeverageType: "wine",
    appBrand: "Hollow Oak",
    appClass: "Cabernet Sauvignon",
    appAbv: "13.5%",
    appNet: "750 mL",
    appBottler: "Hollow Oak Vineyards",
    appBottlerAddress: "1450 Estate Road, Napa, CA",
    palette: "wine",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "cedar-hill-pinot",
    labelBrand: "Cedar Hill",
    labelClass: "Pinot Noir",
    labelAbv: "13.0% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Cedar Hill Winery",
    bottlerLine2: "302 Vine Road, Willamette Valley, OR",
    appBeverageType: "wine",
    appBrand: "Cedar Hill",
    appClass: "Pinot Noir",
    appAbv: "13.0%",
    appNet: "750 mL",
    appBottler: "Cedar Hill Winery",
    appBottlerAddress: "302 Vine Road, Willamette Valley, OR",
    palette: "wine",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "riverbend-chardonnay",
    labelBrand: "Riverbend",
    labelClass: "Chardonnay",
    labelAbv: "12.5% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Riverbend Cellars",
    bottlerLine2: "55 Oak Lane, Sonoma, CA",
    appBeverageType: "wine",
    appBrand: "Riverbend",
    appClass: "Chardonnay",
    appAbv: "12.5%",
    appNet: "750 mL",
    appBottler: "Riverbend Cellars",
    appBottlerAddress: "55 Oak Lane, Sonoma, CA",
    palette: "wine",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "sunwood-sauvblanc",
    labelBrand: "Sunwood",
    labelClass: "Sauvignon Blanc",
    labelAbv: "13.5% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Sunwood Estate",
    bottlerLine2: "8 Hillside Drive, Paso Robles, CA",
    appBeverageType: "wine",
    appBrand: "Sunwood",
    appClass: "Sauvignon Blanc",
    appAbv: "13.5%",
    appNet: "750 mL",
    appBottler: "Sunwood Estate",
    appBottlerAddress: "8 Hillside Drive, Paso Robles, CA",
    palette: "wine",
    expected: "pass",
    ...passWarning,
  },
  {
    // smart-match: label all-caps brand
    slug: "hollow-oak-allcaps",
    labelBrand: "HOLLOW OAK",
    labelClass: "Cabernet Sauvignon",
    labelAbv: "13.5% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Hollow Oak Vineyards",
    bottlerLine2: "1450 Estate Road, Napa, CA",
    appBeverageType: "wine",
    appBrand: "Hollow Oak",
    appClass: "Cabernet Sauvignon",
    appAbv: "13.5%",
    appNet: "750 mL",
    appBottler: "Hollow Oak Vineyards",
    appBottlerAddress: "1450 Estate Road, Napa, CA",
    palette: "wine",
    expected: "review",
    ...passWarning,
  },
  {
    slug: "glass-mountain-merlot",
    labelBrand: "Glass Mountain",
    labelClass: "Merlot",
    labelAbv: "14.5% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Glass Mountain Winery",
    bottlerLine2: "12 Summit Trail, Walla Walla, WA",
    appBeverageType: "wine",
    appBrand: "Glass Mountain",
    appClass: "Merlot",
    appAbv: "14.5%",
    appNet: "750 mL",
    appBottler: "Glass Mountain Winery",
    appBottlerAddress: "12 Summit Trail, Walla Walla, WA",
    palette: "wine",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "westcliff-rose",
    labelBrand: "Westcliff",
    labelClass: "Rosé",
    labelAbv: "12.0% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Westcliff Estate",
    bottlerLine2: "401 Coast Road, Mendocino, CA",
    appBeverageType: "wine",
    appBrand: "Westcliff",
    appClass: "Rosé",
    appAbv: "12.0%",
    appNet: "750 mL",
    appBottler: "Westcliff Estate",
    appBottlerAddress: "401 Coast Road, Mendocino, CA",
    palette: "wine",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "stargazer-riesling",
    labelBrand: "Stargazer",
    labelClass: "Riesling",
    labelAbv: "11.5% alc/vol",
    labelNet: "750 mL",
    bottlerLine1: "Bottled by Stargazer Vineyards",
    bottlerLine2: "26 Lakeview Road, Finger Lakes, NY",
    appBeverageType: "wine",
    appBrand: "Stargazer",
    appClass: "Riesling",
    appAbv: "11.5%",
    appNet: "750 mL",
    appBottler: "Stargazer Vineyards",
    appBottlerAddress: "26 Lakeview Road, Finger Lakes, NY",
    palette: "wine",
    expected: "pass",
    ...passWarning,
  },

  // --- Beer (6) ---
  {
    slug: "north-pier-ipa",
    labelBrand: "North Pier",
    labelClass: "India Pale Ale",
    labelAbv: "6.8% alc/vol",
    labelNet: "12 fl oz",
    bottlerLine1: "Brewed by North Pier Brewing Co.",
    bottlerLine2: "60 Harbor Drive, Portland, ME",
    appBeverageType: "malt_beverage",
    appBrand: "North Pier",
    appClass: "India Pale Ale",
    appAbv: "6.8%",
    appNet: "12 fl oz",
    appBottler: "North Pier Brewing Co.",
    appBottlerAddress: "60 Harbor Drive, Portland, ME",
    palette: "beer",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "tall-oak-pilsner",
    labelBrand: "Tall Oak",
    labelClass: "Pilsner",
    labelAbv: "5.0% alc/vol",
    labelNet: "12 fl oz",
    bottlerLine1: "Brewed by Tall Oak Brewing Co.",
    bottlerLine2: "11 Industrial Way, Madison, WI",
    appBeverageType: "malt_beverage",
    appBrand: "Tall Oak",
    appClass: "Pilsner",
    appAbv: "5.0%",
    appNet: "12 fl oz",
    appBottler: "Tall Oak Brewing Co.",
    appBottlerAddress: "11 Industrial Way, Madison, WI",
    palette: "beer",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "sundown-stout",
    labelBrand: "Sundown",
    labelClass: "Imperial Stout",
    labelAbv: "7.2% alc/vol",
    labelNet: "12 fl oz",
    bottlerLine1: "Brewed by Sundown Brewing",
    bottlerLine2: "300 Mill Road, Burlington, VT",
    appBeverageType: "malt_beverage",
    appBrand: "Sundown",
    appClass: "Imperial Stout",
    appAbv: "7.2%",
    appNet: "12 fl oz",
    appBottler: "Sundown Brewing",
    appBottlerAddress: "300 Mill Road, Burlington, VT",
    palette: "beer",
    expected: "pass",
    ...passWarning,
  },
  {
    slug: "brick-mill-lager",
    labelBrand: "Brick Mill",
    labelClass: "Amber Lager",
    labelAbv: "4.8% alc/vol",
    labelNet: "12 fl oz",
    bottlerLine1: "Brewed by Brick Mill Brewery",
    bottlerLine2: "118 Foundry Lane, Pittsburgh, PA",
    appBeverageType: "malt_beverage",
    appBrand: "Brick Mill",
    appClass: "Amber Lager",
    appAbv: "4.8%",
    appNet: "12 fl oz",
    appBottler: "Brick Mill Brewery",
    appBottlerAddress: "118 Foundry Lane, Pittsburgh, PA",
    palette: "beer",
    expected: "pass",
    ...passWarning,
  },
  {
    // smart-match: label all-caps brand
    slug: "north-pier-allcaps",
    labelBrand: "NORTH PIER",
    labelClass: "India Pale Ale",
    labelAbv: "6.8% alc/vol",
    labelNet: "12 fl oz",
    bottlerLine1: "Brewed by North Pier Brewing Co.",
    bottlerLine2: "60 Harbor Drive, Portland, ME",
    appBeverageType: "malt_beverage",
    appBrand: "North Pier",
    appClass: "India Pale Ale",
    appAbv: "6.8%",
    appNet: "12 fl oz",
    appBottler: "North Pier Brewing Co.",
    appBottlerAddress: "60 Harbor Drive, Portland, ME",
    palette: "beer",
    expected: "review",
    ...passWarning,
  },
  {
    // wrong ABV — label says 5.5%, app says 5.0%
    slug: "tall-oak-wrong-abv",
    labelBrand: "Tall Oak",
    labelClass: "Pilsner",
    labelAbv: "5.5% alc/vol",
    labelNet: "12 fl oz",
    bottlerLine1: "Brewed by Tall Oak Brewing Co.",
    bottlerLine2: "11 Industrial Way, Madison, WI",
    appBeverageType: "malt_beverage",
    appBrand: "Tall Oak",
    appClass: "Pilsner",
    appAbv: "5.0%",
    appNet: "12 fl oz",
    appBottler: "Tall Oak Brewing Co.",
    appBottlerAddress: "11 Industrial Way, Madison, WI",
    palette: "beer",
    expected: "fail",
    ...passWarning,
  },
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

function buildSvg(v: Variant): string {
  const palette = PALETTES[v.palette];
  const banner = BANNER[v.palette];
  const warningBody = CANONICAL_BODY;
  const lines = wrapText(warningBody, 64);
  const warningStartY = 920;
  const lineHeight = 22;
  const headerWeight = v.warningHeaderBold ? "700" : "400";
  const brandSize = v.labelBrand.length > 16 ? 70 : 92;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${palette.bg}"/>
  <rect x="32" y="32" width="${W - 64}" height="${H - 64}" fill="none" stroke="${palette.ink}" stroke-width="3"/>

  <rect x="32" y="32" width="${W - 64}" height="120" fill="${palette.band}"/>
  <text x="${W / 2}" y="115" font-family="Georgia, 'Times New Roman', serif"
        font-size="56" font-weight="700" fill="${palette.bandText}" text-anchor="middle"
        letter-spacing="6">${escapeXml(banner)}</text>

  <text x="${W / 2}" y="280" font-family="Georgia, 'Times New Roman', serif"
        font-size="${brandSize}" font-weight="700"
        fill="${palette.ink}" text-anchor="middle" letter-spacing="4">${escapeXml(v.labelBrand)}</text>

  <text x="${W / 2}" y="360" font-family="Georgia, 'Times New Roman', serif"
        font-size="34" font-style="italic" fill="${palette.ink}" text-anchor="middle">${escapeXml(v.labelClass)}</text>

  <line x1="240" y1="410" x2="${W - 240}" y2="410" stroke="${palette.ink}" stroke-width="2"/>

  <text x="${W / 2}" y="470" font-family="Georgia, 'Times New Roman', serif"
        font-size="32" font-weight="600" fill="${palette.ink}" text-anchor="middle">${escapeXml(v.labelAbv)} · ${escapeXml(v.labelNet)}</text>

  <text x="${W / 2}" y="640" font-family="Georgia, serif" font-size="220"
        fill="${palette.ink}" text-anchor="middle" opacity="0.18">❦</text>

  <text x="${W / 2}" y="780" font-family="Georgia, 'Times New Roman', serif"
        font-size="22" fill="${palette.ink}" text-anchor="middle"
        letter-spacing="4">EST. 2024 · LIMITED RELEASE</text>

  <text x="80" y="${warningStartY - 6}" font-family="Helvetica, Arial, sans-serif"
        font-size="20" font-weight="${headerWeight}" fill="${palette.ink}">${escapeXml(v.warningHeader)}</text>
  ${lines
    .map(
      (line, i) =>
        `<text x="80" y="${warningStartY + 22 + i * lineHeight}" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="${palette.ink}">${escapeXml(line)}</text>`,
    )
    .join("\n  ")}

  <text x="${W / 2}" y="${H - 110}" font-family="Helvetica, Arial, sans-serif"
        font-size="18" fill="${palette.ink}" text-anchor="middle">${escapeXml(v.bottlerLine1)}</text>
  <text x="${W / 2}" y="${H - 84}" font-family="Helvetica, Arial, sans-serif"
        font-size="18" fill="${palette.ink}" text-anchor="middle">${escapeXml(v.bottlerLine2)}</text>
</svg>`;
}

function csvField(v: string | undefined): string {
  if (v == null || v === "") return "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function buildCsv(rows: { filename: string; v: Variant }[]): string {
  const headers = [
    "filename",
    "beverageType",
    "brandName",
    "classType",
    "alcoholContent",
    "netContents",
    "bottlerName",
    "bottlerAddress",
    "importerName",
    "importerAddress",
    "countryOfOrigin",
  ];
  const lines = [headers.join(",")];
  for (const { filename, v } of rows) {
    lines.push(
      [
        csvField(filename),
        csvField(v.appBeverageType),
        csvField(v.appBrand),
        csvField(v.appClass),
        csvField(v.appAbv),
        csvField(v.appNet),
        csvField(v.appBottler),
        csvField(v.appBottlerAddress),
        csvField(v.appImporter),
        csvField(v.appImporterAddress),
        csvField(v.appCountryOfOrigin),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

async function renderVariant(filename: string, v: Variant): Promise<void> {
  const svg = buildSvg(v);
  const out = await sharp(Buffer.from(svg))
    .flatten({ background: PALETTES[v.palette].bg })
    .jpeg({ quality: 84 })
    .toBuffer();
  await writeFile(join(OUT_DIR, filename), out);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  const rows = variants.map((v, i) => ({
    filename: `${String(i + 1).padStart(2, "0")}-${v.slug}.jpg`,
    v,
  }));

  for (const { filename, v } of rows) {
    await renderVariant(filename, v);
    console.log(`wrote ${filename}`);
  }

  const csv = buildCsv(rows);
  await writeFile(join(OUT_DIR, "applications.csv"), csv);
  console.log(`wrote applications.csv (${rows.length} rows)`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    rows: rows.map(({ filename, v }) => ({
      filename,
      brand: v.appBrand,
      beverageType: v.appBeverageType,
      expected: v.expected,
    })),
  };
  await writeFile(join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote manifest.json`);

  const counts = rows.reduce<Record<string, number>>((acc, { v }) => {
    acc[v.expected] = (acc[v.expected] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`expected verdicts: ${JSON.stringify(counts)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
