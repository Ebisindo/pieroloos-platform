import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, getSignedUrlMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    send = sendMock;
  }
  class Command {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  return {
    S3Client,
    PutObjectCommand: Command,
    GetObjectCommand: Command,
    DeleteObjectCommand: Command,
  };
});
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: getSignedUrlMock }));

import { S3ObjectStorage } from "@/lib/storage/s3-object-storage";

describe("S3-compatible object storage", () => {
  beforeEach(() => {
    vi.stubEnv("OBJECT_STORAGE_BUCKET", "private-evidence");
    vi.stubEnv("OBJECT_STORAGE_REGION", "us-east-1");
    vi.stubEnv("OBJECT_STORAGE_ENDPOINT", "https://objects.example");
    vi.stubEnv("OBJECT_STORAGE_SERVER_SIDE_ENCRYPTION", "AES256");
    vi.stubEnv("OBJECT_STORAGE_ACCESS_KEY_ID", "test-key");
    vi.stubEnv("OBJECT_STORAGE_SECRET_ACCESS_KEY", "test-secret");
    sendMock.mockReset().mockResolvedValue({ ETag: '"etag"' });
    getSignedUrlMock.mockReset().mockResolvedValue("https://signed.example/object");
  });

  it("requests server-side encryption and supplies the SHA-256 checksum on writes", async () => {
    const storage = new S3ObjectStorage();
    const checksumSha256 = Buffer.from("sha256").toString("base64");
    const result = await storage.put({
      key: "org/workspace/documents/id/v1/file.pdf",
      body: new Uint8Array([1, 2, 3]),
      contentType: "application/pdf",
      checksumSha256,
    });

    expect(sendMock).toHaveBeenCalledOnce();
    const command = sendMock.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: "private-evidence",
      Key: "org/workspace/documents/id/v1/file.pdf",
      ServerSideEncryption: "AES256",
      ChecksumSHA256: checksumSha256,
      ContentLength: 3,
    });
    expect(command.input).not.toHaveProperty("SSEKMSKeyId");
    expect(result).toMatchObject({ checksumSha256, sizeBytes: 3, etag: '"etag"' });
  });

  it("uses the configured KMS key only when KMS encryption is selected", async () => {
    vi.stubEnv("OBJECT_STORAGE_SERVER_SIDE_ENCRYPTION", "aws:kms");
    vi.stubEnv("OBJECT_STORAGE_KMS_KEY_ID", "kms-key-1");
    const storage = new S3ObjectStorage();
    await storage.put({
      key: "tenant/key",
      body: new Uint8Array([1]),
      contentType: "application/pdf",
      checksumSha256: Buffer.from("sum").toString("base64"),
    });

    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: "kms-key-1",
    });
  });

  it("limits temporary download URLs to fifteen minutes", async () => {
    const storage = new S3ObjectStorage();
    await expect(storage.createDownloadUrl("tenant/key", {
      expiresInSeconds: 300,
      filename: 'proof".pdf',
    })).resolves.toBe("https://signed.example/object");
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ input: expect.objectContaining({
        ResponseContentDisposition: 'attachment; filename="proof_.pdf"',
      }) }),
      { expiresIn: 300 },
    );
    await expect(storage.createDownloadUrl("tenant/key", { expiresInSeconds: 901 }))
      .rejects.toThrow("expiry must be between");
  });
});
