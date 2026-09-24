export type StoredObject = { key: string; contentType: string; sizeBytes: number; etag?: string };

export interface ObjectStorageAdapter {
  put(input: { key: string; body: Uint8Array; contentType: string; metadata?: Record<string, string> }): Promise<StoredObject>;
  get(key: string): Promise<ReadableStream<Uint8Array> | null>;
  delete(key: string): Promise<void>;
  createDownloadUrl(key: string, options?: { expiresInSeconds?: number }): Promise<string>;
}

export function buildTenantObjectKey(input: {
  organizationId: string; workspaceId: string; documentId: string; version: number; filename: string;
}) {
  const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return [input.organizationId, input.workspaceId, "documents", input.documentId, `v${input.version}`, safeFilename].join("/");
}
