import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  transactionMock,
  settingsFindUniqueMock,
  documentFindFirstMock,
  documentCreateMock,
  documentUpdateMock,
  documentUpdateManyMock,
  documentFindManyMock,
  accessEventCreateMock,
  accessEventCreateManyMock,
  portalAuditCreateMock,
  storagePutMock,
  storageDeleteMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  settingsFindUniqueMock: vi.fn(),
  documentFindFirstMock: vi.fn(),
  documentCreateMock: vi.fn(),
  documentUpdateMock: vi.fn(),
  documentUpdateManyMock: vi.fn(),
  documentFindManyMock: vi.fn(),
  accessEventCreateMock: vi.fn(),
  accessEventCreateManyMock: vi.fn(),
  portalAuditCreateMock: vi.fn(),
  storagePutMock: vi.fn(),
  storageDeleteMock: vi.fn(),
}));

const tx = {
  document: {
    findFirst: documentFindFirstMock,
    findMany: documentFindManyMock,
    create: documentCreateMock,
    update: documentUpdateMock,
    updateMany: documentUpdateManyMock,
  },
  client: { findFirst: vi.fn() },
  engagement: { findFirst: vi.fn() },
  complianceObligation: { findFirst: vi.fn() },
  evidence: { findFirst: vi.fn() },
  workspaceSettings: { findUnique: settingsFindUniqueMock },
  documentAccessEvent: {
    create: accessEventCreateMock,
    createMany: accessEventCreateManyMock,
  },
  clientPortalAuditEvent: { create: portalAuditCreateMock },
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    document: { findFirst: documentFindFirstMock },
    workspaceSettings: { findUnique: settingsFindUniqueMock },
    $transaction: transactionMock,
  },
}));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: vi.fn(
    async (_principal: unknown, _permission: unknown, callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
  ),
}));
vi.mock("@/lib/auth/client-portal-access", () => ({
  withClientPortalGrantTransaction: vi.fn(
    async (_principal: unknown, _capability: unknown, callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
  ),
}));
vi.mock("@/lib/storage/s3-object-storage", () => ({
  getS3ObjectStorage: () => ({
    put: storagePutMock,
    delete: storageDeleteMock,
    createDownloadUrl: vi.fn(),
  }),
}));

import {
  createDocumentVersion,
  recordDocumentScanResult,
  softDeleteDocument,
  uploadClientPortalEvidence,
  uploadDocument,
} from "@/lib/services/document-storage-service";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["documents:write", "documents:read", "documents:delete"],
};

const bytes = new TextEncoder().encode("%PDF-1.7\ncontent");
const checksum = createHash("sha256").update(bytes).digest("hex");

describe("document storage lifecycle", () => {
  beforeEach(() => {
    documentFindFirstMock.mockReset();
    documentFindManyMock.mockReset();
    settingsFindUniqueMock.mockReset().mockResolvedValue({ documentRetentionDays: 365 });
    documentCreateMock.mockReset().mockImplementation(async ({ data }) => ({
      id: data.id,
      workspaceId: data.workspaceId,
      clientId: data.clientId,
      engagementId: data.engagementId,
      complianceObligationId: data.complianceObligationId,
      evidenceId: data.evidenceId,
      rootDocumentId: data.rootDocumentId,
      previousVersionId: data.previousVersionId,
      version: data.version,
      name: data.name,
      description: data.description,
      documentType: data.documentType,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      checksum: data.checksum,
      status: data.status,
      scanStatus: data.scanStatus,
      reviewStatus: data.reviewStatus,
      retainUntil: data.retainUntil,
      deletedAt: null,
      uploadedByUserId: data.uploadedByUserId,
      reviewedByUserId: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    documentUpdateMock.mockReset().mockResolvedValue({});
    documentUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    accessEventCreateMock.mockReset().mockResolvedValue({});
    accessEventCreateManyMock.mockReset().mockResolvedValue({ count: 1 });
    portalAuditCreateMock.mockReset().mockResolvedValue({});
    storagePutMock.mockReset().mockImplementation(async ({ key, body, contentType, checksumSha256 }) => ({
      key,
      sizeBytes: body.byteLength,
      contentType,
      checksumSha256,
    }));
    storageDeleteMock.mockReset().mockResolvedValue(undefined);
    transactionMock.mockReset().mockImplementation(async (callback) => callback(tx));
  });

  it("stores a tenant-keyed object and creates a quarantined, auditable record", async () => {
    const result = await uploadDocument({
      bytes,
      checksumSha256: checksum,
      filename: "proof.pdf",
      mimeType: "application/pdf",
      metadata: { documentType: "COMPLIANCE" },
    }, principal);

    expect(storagePutMock).toHaveBeenCalledWith(expect.objectContaining({
      key: expect.stringMatching(/^org-1\/workspace-1\/documents\/.+\/v1\/proof\.pdf$/),
      checksumSha256: Buffer.from(checksum, "hex").toString("base64"),
    }));
    expect(documentCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "PENDING_SCAN",
        scanStatus: "PENDING",
        checksum,
        uploadedByUserId: "user-1",
      }),
    }));
    expect(accessEventCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "UPLOADED", actorUserId: "user-1" }),
    }));
    expect(result).not.toHaveProperty("storageKey");
    expect(result.status).toBe("PENDING_SCAN");
  });

  it("forces portal uploads onto the granted client and audits them without exposing storage keys", async () => {
    const clientPrincipal = {
      userId: "client-user-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      clientId: "client-1",
      clientPortalGrantId: "portal-grant-1",
    };
    tx.client.findFirst.mockResolvedValueOnce({ id: "client-1" });
    const result = await uploadClientPortalEvidence({
      bytes,
      checksumSha256: checksum,
      filename: "proof.pdf",
      mimeType: "application/pdf",
      metadata: {
        clientId: "client-1",
        engagementId: "untrusted-engagement",
        complianceObligationId: "untrusted-obligation",
        evidenceId: "untrusted-evidence",
        documentType: "COMPLIANCE",
      },
    }, clientPrincipal);

    expect(documentCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        clientId: "client-1",
        engagementId: null,
        complianceObligationId: null,
        evidenceId: null,
        uploadedByUserId: "client-user-1",
      }),
    }));
    expect(portalAuditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        grantId: "portal-grant-1",
        clientId: "client-1",
        action: "EVIDENCE_UPLOADED",
      }),
    }));
    expect(result).not.toHaveProperty("storageKey");
  });

  it("rejects portal uploads that attempt to attach evidence to a different client", async () => {
    const clientPrincipal = {
      userId: "client-user-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      clientId: "client-1",
      clientPortalGrantId: "portal-grant-1",
    };

    await expect(uploadClientPortalEvidence({
      bytes,
      checksumSha256: checksum,
      filename: "proof.pdf",
      mimeType: "application/pdf",
      metadata: { clientId: "other-client", documentType: "OTHER" },
    }, clientPrincipal)).rejects.toThrow("CLIENT_PORTAL_CLIENT_MISMATCH");
    expect(storagePutMock).not.toHaveBeenCalled();
  });

  it("cleans up the stored object when metadata persistence fails", async () => {
    documentCreateMock.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(uploadDocument({
      bytes,
      checksumSha256: checksum,
      filename: "proof.pdf",
      mimeType: "application/pdf",
      metadata: { documentType: "COMPLIANCE" },
    }, principal)).rejects.toThrow("database unavailable");
    expect(storageDeleteMock).toHaveBeenCalledOnce();
  });

  it("creates the next immutable version only from the current clean version", async () => {
    documentFindFirstMock
      .mockResolvedValueOnce({
        id: "document-v1",
        version: 1,
        rootDocumentId: "document-v1",
        clientId: null,
        engagementId: null,
        complianceObligationId: null,
        evidenceId: null,
        name: "Evidence.pdf",
        description: null,
        documentType: "COMPLIANCE",
        status: "AVAILABLE",
        scanStatus: "CLEAN",
        rootDocument: { id: "document-v1", latestVersion: 1 },
      })
      .mockResolvedValueOnce({ id: "document-v1", latestVersion: 1 });

    await createDocumentVersion("document-v1", {
      bytes,
      checksumSha256: checksum,
      filename: "evidence-v2.pdf",
      mimeType: "application/pdf",
      metadata: { documentType: "OTHER" },
    }, principal);

    expect(documentUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "document-v1", workspaceId: "workspace-1", latestVersion: 1 },
      data: { latestVersion: 2 },
    }));
    expect(documentCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        rootDocumentId: "document-v1",
        previousVersionId: "document-v1",
        version: 2,
        latestVersion: 2,
        documentType: "COMPLIANCE",
      }),
    }));
  });

  it("rejects a stale version parent without storing bytes", async () => {
    documentFindFirstMock.mockResolvedValueOnce({
      id: "document-v1",
      version: 1,
      status: "AVAILABLE",
      scanStatus: "CLEAN",
      rootDocument: { id: "document-v1", latestVersion: 2 },
    });

    await expect(createDocumentVersion("document-v1", {
      bytes,
      checksumSha256: checksum,
      filename: "evidence-v2.pdf",
      mimeType: "application/pdf",
      metadata: { documentType: "OTHER" },
    }, principal)).rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
    expect(storagePutMock).not.toHaveBeenCalled();
  });

  it("blocks uploads before object storage when no retention policy is configured", async () => {
    settingsFindUniqueMock.mockResolvedValue({ documentRetentionDays: null });

    await expect(uploadDocument({
      bytes,
      checksumSha256: checksum,
      filename: "proof.pdf",
      mimeType: "application/pdf",
      metadata: { documentType: "COMPLIANCE" },
    }, principal)).rejects.toThrow("DOCUMENT_RETENTION_POLICY_REQUIRED");
    expect(storagePutMock).not.toHaveBeenCalled();
  });

  it("checks live workspace authorization before writing to object storage", async () => {
    vi.mocked(withAuthorizedWorkspaceTransaction).mockRejectedValueOnce(
      new Error("WORKSPACE_AUTHORIZATION_STALE"),
    );

    await expect(uploadDocument({
      bytes,
      checksumSha256: checksum,
      filename: "proof.pdf",
      mimeType: "application/pdf",
      metadata: { documentType: "COMPLIANCE" },
    }, principal)).rejects.toThrow("WORKSPACE_AUTHORIZATION_STALE");

    expect(storagePutMock).not.toHaveBeenCalled();
  });

  it("makes a version available only after a clean scan and supersedes its previous version", async () => {
    documentFindFirstMock
      .mockResolvedValueOnce({
        id: "document-v2",
        workspaceId: "workspace-1",
        rootDocumentId: "document-v1",
        previousVersionId: "document-v1",
        version: 2,
        checksum,
      })
      .mockResolvedValueOnce({ latestVersion: 2 });

    const result = await recordDocumentScanResult({
      documentId: "document-v2",
      checksumSha256: checksum,
      result: "CLEAN",
      scanner: "isolated-clamav",
    });

    expect(result).toMatchObject({ status: "AVAILABLE", scanStatus: "CLEAN", checksumMatches: true });
    expect(documentUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "document-v2" },
      data: { status: "AVAILABLE", scanStatus: "CLEAN" },
    }));
    expect(documentUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "document-v1", workspaceId: "workspace-1", deletedAt: null },
      data: { reviewStatus: "SUPERSEDED" },
    }));
  });

  it("fails closed when scanner and persisted checksums differ", async () => {
    documentFindFirstMock.mockResolvedValueOnce({
      id: "document-1",
      workspaceId: "workspace-1",
      rootDocumentId: "document-1",
      previousVersionId: null,
      version: 1,
      checksum,
    });

    const result = await recordDocumentScanResult({
      documentId: "document-1",
      checksumSha256: "0".repeat(64),
      result: "CLEAN",
      scanner: "isolated-clamav",
    });

    expect(result).toMatchObject({ status: "PENDING_SCAN", scanStatus: "FAILED", checksumMatches: false });
    expect(documentUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "PENDING_SCAN", scanStatus: "FAILED" },
    }));
  });

  it("enforces retention before soft deletion", async () => {
    documentFindFirstMock.mockResolvedValueOnce({
      id: "document-1",
      rootDocumentId: "document-1",
    });
    documentFindManyMock.mockResolvedValue([{ id: "document-1", retainUntil: new Date(Date.now() + 60_000) }]);

    await expect(softDeleteDocument("document-1", principal)).rejects.toThrow("DOCUMENT_RETENTION_ACTIVE");
    expect(documentUpdateManyMock).not.toHaveBeenCalled();
  });

  it("soft-deletes the entire expired version family and audits each version", async () => {
    documentFindFirstMock.mockResolvedValueOnce({
      id: "document-v2",
      rootDocumentId: "document-v1",
    });
    documentFindManyMock.mockResolvedValueOnce([
      { id: "document-v1", retainUntil: new Date(Date.now() - 60_000) },
      { id: "document-v2", retainUntil: null },
    ]);

    const result = await softDeleteDocument("document-v2", principal);

    expect(result).toMatchObject({ rootDocumentId: "document-v1", deletedVersions: 2 });
    expect(documentUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { rootDocumentId: "document-v1", workspaceId: "workspace-1", deletedAt: null },
      data: expect.objectContaining({ status: "DELETED" }),
    }));
    expect(accessEventCreateManyMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ documentId: "document-v1", action: "SOFT_DELETED" }),
        expect.objectContaining({ documentId: "document-v2", action: "SOFT_DELETED" }),
      ],
    });
  });
});
