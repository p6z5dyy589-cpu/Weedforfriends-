import { MAX_UPLOAD_BYTES } from "@shared/files";

export class UploadError extends Error {
  constructor(public readonly kind: "too_large" | "type" | "failed" | "company_changed" | "session") {
    super(kind);
  }
}

/**
 * Re-encodes the photo as JPEG (max 2000px). This keeps uploads small on the
 * plant Wi-Fi and drops EXIF metadata such as GPS position.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new UploadError("type");
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (blob) return blob;
  } catch {
    // Fall back to the original file (server checks the real type).
  }
  return file;
}

export async function uploadPhoto(blob: Blob, requestId: string, companyId: number): Promise<string> {
  if (blob.size > MAX_UPLOAD_BYTES) throw new UploadError("too_large");
  const res = await fetch("/api/files", {
    method: "POST",
    credentials: "same-origin",
    headers: { "x-request-id": requestId, "x-company-id": String(companyId), "content-type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (res.status === 413) throw new UploadError("too_large");
  if (res.status === 415) throw new UploadError("type");
  if (res.status === 409) throw new UploadError("company_changed");
  if (res.status === 401) throw new UploadError("session");
  if (!res.ok) throw new UploadError("failed");
  const body = (await res.json()) as { fileId: string };
  return body.fileId;
}
