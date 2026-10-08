export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export interface FileMeta {
  mime: ImageType;
  size: number;
  sha256: string;
  uploadedBy: number;
}

/** Detects the real image type from magic bytes; the declared type is not trusted. */
export function sniffImageType(buf: Uint8Array): ImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b)) return "image/png";
  if (
    buf.length >= 12 &&
    String.fromCharCode(...buf.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...buf.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
