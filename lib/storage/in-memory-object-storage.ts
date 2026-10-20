import type { ObjectStorageAdapter, StoredObject } from "./object-storage";

export class InMemoryObjectStorage implements ObjectStorageAdapter {
  private objects = new Map<string, Uint8Array>();

  async put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
    checksumSha256: string;
  }): Promise<StoredObject> {
    this.objects.set(input.key, new Uint8Array(input.body));
    return {
      key: input.key,
      contentType: input.contentType,
      sizeBytes: input.body.byteLength,
      checksumSha256: input.checksumSha256,
    };
  }
  async get(key: string) {
    const value = this.objects.get(key);
    if (!value) return null;
    return new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(value); controller.close(); }
    });
  }
  async delete(key: string) { this.objects.delete(key); }
  async createDownloadUrl(key: string) {
    if (!this.objects.has(key)) throw new Error("OBJECT_NOT_FOUND");
    return `memory://object/${encodeURIComponent(key)}`;
  }
}
