import { z } from "zod";

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const uploadDescriptorSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(150),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const documentUploadMetadataSchema = z.object({
  clientId: z.string().trim().min(1).optional(),
  engagementId: z.string().trim().min(1).optional(),
  complianceObligationId: z.string().trim().min(1).optional(),
  evidenceId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  documentType: z.enum([
    "FORMATION", "COMPLIANCE", "IDENTITY", "TAX", "BANKING",
    "CONTRACT", "LICENSE", "REPORT", "SOURCE", "OTHER",
  ]).default("OTHER"),
}).strict();

export function isAllowedDocumentType(mimeType: string) {
  return [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ].includes(mimeType);
}

export function matchesDocumentSignature(mimeType: string, bytes: Uint8Array) {
  if (mimeType === "application/pdf") {
    return bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
      [0x03, 0x05, 0x07].includes(bytes[2]) && [0x04, 0x06, 0x08].includes(bytes[3]);
  }
  if (mimeType === "text/plain") {
    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return !decoded.includes("\0");
    } catch {
      return false;
    }
  }
  return false;
}
