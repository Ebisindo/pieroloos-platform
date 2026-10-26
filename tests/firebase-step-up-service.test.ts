import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txMock, verifyMock, hashMock } = vi.hoisted(() => {
  const tx = {
    firebaseIdentity: { findUnique: vi.fn() },
    firebaseStepUpChallenge: { create: vi.fn(), updateMany: vi.fn() },
    platformAuditEvent: { create: vi.fn() },
  };
  return {
    txMock: tx,
    prismaMock: {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
      firebaseStepUpChallenge: { deleteMany: vi.fn() },
    },
    verifyMock: vi.fn(),
    hashMock: vi.fn(),
  };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/firebase-step-up", () => ({
  FirebaseStepUpError: class FirebaseStepUpError extends Error { constructor(public code: string) { super(code); } },
  verifyAndPrepareStepUp: verifyMock,
  hashStepUpHandle: hashMock,
}));

import { createFirebaseStepUpChallenge, consumeFirebaseStepUpChallenge } from "@/lib/services/firebase-step-up-service";

describe("Firebase step-up challenge service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIREBASE_PROJECT_ID = "pieroloos-platform";
    process.env.NEXTAUTH_SECRET = "test-only-secret";
    txMock.firebaseIdentity.findUnique.mockResolvedValue({ projectId: "pieroloos-platform", firebaseUid: "firebase-uid" });
    txMock.firebaseStepUpChallenge.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: data.id, expiresAt: data.expiresAt, operation: data.operation,
    }));
    txMock.firebaseStepUpChallenge.updateMany.mockResolvedValue({ count: 1 });
    verifyMock.mockResolvedValue({
      identity: {
        uid: "firebase-uid", authTime: Math.floor(Date.now() / 1000),
        issuedAt: Math.floor(Date.now() / 1000), expiresAt: Math.floor(Date.now() / 1000) + 3600,
        secondFactor: "phone", issuer: "https://securetoken.google.com/pieroloos-platform",
        audience: "pieroloos-platform",
      },
      handle: "a".repeat(43),
      handleHash: "d".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
    });
    hashMock.mockReturnValue("d".repeat(64));
  });

  it("persists only a handle digest and binds local user, UID, operation and session", async () => {
    const result = await createFirebaseStepUpChallenge({
      userId: "local-user", sessionId: "signed-session-binding",
      operation: "continuity:owner-alive", firebaseIdToken: "x".repeat(200),
    });
    expect(result.handle).toBe("a".repeat(43));
    expect(txMock.firebaseStepUpChallenge.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "local-user", firebaseUid: "firebase-uid",
        operation: "continuity:owner-alive", handleHash: "d".repeat(64),
        sessionHash: expect.any(String),
      }),
    }));
    expect(JSON.stringify(txMock.firebaseStepUpChallenge.create.mock.calls)).not.toContain("x".repeat(200));
    expect(txMock.platformAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "FIREBASE_STEP_UP_CHALLENGE_CREATED", outcome: "SUCCESS" }),
    }));
  });

  it("rejects missing database UID binding instead of matching by email", async () => {
    txMock.firebaseIdentity.findUnique.mockResolvedValue(null);
    await expect(createFirebaseStepUpChallenge({
      userId: "local-user", sessionId: "signed-session-binding",
      operation: "continuity:owner-alive", firebaseIdToken: "x".repeat(200),
    })).rejects.toThrow();
    expect(txMock.firebaseStepUpChallenge.create).not.toHaveBeenCalled();
  });

  it("rejects UID mismatch", async () => {
    txMock.firebaseIdentity.findUnique.mockResolvedValue({ projectId: "pieroloos-platform", firebaseUid: "different-uid" });
    await expect(createFirebaseStepUpChallenge({
      userId: "local-user", sessionId: "signed-session-binding",
      operation: "continuity:owner-alive", firebaseIdToken: "x".repeat(200),
    })).rejects.toThrow();
    expect(txMock.firebaseStepUpChallenge.create).not.toHaveBeenCalled();
  });

  it("rejects unsupported operation names", async () => {
    await expect(createFirebaseStepUpChallenge({
      userId: "local-user", sessionId: "signed-session-binding",
      operation: "continuity:transfer-ownership" as never, firebaseIdToken: "x".repeat(200),
    })).rejects.toThrow();
  });

  it("consumes once using matching user, UID, operation, session and unexpired handle", async () => {
    const first = await consumeFirebaseStepUpChallenge(txMock as never, {
      userId: "local-user", sessionId: "session-a",
      operation: "continuity:owner-alive", handle: "a".repeat(43),
    });
    expect(first.consumedAt).toBeInstanceOf(Date);
    expect(txMock.firebaseStepUpChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: "local-user", firebaseUid: "firebase-uid", operation: "continuity:owner-alive",
        sessionHash: expect.any(String), handleHash: "d".repeat(64), consumedAt: null,
        expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
      }),
    }));
    expect(txMock.platformAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "FIREBASE_STEP_UP_CHALLENGE_CONSUMED", outcome: "SUCCESS" }),
    }));

    txMock.firebaseStepUpChallenge.updateMany.mockResolvedValue({ count: 0 });
    await expect(consumeFirebaseStepUpChallenge(txMock as never, {
      userId: "local-user", sessionId: "session-a",
      operation: "continuity:owner-alive", handle: "a".repeat(43),
    })).rejects.toThrow();
  });

  it("fails closed on database outages or concurrent replay", async () => {
    txMock.firebaseStepUpChallenge.updateMany.mockRejectedValueOnce(new Error("db down"));
    await expect(consumeFirebaseStepUpChallenge(txMock as never, {
      userId: "local-user", sessionId: "session-a",
      operation: "continuity:owner-alive", handle: "a".repeat(43),
    })).rejects.toThrow("db down");
    txMock.firebaseStepUpChallenge.updateMany.mockResolvedValue({ count: 0 });
    await expect(consumeFirebaseStepUpChallenge(txMock as never, {
      userId: "local-user", sessionId: "session-a",
      operation: "continuity:owner-alive", handle: "a".repeat(43),
    })).rejects.toThrow();
  });
});
