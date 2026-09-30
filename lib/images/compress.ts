/**
 * Client-side photo preparation for inquiries (ARCHITECTURE §E7): type and size checks, then
 * downscale to a 2048 px long edge and re-encode as JPEG (≤ ~2 MB) before upload. Convex
 * re-checks size and sniffs magic bytes after the upload.
 */
export const PHOTO_ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const LONG_EDGE = 2048;
const TARGET_BYTES = 2 * 1024 * 1024;

export type PhotoCheck = { ok: true } | { ok: false; reason: "type" | "size" };

export function checkPhoto(file: { type: string; size: number }): PhotoCheck {
  if (!(PHOTO_ACCEPT as readonly string[]).includes(file.type)) return { ok: false, reason: "type" };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}

/** Target size for a long edge limit, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, max = LONG_EDGE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const k = max / long;
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Compressed JPEG (or the original when it is already small and not decodable). */
export async function compressPhoto(file: File): Promise<Blob> {
  if (file.size <= 400 * 1024 && file.type === "image/jpeg") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const size = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  for (const quality of [0.85, 0.75, 0.65, 0.55]) {
    const blob = await toBlob(canvas, quality);
    if (blob && (blob.size <= TARGET_BYTES || quality === 0.55)) return blob;
  }
  return file;
}
