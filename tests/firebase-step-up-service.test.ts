import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, verifyMock, hashMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn() }, firebaseStepUpChallenge: { create: vi.fn(), deleteMany: vi.fn() } },
  verifyMock: vi.fn(),
  hashMock: vi.fn(),
}));
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
    prismaMock.user.findUnique.mockResolvedValue({ id: "local-user" });
    prismaMock.firebaseStepUpChallenge.create.mockImplementation(async ({ data }) => ({
      id: data.id, expiresAt: data.expiresAt, operation: data.operation,
    }));
    verifyMock.mockResolvedValue({
      identity: { uid: "firebase-uid", authTime: Math.floor(Date.now() / 1000), secondFactor: "phone" },
      handle: "a".repeat(43),
      handleHash: "d".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: "e".repeat(64),
    });
    hashMock.mockReturnValue("d".repeat(64));
    process.env.FIREBASE_UID_MAP_local-user = "firebase-uid";
  });

  it("persists only the handle digest and binds a user, operation and session fingerprint", async () => {
    const result = await createFirebaseStepUpChallenge({
      userId: "local-user", sessionId: "signed-session-binding",
      operation: "continuity:owner-alive", firebaseIdToken: "x".repeat(200),
    });
    expect(result.handle).toBe("a".repeat(43));
    expect(prismaMock.firebaseStepUpChallenge.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "local-user", firebaseUid: "firebase-uid",
        operation: "continuity:owner-alive", handleHash: "d".repeat(64),
        sessionHash: expect.any(String), consumedAt: undefined,
      }),
    }));
    expect(JSON.stringify(prismaMock.firebaseStepUpChallenge.create.mock.calls)).not.toContain("x".repeat(200));
  });

  it("rejects UID mismatch instead of matching by email", async () => {
    process.env.FIREBASE_UID_MAP_local-user = "different-uid";
    await expect(createFirebaseStepUpChallenge({
      userId: "local-user", sessionId: "signed-session-binding",
      operation: "continuity:owner-alive", firebaseIdToken: "x".repeat(200),
    })).rejects.toThrow();
    expect(prismaMock.firebaseStepUpChallenge.create).not.toHaveBeenCalled();
  });

  it("rejects unsupported operation names", async () => {
    await expect(createFirebaseStepUpChallenge({
      userId: "local-user", sessionId: "signed-session-binding",
      operation: "continuity:transfer-ownership" as never, firebaseIdToken: "x".repeat(200),
    })).rejects.toThrow();
  });

  it("atomically consumes only once using the matching session and operation", async () => {
    const tx = { firebaseStepUpChallenge: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    const first = await consumeFirebaseStepUpChallenge(tx, {
      userId: "local-user", sessionId: "session-a",
      operation: "continuity:owner-alive", handle: "a".repeat(43),
    });
    expect(first.consumedAt).toBeInstanceOf(Date);
    expect(tx.firebaseStepUpChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: "local-user", operation: "continuity:owner-alive",
        sessionHash: expect.any(String), handleHash: "d".repeat(64), consumedAt: null,
        expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
      }),
    }));

    tx.firebaseStepUpChallenge.updateMany.mockResolvedValue({ count: 0 });
    await expect(consumeFirebaseStepUpChallenge(tx, {
      userId: "local-user", sessionId: "session-a",
      operation: "continuity:owner-alive", handle: "a".repeat(43),
    })).rejects.toThrow();
  });

  it("fails when database consumption fails or races to zero rows", async () => {
    const tx = { firebaseStepUpChallenge: { updateMany: vi.fn().mockRejectedValue(new Error("db down")) } };
    await expect(consumeFirebaseStepUpChallenge(tx, {
      userId: "local-user", sessionId: "session-a",
      operation: "continuity:owner-alive", handle: "a".repeat(43),
    })).rejects.toThrow("db down");
    tx.firebaseStepUpChallenge.updateMany.mockResolvedValue({ count: 0 });
    await expect(consumeFirebaseStepUpChallenge(tx, {
      userId: "local-user", sessionId: "session-a",
      operation: "continuity:owner-alive", handle: "a".repeat(43),
    })).rejects.toThrow();
  });
});
