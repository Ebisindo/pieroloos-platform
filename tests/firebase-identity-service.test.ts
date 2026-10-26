import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock, verifyMock } = vi.hoisted(() => {
  const tx = {
    platformSuperAdmin: { findUnique: vi.fn() },
    firebaseIdentity: { findUnique: vi.fn(), create: vi.fn() },
    platformAuditEvent: { create: vi.fn() },
  };
  return {
    txMock: tx,
    prismaMock: { $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)) },
    verifyMock: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/firebase-step-up", () => ({
  FirebaseStepUpError: class FirebaseStepUpError extends Error { constructor(public code: string) { super(code); } },
  verifyFirebaseMfaIdToken: verifyMock,
}));

import { linkCurrentSuperAdminFirebaseIdentity, FirebaseIdentityLinkError } from "@/lib/services/firebase-identity-service";

describe("Firebase identity linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIREBASE_PROJECT_ID = "pieroloos-platform";
    txMock.platformSuperAdmin.findUnique.mockResolvedValue({ userId: "local-superadmin" });
    txMock.firebaseIdentity.findUnique.mockResolvedValue(null);
    txMock.platformAuditEvent.create.mockResolvedValue({ id: "audit-1" });
    txMock.firebaseIdentity.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data, linkedAt: new Date("2026-01-01T00:00:00.000Z"),
    }));
    verifyMock.mockResolvedValue({
      uid: "firebase-uid-1", audience: "pieroloos-platform",
      authTime: 1_800_000_000, secondFactor: "phone",
    });
  });

  it("links only the current SuperAdmin and writes the audit event in the transaction", async () => {
    const result = await linkCurrentSuperAdminFirebaseIdentity({
      userId: "local-superadmin", firebaseIdToken: "valid-mfa-token",
    });
    expect(result.firebaseUid).toBe("firebase-uid-1");
    expect(txMock.platformAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "FIREBASE_IDENTITY_LINKED",
        actorUserId: "local-superadmin",
        subjectType: "FIREBASE_IDENTITY",
        outcome: "SUCCESS",
      }),
    }));
    expect(txMock.firebaseIdentity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "local-superadmin", firebaseUid: "firebase-uid-1",
        linkedByUserId: "local-superadmin", auditEventId: "audit-1",
      }),
    }));
  });

  it("refuses to replace an existing identity", async () => {
    txMock.firebaseIdentity.findUnique.mockResolvedValue({ projectId: "pieroloos-platform", firebaseUid: "different-uid" });
    await expect(linkCurrentSuperAdminFirebaseIdentity({
      userId: "local-superadmin", firebaseIdToken: "valid-mfa-token",
    })).rejects.toMatchObject({ code: "ALREADY_LINKED" });
    expect(txMock.firebaseIdentity.create).not.toHaveBeenCalled();
  });

  it("refuses non-SuperAdmin callers", async () => {
    txMock.platformSuperAdmin.findUnique.mockResolvedValue({ userId: "another-user" });
    await expect(linkCurrentSuperAdminFirebaseIdentity({
      userId: "local-superadmin", firebaseIdToken: "valid-mfa-token",
    })).rejects.toThrow(FirebaseIdentityLinkError);
    expect(txMock.firebaseIdentity.create).not.toHaveBeenCalled();
  });

  it("refuses provider project mismatch", async () => {
    verifyMock.mockResolvedValue({ uid: "firebase-uid-1", audience: "wrong-project", authTime: 1_800_000_000, secondFactor: "phone" });
    await expect(linkCurrentSuperAdminFirebaseIdentity({
      userId: "local-superadmin", firebaseIdToken: "valid-mfa-token",
    })).rejects.toMatchObject({ code: "INVALID_FIREBASE_IDENTITY" });
    expect(txMock.firebaseIdentity.create).not.toHaveBeenCalled();
  });
});
