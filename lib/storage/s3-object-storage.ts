import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type ServerSideEncryption,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStorageAdapter, StoredObject } from "./object-storage";

const DEFAULT_URL_EXPIRY_SECONDS = 300;
const MAX_URL_EXPIRY_SECONDS = 900;

function requiredSetting(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required object-storage setting: ${name}`);
  return value;
}

function createClient() {
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT?.trim();
  const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY;
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error("Both object-storage access key and secret must be configured together.");
  }

  return new S3Client({
    region: requiredSetting("OBJECT_STORAGE_REGION"),
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });
}

export class S3ObjectStorage implements ObjectStorageAdapter {
  private readonly client = createClient();
  private readonly bucket = requiredSetting("OBJECT_STORAGE_BUCKET");
  private readonly encryption = (process.env.OBJECT_STORAGE_SERVER_SIDE_ENCRYPTION?.trim() || "AES256") as ServerSideEncryption;
  private readonly kmsKeyId = process.env.OBJECT_STORAGE_KMS_KEY_ID?.trim();

  async put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
    checksumSha256: string;
    metadata?: Record<string, string>;
  }): Promise<StoredObject> {
    if (!["AES256", "aws:kms"].includes(this.encryption)) {
      throw new Error("Object-storage server-side encryption must be AES256 or aws:kms.");
    }
    if (this.encryption === "aws:kms" && !this.kmsKeyId) {
      throw new Error("OBJECT_STORAGE_KMS_KEY_ID is required for aws:kms encryption.");
    }
    const response = await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      Body: input.body,
      ContentLength: input.body.byteLength,
      ContentType: input.contentType,
      ChecksumSHA256: input.checksumSha256,
      ServerSideEncryption: this.encryption,
      ...(this.encryption === "aws:kms" ? { SSEKMSKeyId: this.kmsKeyId } : {}),
      Metadata: input.metadata,
    }));
    return {
      key: input.key,
      contentType: input.contentType,
      sizeBytes: input.body.byteLength,
      checksumSha256: input.checksumSha256,
      etag: response.ETag,
    };
  }

  async get(key: string) {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return response.Body?.transformToWebStream() ?? null;
    } catch (error) {
      if (error instanceof Error && "name" in error && error.name === "NoSuchKey") return null;
      throw error;
    }
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }

  async createDownloadUrl(
    key: string,
    options: { expiresInSeconds?: number; filename?: string } = {},
  ) {
    const expiresIn = options.expiresInSeconds ?? DEFAULT_URL_EXPIRY_SECONDS;
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > MAX_URL_EXPIRY_SECONDS) {
      throw new Error(`Signed download URL expiry must be between 1 and ${MAX_URL_EXPIRY_SECONDS} seconds.`);
    }
    const filename = options.filename?.replace(/["\\\r\n]/g, "_");
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(filename ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {}),
      }),
      { expiresIn },
    );
  }
}

let adapter: S3ObjectStorage | undefined;

export function getS3ObjectStorage() {
  adapter ??= new S3ObjectStorage();
  return adapter;
}
