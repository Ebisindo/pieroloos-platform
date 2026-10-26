import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  FirebaseStepUpError,
  verifyAndPrepareStepUp,
  hashStepUpHandle,
} from "@/lib/auth/firebase-step-up";

const HANDLE_LIFETIME_MS = 2 * 60 * 1000;

export const STEP_UP_OPERATIONS = [
  "continuity:create-successor",
  "continuity:owner-alive",
  "continuity:simulate",
  "continuity:revoke",
  "continuity:create-asset",
  "continuity:save-runbook",
] as const;

export type StepUpOperation = (typeof STEP_UP_OPERATIONS)[number];

const sessionFingerprint = (userId: string, sessionId: string) =>
  createHash("sha256").update(`${userId}\0${sessionId}`, "utf8").digest("hex");

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
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId || proof.identity.audience !== projectId) {
    throw new FirebaseStepUpError("NOT_CONFIGURED");
  }

  const expiresAt = new Date(Math.min(proof.expiresAt.getTime(), Date.now() + HANDLE_LIFETIME_MS));
  if (expiresAt.getTime() <= Date.now()) throw new FirebaseStepUpError("STALE_AUTHENTICATION");

  return prisma.$transaction(async (tx) => {
    const identity = await tx.firebaseIdentity.findUnique({
      where: { userId: input.userId },
      select: { projectId: true, firebaseUid: true },
    });
    if (
      !identity ||
      identity.projectId !== projectId ||
      identity.firebaseUid !== proof.identity.uid
    ) {
      throw new FirebaseStepUpError("INVALID_CHALLENGE");
    }

    const created = await tx.firebaseStepUpChallenge.create({
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

    await tx.platformAuditEvent.create({
      data: {
        actorUserId: input.userId,
        actorRole: "SUPER_ADMIN",
        action: "FIREBASE_STEP_UP_CHALLENGE_CREATED",
        subjectType: "FIREBASE_STEP_UP",
        subjectId: created.id,
        outcome: "SUCCESS",
        details: {
          operation: created.operation,
          firebaseProjectId: projectId,
          firebaseUid: proof.identity.uid,
          secondFactor: proof.identity.secondFactor,
          authTime: proof.identity.authTime,
          expiresAt: created.expiresAt.toISOString(),
        },
      },
    });

    return { handle: proof.handle, expiresAt: created.expiresAt.toISOString(), operation: created.operation };
  }, { isolationLevel: "Serializable" });
}

/**
 * One-time consumption. Must run inside the same Prisma transaction as the
 * protected domain mutation and its audit row. If any part fails, the caller
 * must let the transaction roll back, including this conditional update.
 */
export async function consumeFirebaseStepUpChallenge(
  tx: Prisma.TransactionClient,
  input: { userId: string; sessionId: string; operation: StepUpOperation; handle: string },
) {
  if (!input.userId || !input.sessionId || !isStepUpOperation(input.operation)) {
    throw new FirebaseStepUpError("INVALID_CHALLENGE");
  }
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw new FirebaseStepUpError("NOT_CONFIGURED");

  const identity = await tx.firebaseIdentity.findUnique({
    where: { userId: input.userId },
    select: { projectId: true, firebaseUid: true },
  });
  if (!identity || identity.projectId !== projectId) throw new FirebaseStepUpError("INVALID_CHALLENGE");

  const hash = hashStepUpHandle(input.handle);
  const consumedAt = new Date();
  const result = await tx.firebaseStepUpChallenge.updateMany({
    where: {
      userId: input.userId,
      firebaseUid: identity.firebaseUid,
      operation: input.operation,
      sessionHash: sessionFingerprint(input.userId, input.sessionId),
      handleHash: hash,
      consumedAt: null,
      expiresAt: { gt: consumedAt },
    },
    data: { consumedAt },
  });

  if (result.count !== 1) throw new FirebaseStepUpError("INVALID_CHALLENGE");

  await tx.platformAuditEvent.create({
    data: {
      actorUserId: input.userId,
      actorRole: "SUPER_ADMIN",
      action: "FIREBASE_STEP_UP_CHALLENGE_CONSUMED",
      subjectType: "FIREBASE_STEP_UP",
      outcome: "SUCCESS",
      details: { operation: input.operation, firebaseProjectId: projectId, firebaseUid: identity.firebaseUid, consumedAt: consumedAt.toISOString() },
    },
  });

  return { consumedAt };
}

export async function pruneExpiredFirebaseStepUpChallenges(now = new Date()) {
  return prisma.firebaseStepUpChallenge.deleteMany({
    where: {
      expiresAt: { lt: now },
      OR: [{ consumedAt: null }, { consumedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }],
    },
  });
}
