import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseDocumentUpload } from "@/lib/http/document-upload";
import { buildTenantObjectKey } from "@/lib/storage/object-storage";

function uploadRequest(input: {
  bytes?: string;
  checksum?: string;
  mimeType?: string;
  filename?: string;
  metadata?: string;
}) {
  const bytes = new TextEncoder().encode(input.bytes ?? "%PDF-1.7\ncontent");
  const checksum = input.checksum ?? createHash("sha256").update(bytes).digest("hex");
  const form = new FormData();
  form.set("file", new Blob([bytes], { type: input.mimeType ?? "application/pdf" }), input.filename ?? "evidence.pdf");
  form.set("sha256", checksum);
  form.set("metadata", input.metadata ?? JSON.stringify({ documentType: "COMPLIANCE" }));
  return new Request("https://app.example/api/documents", {
    method: "POST",
    headers: { origin: "https://app.example" },
    body: form,
  });
}

describe("document upload boundary", () => {
  it("accepts matching checksums, allowed file signatures, and scoped metadata", async () => {
    const parsed = await parseDocumentUpload(uploadRequest({}));

    expect(parsed.filename).toBe("evidence.pdf");
    expect(parsed.mimeType).toBe("application/pdf");
    expect(parsed.metadata.documentType).toBe("COMPLIANCE");
    expect(new TextDecoder().decode(parsed.bytes).startsWith("%PDF-")).toBe(true);
  });

  it("rejects a mismatched checksum", async () => {
    await expect(parseDocumentUpload(uploadRequest({ checksum: "0".repeat(64) })))
      .rejects.toThrow("DOCUMENT_CHECKSUM_MISMATCH");
  });

  it("rejects a spoofed MIME type whose bytes have a different signature", async () => {
    await expect(parseDocumentUpload(uploadRequest({ bytes: "not a PDF" })))
      .rejects.toThrow("DOCUMENT_SIGNATURE_MISMATCH");
  });

  it("rejects tenant identity fields in client-supplied metadata", async () => {
    await expect(parseDocumentUpload(uploadRequest({
      metadata: JSON.stringify({ organizationId: "attacker-org" }),
    }))).rejects.toThrow("INVALID_DOCUMENT_METADATA");
  });

  it("creates tenant-separated, versioned keys and sanitizes filenames", () => {
    expect(buildTenantObjectKey({
      organizationId: "org-a",
      workspaceId: "workspace-a",
      documentId: "doc-a",
      version: 2,
      filename: "../../secret.pdf",
    })).toBe("org-a/workspace-a/documents/doc-a/v2/.._.._secret.pdf");
  });
});
