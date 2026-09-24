import type { EvidenceDocument } from "../domain/evidence";

export type ObjectStorage = {
  put(input: {
    key: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{ key: string }>;
  delete(key: string): Promise<void>;
};

export type DocumentRepository = {
  create(document: Omit<EvidenceDocument, "id" | "createdAt" | "updatedAt">): Promise<EvidenceDocument>;
  findById(id: string, organizationId: string): Promise<EvidenceDocument | null>;
  createVersion(input: {
    previousVersionId: string;
    document: Omit<EvidenceDocument, "id" | "createdAt" | "updatedAt">;
  }): Promise<EvidenceDocument>;
};

export async function persistDocument(input: {
  storage: ObjectStorage;
  repository: DocumentRepository;
  document: Omit<EvidenceDocument, "id" | "createdAt" | "updatedAt">;
  bytes: Uint8Array;
}) {
  await input.storage.put({
    key: input.document.storageKey,
    bytes: input.bytes,
    contentType: input.document.mimeType,
  });
  return input.repository.create(input.document);
}
