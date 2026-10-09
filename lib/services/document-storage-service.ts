import { createHash, randomUUID } from "node:crypto";
import { DocumentReviewStatus, DocumentScanStatus, DocumentStorageStatus, Prisma } from "@prisma/client";
import {
  withClientPortalGrantTransaction,
  type ClientPortalPrincipal,
} from "@/lib/auth/client-portal-access";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { assertPermission } from "@/lib/auth/workspace-access";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { prisma } from "@/lib/db/prisma";
import type { documentUploadMetadataSchema } from "@/lib/validation/document-upload";
import { buildTenantObjectKey } from "@/lib/storage/object-storage";
import { getS3ObjectStorage } from "@/lib/storage/s3-object-storage";
import { z } from "zod";

type UploadMetadata = z.infer<typeof documentUploadMetadataSchema>;
type DocumentUpload = {
  bytes: Uint8Array;
  checksumSha256: string;
  filename: string;
  mimeType: string;
  metadata: UploadMetadata;
};
type DocumentUploadPrincipal = WorkspacePrincipal | ClientPortalPrincipal;

function isClientPortalPrincipal(
  principal: DocumentUploadPrincipal,
): principal is ClientPortalPrincipal {
  return "clientPortalGrantId" in principal;
}

function withDocumentWriteTransaction<T>(
  principal: DocumentUploadPrincipal,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  if (isClientPortalPrincipal(principal)) {
    return withClientPortalGrantTransaction(principal, "UPLOAD_EVIDENCE", operation);
  }
  return withAuthorizedWorkspaceTransaction(principal, "documents:write", operation);
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function checksumBase64(hex: string) {
  return Buffer.from(hex, "hex").toString("base64");
}

function serializeDocument(document: {
  id: string;
  workspaceId: string;
  clientId: string | null;
  engagementId: string | null;
  complianceObligationId: string | null;
  evidenceId: string | null;
  rootDocumentId: string;
  previousVersionId: string | null;
  version: number;
  name: string;
  description: string | null;
  documentType: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  status: DocumentStorageStatus;
  scanStatus: DocumentScanStatus;
  reviewStatus: DocumentReviewStatus;
  retainUntil: Date | null;
  deletedAt: Date | null;
  uploadedByUserId: string;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return document;
}

async function validateDocumentLinks(
  transaction: Prisma.TransactionClient,
  metadata: UploadMetadata,
  principal: Pick<WorkspacePrincipal, "workspaceId">,
) {
  const [client, engagement, obligation, evidence] = await Promise.all([
    metadata.clientId
      ? transaction.client.findFirst({
          where: { id: metadata.clientId, workspaceId: principal.workspaceId },
          select: { id: true },
        })
      : null,
    metadata.engagementId
      ? transaction.engagement.findFirst({
          where: { id: metadata.engagementId, workspaceId: principal.workspaceId },
          select: { id: true, clientId: true },
        })
      : null,
    metadata.complianceObligationId
      ? transaction.complianceObligation.findFirst({
          where: { id: metadata.complianceObligationId, workspaceId: principal.workspaceId },
          select: { id: true, clientId: true },
        })
      : null,
    metadata.evidenceId
      ? transaction.evidence.findFirst({
          where: {
            id: metadata.evidenceId,
            OR: [
              { jurisdiction: { workspaceId: principal.workspaceId } },
              { jurisdiction: { workspaceId: null } },
              { complianceItem: { workspaceId: principal.workspaceId } },
            ],
          },
          select: { id: true },
        })
      : null,
  ]);

  if (
    (metadata.clientId && !client) ||
    (metadata.engagementId && !engagement) ||
    (metadata.complianceObligationId && !obligation) ||
    (metadata.evidenceId && !evidence)
  ) {
    throw new Error("DOCUMENT_LINK_NOT_FOUND");
  }

  const linkedClientId = client?.id ?? engagement?.clientId ?? obligation?.clientId;
  if (
    (client && engagement && engagement.clientId !== client.id) ||
    (client && obligation && obligation.clientId !== client.id) ||
    (engagement && obligation && engagement.clientId !== obligation.clientId)
  ) {
    throw new Error("DOCUMENT_LINK_MISMATCH");
  }

  return {
    clientId: linkedClientId ?? null,
    engagementId: engagement?.id ?? null,
    complianceObligationId: obligation?.id ?? null,
    evidenceId: evidence?.id ?? null,
  };
}

async function storeUpload(
  input: DocumentUpload,
  principal: DocumentUploadPrincipal,
  versionOfId?: string,
) {
  const portalUpload = isClientPortalPrincipal(principal);
  if (!portalUpload) assertPermission(principal, "documents:write");
  if (portalUpload && versionOfId) throw new Error("CLIENT_PORTAL_VERSION_UPLOAD_NOT_ALLOWED");
  if (portalUpload && input.metadata.clientId && input.metadata.clientId !== principal.clientId) {
    throw new Error("CLIENT_PORTAL_CLIENT_MISMATCH");
  }
  const uploadInput = portalUpload
    ? {
        ...input,
        metadata: {
          ...input.metadata,
          clientId: principal.clientId,
          engagementId: undefined,
          complianceObligationId: undefined,
          evidenceId: undefined,
        },
      }
    : input;
  if (input.bytes.byteLength === 0 || sha256(input.bytes) !== input.checksumSha256.toLowerCase()) {
    throw new Error("DOCUMENT_CHECKSUM_MISMATCH");
  }

  const documentId = randomUUID();
  let rootDocumentId: string = documentId;
  let previousVersionId: string | null = null;
  let version = 1;
  let latestVersion = 1;
  let inheritedMetadata = uploadInput.metadata;
  let expectedRootLatestVersion = 0;

  const preflight = await withDocumentWriteTransaction(principal, async (transaction) => {
    const retentionSettings = await transaction.workspaceSettings.findUnique({
      where: { workspaceId: principal.workspaceId },
      select: { documentRetentionDays: true },
    });
    if (!retentionSettings?.documentRetentionDays) throw new Error("DOCUMENT_RETENTION_POLICY_REQUIRED");

    const previous = versionOfId
      ? await transaction.document.findFirst({
        where: { id: versionOfId, workspaceId: principal.workspaceId, deletedAt: null },
        select: {
          id: true,
          version: true,
          rootDocumentId: true,
          clientId: true,
          engagementId: true,
          complianceObligationId: true,
          evidenceId: true,
          name: true,
          description: true,
          documentType: true,
          status: true,
          scanStatus: true,
          rootDocument: { select: { id: true, latestVersion: true } },
        },
      })
      : null;
    if (versionOfId && !previous) throw new Error("DOCUMENT_NOT_FOUND");
    if (
      previous &&
      (previous.version !== previous.rootDocument.latestVersion ||
        previous.status !== DocumentStorageStatus.AVAILABLE ||
        previous.scanStatus !== DocumentScanStatus.CLEAN)
    ) {
      throw new Error("DOCUMENT_VERSION_CONFLICT");
    }
    return previous;
  });

  if (preflight) {
    const previous = preflight;
    rootDocumentId = previous.rootDocument.id;
    previousVersionId = previous.id;
    expectedRootLatestVersion = previous.rootDocument.latestVersion;
    version = expectedRootLatestVersion + 1;
    latestVersion = version;
    inheritedMetadata = {
      ...uploadInput.metadata,
      clientId: previous.clientId ?? undefined,
      engagementId: previous.engagementId ?? undefined,
      complianceObligationId: previous.complianceObligationId ?? undefined,
      evidenceId: previous.evidenceId ?? undefined,
      name: input.metadata.name ?? previous.name,
      description: input.metadata.description ?? previous.description ?? undefined,
      documentType: previous.documentType as UploadMetadata["documentType"],
    };
  }

  const storage = getS3ObjectStorage();

  const key = buildTenantObjectKey({
    organizationId: principal.organizationId,
    workspaceId: principal.workspaceId,
    documentId,
    version,
    filename: input.filename,
  });
  const checksumSha256 = checksumBase64(input.checksumSha256);
  let objectStored = false;

  try {
    const stored = await storage.put({
      key,
      body: input.bytes,
      contentType: input.mimeType,
      checksumSha256,
      metadata: {
        "organization-id": principal.organizationId,
        "workspace-id": principal.workspaceId,
        "document-id": documentId,
        "sha256": input.checksumSha256,
      },
    });
    objectStored = true;
    if (stored.sizeBytes !== input.bytes.byteLength || stored.checksumSha256 !== checksumSha256) {
      throw new Error("OBJECT_STORAGE_INTEGRITY_MISMATCH");
    }

    const document = await withDocumentWriteTransaction(principal, async (transaction) => {
        const settings = await transaction.workspaceSettings.findUnique({
          where: { workspaceId: principal.workspaceId },
          select: { documentRetentionDays: true },
        });
        if (!settings?.documentRetentionDays) throw new Error("DOCUMENT_RETENTION_POLICY_REQUIRED");

        const links = versionOfId
          ? await validateDocumentLinks(transaction, inheritedMetadata, principal)
          : await validateDocumentLinks(transaction, uploadInput.metadata, principal);

        if (versionOfId) {
          const currentRoot = await transaction.document.findFirst({
            where: {
              id: rootDocumentId,
              workspaceId: principal.workspaceId,
              status: { not: "DELETED" },
            },
            select: { id: true, latestVersion: true },
          });
          if (!currentRoot || currentRoot.latestVersion !== expectedRootLatestVersion) {
            throw new Error("DOCUMENT_VERSION_CONFLICT");
          }
          const updated = await transaction.document.updateMany({
            where: {
              id: currentRoot.id,
              workspaceId: principal.workspaceId,
              latestVersion: expectedRootLatestVersion,
            },
            data: { latestVersion },
          });
          if (updated.count !== 1) throw new Error("DOCUMENT_VERSION_CONFLICT");
        }

        const created = await transaction.document.create({
          data: {
            id: documentId,
            workspaceId: principal.workspaceId,
            ...links,
            rootDocumentId,
            previousVersionId,
            version,
            latestVersion,
            name: inheritedMetadata.name ?? input.filename,
            description: inheritedMetadata.description ?? null,
            documentType: inheritedMetadata.documentType,
            mimeType: input.mimeType,
            storageKey: key,
            sizeBytes: input.bytes.byteLength,
            checksum: input.checksumSha256,
            status: DocumentStorageStatus.PENDING_SCAN,
            scanStatus: DocumentScanStatus.PENDING,
            reviewStatus: DocumentReviewStatus.UNREVIEWED,
            uploadedByUserId: principal.userId,
            retainUntil: new Date(Date.now() + settings.documentRetentionDays * 24 * 60 * 60 * 1000),
          },
        });
        await transaction.documentAccessEvent.create({
          data: {
            documentId: created.id,
            workspaceId: principal.workspaceId,
            actorUserId: principal.userId,
            action: versionOfId ? "VERSION_UPLOADED" : "UPLOADED",
            metadata: { version, checksum: input.checksumSha256 },
          },
        });
        if (portalUpload) {
          await transaction.clientPortalAuditEvent.create({
            data: {
              organizationId: principal.organizationId,
              workspaceId: principal.workspaceId,
              clientId: principal.clientId,
              grantId: principal.clientPortalGrantId,
              actorUserId: principal.userId,
              action: "EVIDENCE_UPLOADED",
              resourceId: created.id,
            },
          });
        }
        return created;
      });
    return serializeDocument(document);
  } catch (error) {
    if (objectStored) {
      try {
        await storage.delete(key);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Document persistence failed and the uploaded object could not be cleaned up.",
        );
      }
    }
    throw error;
  }
}

export function uploadDocument(input: DocumentUpload, principal: WorkspacePrincipal) {
  return storeUpload(input, principal);
}

export function uploadClientPortalEvidence(
  input: DocumentUpload,
  principal: ClientPortalPrincipal,
) {
  return storeUpload(input, principal);
}

export function createDocumentVersion(
  documentId: string,
  input: DocumentUpload,
  principal: WorkspacePrincipal,
) {
  return storeUpload(input, principal, documentId);
}

export async function listDocuments(
  principal: WorkspacePrincipal,
  filter: { clientIds?: string[]; requireClient?: boolean } = {},
) {
  return withAuthorizedWorkspaceTransaction(principal, "documents:read", async (transaction) => {
    const documents = await transaction.document.findMany({
      where: {
        workspaceId: principal.workspaceId,
        deletedAt: null,
        status: DocumentStorageStatus.AVAILABLE,
        scanStatus: DocumentScanStatus.CLEAN,
        ...(filter.clientIds ? { clientId: { in: filter.clientIds } } : {}),
        ...(filter.requireClient ? { clientId: { not: null } } : {}),
      },
      orderBy: [{ rootDocumentId: "asc" }, { version: "desc" }],
      select: {
        id: true,
        workspaceId: true,
        clientId: true,
        engagementId: true,
        complianceObligationId: true,
        evidenceId: true,
        rootDocumentId: true,
        previousVersionId: true,
        version: true,
        name: true,
        description: true,
        documentType: true,
        mimeType: true,
        sizeBytes: true,
        checksum: true,
        status: true,
        scanStatus: true,
        reviewStatus: true,
        retainUntil: true,
        deletedAt: true,
        uploadedByUserId: true,
        reviewedByUserId: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (documents.length) {
      await transaction.documentAccessEvent.createMany({
        data: documents.map((document) => ({
          documentId: document.id,
          workspaceId: principal.workspaceId,
          actorUserId: principal.userId,
          action: "METADATA_LISTED",
        })),
      });
    }
    return documents.map(serializeDocument);
  });
}

export async function createDocumentDownloadUrl(documentId: string, principal: WorkspacePrincipal) {
  assertPermission(principal, "documents:read");
  const document = await withAuthorizedWorkspaceTransaction(principal, "documents:read", async (transaction) =>
    transaction.document.findFirst({
      where: { id: documentId, workspaceId: principal.workspaceId, deletedAt: null },
    }),
  );
  if (!document) throw new Error("DOCUMENT_NOT_FOUND");
  if (document.status !== DocumentStorageStatus.AVAILABLE || document.scanStatus !== DocumentScanStatus.CLEAN) {
    throw new Error(document.status === DocumentStorageStatus.INFECTED ? "DOCUMENT_INFECTED" : "DOCUMENT_NOT_READY");
  }

  const storage = getS3ObjectStorage();
  const url = await storage.createDownloadUrl(document.storageKey, {
    expiresInSeconds: 300,
    filename: document.name,
  });
  await withAuthorizedWorkspaceTransaction(principal, "documents:read", async (transaction) => {
    const current = await transaction.document.findFirst({
      where: {
        id: document.id,
        workspaceId: principal.workspaceId,
        status: DocumentStorageStatus.AVAILABLE,
        scanStatus: DocumentScanStatus.CLEAN,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!current) throw new Error("DOCUMENT_NOT_READY");
    await transaction.documentAccessEvent.create({
      data: {
        documentId: current.id,
        workspaceId: principal.workspaceId,
        actorUserId: principal.userId,
        action: "DOWNLOAD_URL_ISSUED",
        metadata: { expiresInSeconds: 300 },
      },
    });
  });
  return url;
}

export async function reviewDocument(
  documentId: string,
  input: { reviewStatus: DocumentReviewStatus; reviewNote?: string },
  principal: WorkspacePrincipal,
) {
  return withAuthorizedWorkspaceTransaction(principal, "documents:review", async (transaction) => {
    const existing = await transaction.document.findFirst({
      where: {
        id: documentId,
        workspaceId: principal.workspaceId,
        status: DocumentStorageStatus.AVAILABLE,
        scanStatus: DocumentScanStatus.CLEAN,
        deletedAt: null,
      },
      select: { id: true, reviewStatus: true },
    });
    if (!existing) throw new Error("DOCUMENT_NOT_FOUND");
    const reviewedAt = new Date();
    const document = await transaction.document.update({
      where: { id: existing.id },
      data: {
        reviewStatus: input.reviewStatus,
        reviewNote: input.reviewNote ?? null,
        reviewedByUserId: principal.userId,
        reviewedAt,
      },
    });
    await transaction.documentAccessEvent.create({
      data: {
        documentId: document.id,
        workspaceId: principal.workspaceId,
        actorUserId: principal.userId,
        action: "REVIEWED",
        metadata: {
          fromStatus: existing.reviewStatus,
          toStatus: document.reviewStatus,
        },
      },
    });
    return serializeDocument(document);
  });
}

export async function softDeleteDocument(documentId: string, principal: WorkspacePrincipal) {
  return withAuthorizedWorkspaceTransaction(principal, "documents:delete", async (transaction) => {
    const document = await transaction.document.findFirst({
      where: { id: documentId, workspaceId: principal.workspaceId, deletedAt: null },
      select: { id: true, rootDocumentId: true },
    });
    if (!document) throw new Error("DOCUMENT_NOT_FOUND");
    const versions = await transaction.document.findMany({
      where: {
        rootDocumentId: document.rootDocumentId,
        workspaceId: principal.workspaceId,
        deletedAt: null,
      },
      select: { id: true, retainUntil: true },
    });
    if (versions.some((version) => version.retainUntil && version.retainUntil > new Date())) {
      throw new Error("DOCUMENT_RETENTION_ACTIVE");
    }
    const deletedAt = new Date();
    await transaction.document.updateMany({
      where: {
        rootDocumentId: document.rootDocumentId,
        workspaceId: principal.workspaceId,
        deletedAt: null,
      },
      data: { status: DocumentStorageStatus.DELETED, deletedAt },
    });
    await transaction.documentAccessEvent.createMany({
      data: versions.map((version) => ({
        documentId: version.id,
        workspaceId: principal.workspaceId,
        actorUserId: principal.userId,
        action: "SOFT_DELETED",
      })),
    });
    return { rootDocumentId: document.rootDocumentId, deletedVersions: versions.length, deletedAt };
  });
}

export async function recordDocumentScanResult(input: {
  documentId: string;
  checksumSha256: string;
  result: "CLEAN" | "INFECTED" | "FAILED";
  scanner: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const document = await transaction.document.findFirst({
      where: { id: input.documentId, deletedAt: null },
      select: { id: true, workspaceId: true, rootDocumentId: true, previousVersionId: true, version: true, checksum: true },
    });
    if (!document) throw new Error("DOCUMENT_NOT_FOUND");

    const checksumMatches = document.checksum.toLowerCase() === input.checksumSha256.toLowerCase();
    const scanStatus = checksumMatches
      ? input.result === "CLEAN"
        ? DocumentScanStatus.CLEAN
        : input.result === "INFECTED"
          ? DocumentScanStatus.INFECTED
          : DocumentScanStatus.FAILED
      : DocumentScanStatus.FAILED;
    const status = scanStatus === DocumentScanStatus.CLEAN
      ? DocumentStorageStatus.AVAILABLE
      : scanStatus === DocumentScanStatus.INFECTED
        ? DocumentStorageStatus.INFECTED
        : DocumentStorageStatus.PENDING_SCAN;

    await transaction.document.update({
      where: { id: document.id },
      data: { scanStatus, status },
    });
    if (scanStatus === DocumentScanStatus.CLEAN && document.previousVersionId) {
      const root = await transaction.document.findFirst({
        where: { id: document.rootDocumentId },
        select: { latestVersion: true },
      });
      if (root?.latestVersion === document.version) {
        await transaction.document.updateMany({
          where: {
            id: document.previousVersionId,
            workspaceId: document.workspaceId,
            deletedAt: null,
          },
          data: { reviewStatus: DocumentReviewStatus.SUPERSEDED },
        });
      }
    }
    await transaction.documentAccessEvent.create({
      data: {
        documentId: document.id,
        workspaceId: document.workspaceId,
        action: "SCAN_RESULT",
        metadata: {
          scanner: input.scanner,
          result: scanStatus,
          checksumMatches,
        },
      },
    });
    return { id: document.id, status, scanStatus, checksumMatches };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
