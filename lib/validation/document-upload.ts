import { z } from "zod";

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const uploadDescriptorSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(150),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export function isAllowedDocumentType(mimeType: string) {
  return [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ].includes(mimeType);
}
