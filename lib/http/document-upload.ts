import { createHash } from "node:crypto";
import {
  documentUploadMetadataSchema,
  isAllowedDocumentType,
  matchesDocumentSignature,
  MAX_DOCUMENT_BYTES,
  uploadDescriptorSchema,
} from "@/lib/validation/document-upload";

export async function parseDocumentUpload(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_DOCUMENT_BYTES + 1024 * 1024) {
    throw new Error("DOCUMENT_TOO_LARGE");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new Error("INVALID_MULTIPART_BODY");
  }

  const file = form.get("file");
  const checksum = form.get("sha256");
  const metadataValue = form.get("metadata");
  if (typeof File === "undefined" || !(file instanceof File) || typeof checksum !== "string") {
    throw new Error("UPLOAD_FIELDS_REQUIRED");
  }
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("DOCUMENT_TOO_LARGE");
  if (!isAllowedDocumentType(file.type)) throw new Error("DOCUMENT_TYPE_NOT_ALLOWED");

  const descriptor = uploadDescriptorSchema.safeParse({
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    sha256: checksum,
  });
  if (!descriptor.success) throw new Error("INVALID_UPLOAD_DESCRIPTOR");

  let metadataJson: unknown = {};
  if (typeof metadataValue === "string" && metadataValue) {
    try {
      metadataJson = JSON.parse(metadataValue);
    } catch {
      throw new Error("INVALID_DOCUMENT_METADATA");
    }
  } else if (metadataValue !== null) {
    throw new Error("INVALID_DOCUMENT_METADATA");
  }
  const metadata = documentUploadMetadataSchema.safeParse(metadataJson);
  if (!metadata.success) throw new Error("INVALID_DOCUMENT_METADATA");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const actualChecksum = createHash("sha256").update(bytes).digest("hex");
  if (actualChecksum.toLowerCase() !== descriptor.data.sha256.toLowerCase()) {
    throw new Error("DOCUMENT_CHECKSUM_MISMATCH");
  }
  if (!matchesDocumentSignature(file.type, bytes)) throw new Error("DOCUMENT_SIGNATURE_MISMATCH");

  return {
    bytes,
    checksumSha256: actualChecksum,
    filename: file.name,
    mimeType: file.type,
    metadata: metadata.data,
  };
}
