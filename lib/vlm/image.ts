import { createHash } from "node:crypto";
import sharp from "sharp";

// 1280px gives accurate label-text reads (TTB labels have ≥10pt body) and
// trims ~1.5× off the image-token bill vs Anthropic's 1568 max — measurably
// faster on Sonnet/Haiku 4.5 with no accuracy regression on the eval set.
// (Was 1568 — moved down 2026-04-29 to land Tiered under the <5s SLO.)
export const MAX_EDGE_PX = 1280;
export const JPEG_QUALITY = 85;
export const MIN_EDGE_PX = 480;
export const MIN_BRIGHTNESS = 30;

export type ImageQuality = {
  lowQuality: boolean;
  reasons: ("too_small" | "too_dark")[];
  width: number;
  height: number;
  meanBrightness: number;
};

export type PreparedImage = {
  buffer: Buffer;
  base64: string;
  dataUrl: string;
  hash: string;
  width: number;
  height: number;
  meanBrightness: number;
  quality: ImageQuality;
};

export async function prepareImage(input: Buffer | Uint8Array): Promise<PreparedImage> {
  const pipeline = sharp(Buffer.from(input))
    .rotate()
    .resize(MAX_EDGE_PX, MAX_EDGE_PX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY });

  const { data: buffer, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const stats = await sharp(buffer).stats();
  const meanBrightness = stats.channels.reduce((sum, c) => sum + c.mean, 0) / stats.channels.length;

  const base64 = buffer.toString("base64");
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  const hash = createHash("sha256").update(buffer).digest("hex");

  const reasons: ImageQuality["reasons"] = [];
  if (Math.max(info.width, info.height) < MIN_EDGE_PX) reasons.push("too_small");
  if (meanBrightness < MIN_BRIGHTNESS) reasons.push("too_dark");

  return {
    buffer,
    base64,
    dataUrl,
    hash,
    width: info.width,
    height: info.height,
    meanBrightness,
    quality: {
      lowQuality: reasons.length > 0,
      reasons,
      width: info.width,
      height: info.height,
      meanBrightness,
    },
  };
}
