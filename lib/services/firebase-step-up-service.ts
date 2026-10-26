import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import {
  FirebaseStepUpError,
  verifyAndPrepareStepUp,
  hashStepUpHandle,
} from "@/lib/auth/firebase-step-up";

const HANDLE_LIFETIME_MS = 2 * 60 * 1000;
const sessionFingerprint = (userId: string, sessionId: string) =>
  createHash("sha256").update(`${userId}\0${sessionId}`, "utf8").digest("hex");

export const STEP_UP_OPERATIONS = [
  "continuity:create-successor",
  "continuity:owner-alive",
  "continuity:simulate",
  "continuity:revoke",
  "continuity:create-asset",
  "continuity:save-runbook",
] as const;

export type StepUpOperation = (typeof STEP_UP_OPERATIONS)[number];

export function isStepUpOperation(value: unknown): value is StepUpOperation {
  return typeof value === "string" && STEP_UP_OPERATIONS.includes(value as StepUpOperation);
}

export async function createFirebaseStepUpChallenge(input: {
  userId: string;
  sessionId: string;
  operation: StepUpOperation;
  firebaseIdToken: string;
}) {
  if (!input.userId || !input.sessionId || !isStepUpOperation(input.operation)) {
    throw new FirebaseStepUpError("INVALID_CHALLENGE");
  }

  const proof = await verifyAndPrepareStepUp(input.firebaseIdToken);
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new FirebaseStepUpError("INVALID_CHALLENGE");

  // Never establish the local-account/Firebase relationship via email.
  // The configured Firebase UID must be explicitly mapped by an authorized operator.
  const allowedUid = process.env[`FIREBASE_UID_MAP_${input.userId}`]?.trim();
  if (!allowedUid || allowedUid !== proof.identity.uid) {
    throw new FirebaseStepUpError("INVALID_CHALLENGE");
  }

  const expiresAt = new Date(Math.min(proof.expiresAt.getTime(), Date.now() + HANDLE_LIFETIME_MS));
  if (expiresAt.getTime() <= Date.now()) throw new FirebaseStepUpError("STALE_AUTHENTICATION");

  const created = await prisma.firebaseStepUpChallenge.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      firebaseUid: proof.identity.uid,
      handleHash: proof.handleHash,
      operation: input.operation,
      sessionHash: sessionFingerprint(input.userId, input.sessionId),
      authTime: new Date(proof.identity.authTime * 1000),
      secondFactor: proof.identity.secondFactor,
      expiresAt,
    },
    select: { id: true, expiresAt: true, operation: true },
  });

  // Raw Firebase token is only locally hashed transiently and is not persisted or logged.
  return { handle: proof.handle, expiresAt: created.expiresAt.toISOString(), operation: created.operation };
}

/**
 * One-time consumption. Call this inside the same Prisma transaction as the
 * privileged domain mutation and its audit row. The caller must not commit a
 * challenge consumption in a separate transaction from the operation.
 */
export async function consumeFirebaseStepUpChallenge(
  tx: { firebaseStepUpChallenge: { updateMany(args: unknown): Promise<{ count: number }> } },
  input: { userId: string; sessionId: string; operation: StepUpOperation; handle: string },
) {
  if (!input.userId || !input.sessionId || !isStepUpOperation(input.operation)) {
    throw new FirebaseStepUpError("INVALID_CHALLENGE");
  }
  const hash = hashStepUpHandle(input.handle);
  const consumedAt = new Date();
  const result = await tx.firebaseStepUpChallenge.updateMany({
    where: {
      userId: input.userId,
      operation: input.operation,
      sessionHash: sessionFingerprint(input.userId, input.sessionId),
      handleHash: hash,
      consumedAt: null,
      expiresAt: { gt: consumedAt },
    },
    data: { consumedAt },
  } as never);

  if (result.count !== 1) throw new FirebaseStepUpError("INVALID_CHALLENGE");
  return { consumedAt };
}

export async function pruneExpiredFirebaseStepUpChallenges(now = new Date()) {
  return prisma.firebaseStepUpChallenge.deleteMany({
    where: { expiresAt: { lt: now }, OR: [{ consumedAt: null }, { consumedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }] },
  });
}
