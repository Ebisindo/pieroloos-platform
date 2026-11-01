import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));

const { prismaMock, verifyMock, hashMock, randomHandleMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    firebaseIdentity: { findUnique: vi.fn() },
    firebaseStepUpChallenge: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  verifyMock: vi.fn(),
  hashMock: vi.fn(),
  randomHandleMock: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/firebase-step-up", () => ({
  FirebaseStepUpError: class FirebaseStepUpError extends Error {
    constructor(public code: string) { super(code); this.name = "FirebaseStepUpError"; }
  },
  verifyFirebaseMfaIdToken: verifyMock,
  hashStepUpHandle: hashMock,
  createOpaqueStepUpHandle: randomHandleMock,
}));

import {
  beginFirebaseStepUpChallenge,
  completeFirebaseStepUpChallenge,
  consumeFirebaseStepUpChallenge,
} from "@/lib/services/firebase-step-up-service";

const nowSeconds = () => Math.floor(Date.now() / 1000);
const token = "fake-token-value-only-for-unit-test".repeat(6);
const nonce = "a".repeat(43);
const handleHash = "d".repeat(64);
const uid = "firebase-uid";
const userId = "local-user";
const sessionId = "server-issued-session-binding";
const operation = "continuity:owner-alive" as const;
const originalStepUpEnabled = process.env.FIREBASE_STEP_UP_ENABLED;

const txMock = {
  firebaseStepUpChallenge: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
  },
};

describe("Firebase step-up challenge service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIREBASE_PROJECT_ID = "pieroloos-platform";
    process.env.FIREBASE_STEP_UP_ENABLED = "true";
    prismaMock.user.findUnique.mockResolvedValue({ id: userId });
    prismaMock.firebaseIdentity.findUnique.mockResolvedValue({ id: "firebase-identity-1", firebaseUid: uid, projectId: "pieroloos-platform" });
    prismaMock.$transaction.mockImplementation(async (work) => work(txMock));
    txMock.firebaseStepUpChallenge.create.mockResolvedValue({ id: "challenge-1" });
    txMock.firebaseStepUpChallenge.updateMany.mockResolvedValue({ count: 1 });
    txMock.firebaseStepUpChallenge.findFirst.mockResolvedValue({
      id: "challenge-1",
      createdAt: new Date((nowSeconds() - 3) * 1000),
      expiresAt: new Date(Date.now() + 60_000),
    });
    prismaMock.firebaseStepUpChallenge.findFirst.mockResolvedValue({
      id: "challenge-1",
      createdAt: new Date((nowSeconds() - 3) * 1000),
      expiresAt: new Date(Date.now() + 60_000),
    });
    randomHandleMock.mockReturnValue({ handle: nonce, handleHash });
    hashMock.mockReturnValue(handleHash);
    verifyMock.mockResolvedValue({
      uid,
      authTime: nowSeconds(),
      issuedAt: nowSeconds(),
      expiresAt: nowSeconds() + 3600,
      secondFactor: "phone",
      issuer: "https://securetoken.google.com/pieroloos-platform",
      audience: "pieroloos-platform",
    });
  });

  afterEach(() => {
    if (originalStepUpEnabled === undefined) delete process.env.FIREBASE_STEP_UP_ENABLED;
    else process.env.FIREBASE_STEP_UP_ENABLED = originalStepUpEnabled;
  });

  it("fails closed by default when the explicit environment opt-in is absent", async () => {
    delete process.env.FIREBASE_STEP_UP_ENABLED;
    const tx = { firebaseStepUpChallenge: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };

    await expect(beginFirebaseStepUpChallenge({ userId, sessionId, operation }))
      .rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    await expect(completeFirebaseStepUpChallenge({
      userId, sessionId, operation, challengeNonce: nonce, firebaseIdToken: token,
    })).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    await expect(consumeFirebaseStepUpChallenge(tx, { userId, sessionId, operation, handle: nonce }))
      .rejects.toMatchObject({ code: "NOT_CONFIGURED" });

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.firebaseIdentity.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(verifyMock).not.toHaveBeenCalled();
    expect(tx.firebaseStepUpChallenge.updateMany).not.toHaveBeenCalled();
  });

  it("begins a challenge before Firebase reauthentication and stores only the nonce digest", async () => {
    const result = await beginFirebaseStepUpChallenge({ userId, sessionId, operation });
    expect(result).toEqual(expect.objectContaining({ challengeNonce: nonce, operation }));
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(txMock.firebaseStepUpChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId, consumedAt: null }),
      data: expect.objectContaining({ consumedAt: expect.any(Date) }),
    }));
    expect(txMock.firebaseStepUpChallenge.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId, firebaseUid: uid, operation, handleHash,
        sessionHash: expect.any(String),
        authTime: null, secondFactor: null, proofHash: null, verifiedAt: null,
        expiresAt: expect.any(Date),
      }),
    }));
    expect(JSON.stringify(txMock.firebaseStepUpChallenge.create.mock.calls)).not.toContain(nonce);
  });

  it("refuses to create a challenge without a durable Firebase identity mapping", async () => {
    prismaMock.firebaseIdentity.findUnique.mockResolvedValue(null);
    await expect(beginFirebaseStepUpChallenge({ userId, sessionId, operation })).rejects.toThrow();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("completes only an MFA authentication newer than the challenge creation timestamp", async () => {
    const result = await completeFirebaseStepUpChallenge({
      userId, sessionId, operation, challengeNonce: nonce, firebaseIdToken: token,
    });
    expect(result).toEqual(expect.objectContaining({ handle: nonce, operation }));
    expect(verifyMock).toHaveBeenCalledWith(token);
    expect(txMock.firebaseStepUpChallenge.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId, operation, handleHash, proofHash: null, verifiedAt: null,
        consumedAt: null, expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
      }),
      data: expect.objectContaining({
        authTime: expect.any(Date), secondFactor: "phone",
        proofHash: createHash("sha256").update(token).digest("hex"),
        verifiedAt: expect.any(Date),
      }),
    }));
    expect(JSON.stringify(txMock.firebaseStepUpChallenge.updateMany.mock.calls)).not.toContain(token);
  });

  it("rejects an authentication that predates the challenge", async () => {
    txMock.firebaseStepUpChallenge.findFirst.mockResolvedValue({
      id: "challenge-1",
      createdAt: new Date((nowSeconds() + 5) * 1000),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(completeFirebaseStepUpChallenge({
      userId, sessionId, operation, challengeNonce: nonce, firebaseIdToken: token,
    })).rejects.toThrow();
    expect(txMock.firebaseStepUpChallenge.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a missing or expired challenge", async () => {
    txMock.firebaseStepUpChallenge.findFirst.mockResolvedValue(null);
    await expect(completeFirebaseStepUpChallenge({
      userId, sessionId, operation, challengeNonce: nonce, firebaseIdToken: token,
    })).rejects.toThrow();
  });

  it("rejects a token fingerprint already used by another challenge", async () => {
    txMock.firebaseStepUpChallenge.updateMany.mockRejectedValue({ code: "P2002" });
    await expect(completeFirebaseStepUpChallenge({
      userId, sessionId, operation, challengeNonce: nonce, firebaseIdToken: token,
    })).rejects.toThrow();
  });

  it("rejects Firebase UID mismatches instead of matching by email", async () => {
    verifyMock.mockResolvedValue({
      uid: "different-uid", authTime: nowSeconds(), issuedAt: nowSeconds(), expiresAt: nowSeconds() + 3600,
      secondFactor: "phone", issuer: "https://securetoken.google.com/pieroloos-platform", audience: "pieroloos-platform",
    });
    await expect(completeFirebaseStepUpChallenge({
      userId, sessionId, operation, challengeNonce: nonce, firebaseIdToken: token,
    })).rejects.toThrow();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("consumes a completed handle atomically for the exact user, session and operation", async () => {
    const tx = { firebaseStepUpChallenge: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    const result = await consumeFirebaseStepUpChallenge(tx, { userId, sessionId, operation, handle: nonce });
    expect(result.consumedAt).toBeInstanceOf(Date);
    expect(tx.firebaseStepUpChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId, operation, handleHash, proofHash: { not: null }, verifiedAt: { not: null },
        consumedAt: null, sessionHash: expect.any(String), expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
      }),
    }));
    tx.firebaseStepUpChallenge.updateMany.mockResolvedValue({ count: 0 });
    await expect(consumeFirebaseStepUpChallenge(tx, { userId, sessionId, operation, handle: nonce })).rejects.toThrow();
  });

  it("fails closed when handle consumption errors or races to zero rows", async () => {
    const tx = { firebaseStepUpChallenge: { updateMany: vi.fn().mockRejectedValue(new Error("db down")) } };
    await expect(consumeFirebaseStepUpChallenge(tx, { userId, sessionId, operation, handle: nonce })).rejects.toThrow("db down");
    tx.firebaseStepUpChallenge.updateMany.mockResolvedValue({ count: 0 });
    await expect(consumeFirebaseStepUpChallenge(tx, { userId, sessionId, operation, handle: nonce })).rejects.toThrow();
  });
});
