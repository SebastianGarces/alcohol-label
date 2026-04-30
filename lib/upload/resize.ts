// Browser-only helper: downscale large images on the client before upload, so we
// minimize 413 / oversize pushback on the server side.

// Matches MAX_EDGE_PX in lib/vlm/image.ts — server re-resizes anyway, but
// downscaling client-side keeps uploads small and reduces 413s.
export const CLIENT_MAX_EDGE_PX = 1280;
export const CLIENT_TARGET_BYTES = 1.5 * 1024 * 1024;
export const CLIENT_RESIZE_THRESHOLD_BYTES = 1.5 * 1024 * 1024;

export async function resizeImageForUpload(file: File): Promise<File> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return file;
  }
  if (file.size <= CLIENT_RESIZE_THRESHOLD_BYTES && !file.type.endsWith("/heic")) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > CLIENT_MAX_EDGE_PX ? CLIENT_MAX_EDGE_PX / longest : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) return file;

  const targetName = `${file.name.replace(/\.\w+$/, "")}.jpg`;
  return new File([blob], targetName, { type: "image/jpeg", lastModified: Date.now() });
}
