import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  FirebaseStepUpError,
  createOpaqueStepUpHandle,
  hashStepUpHandle,
  verifyFirebaseMfaIdToken,
} from "@/lib/auth/firebase-step-up";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const sessionFingerprint = (userId: string, sessionId: string) =>
  createHash("sha256").update(`${userId}\0${sessionId}`, "utf8").digest("hex");
const tokenFingerprint = (idToken: string) =>
  createHash("sha256").update(idToken, "utf8").digest("hex");

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

function validateContext(input: { userId: string; sessionId: string; operation: unknown }): asserts input is {
  userId: string; sessionId: string; operation: StepUpOperation;
} {
  if (!input.userId || !input.sessionId || !isStepUpOperation(input.operation)) {
    throw new FirebaseStepUpError("INVALID_CHALLENGE");
  }
}

/**
 * Begin the server challenge BEFORE the user performs Firebase reauthentication.
 * The opaque nonce is stored only as a hash and cannot authorize anything until
 * a fresh MFA token with auth_time strictly after this challenge is verified.
 */
export async function beginFirebaseStepUpChallenge(input: {
  userId: string;
  sessionId: string;
  operation: StepUpOperation;
}) {
  validateContext(input);
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true },
  });
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!user || !projectId) throw new FirebaseStepUpError("INVALID_CHALLENGE");
  const identity = await prisma.firebaseIdentity.findUnique({
    where: { userId_projectId: { userId: input.userId, projectId } },
    select: { id: true, firebaseUid: true },
  });
  if (!identity) throw new FirebaseStepUpError("INVALID_CHALLENGE");

  const { handle, handleHash } = createOpaqueStepUpHandle();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  const sessionHash = sessionFingerprint(input.userId, input.sessionId);

  await prisma.$transaction(async (tx) => {
    // Permit only one outstanding operation per user/session. Starting a new
    // attempt invalidates pending and verified-but-unused handles from prior attempts.
    await tx.firebaseStepUpChallenge.updateMany({
      where: {
        userId: input.userId,
        sessionHash,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    await tx.firebaseStepUpChallenge.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        firebaseUid: identity.firebaseUid,
        firebaseIdentityId: identity.id,
        handleHash,
        operation: input.operation,
        sessionHash,
        authTime: null,
        secondFactor: null,
        proofHash: null,
        verifiedAt: null,
        expiresAt,
      },
      select: { id: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return { challengeNonce: handle, expiresAt: expiresAt.toISOString(), operation: input.operation };
}

/**
 * Completes a pre-issued challenge after Firebase MFA sign-in.
 * Firebase auth_time must be strictly after challenge creation (seconds precision).
 * The ID-token fingerprint is unique, preventing the same token from completing
 * multiple challenges. All claims come from verified Admin SDK output, never client booleans.
 */
export async function completeFirebaseStepUpChallenge(input: {
  userId: string;
  sessionId: string;
  operation: StepUpOperation;
  challengeNonce: string;
  firebaseIdToken: string;
}) {
  validateContext(input);
  const identity = await verifyFirebaseMfaIdToken(input.firebaseIdToken);
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true },
  });
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!user || !projectId) throw new FirebaseStepUpError("INVALID_CHALLENGE");
  const firebaseIdentity = await prisma.firebaseIdentity.findUnique({
    where: { userId_projectId: { userId: input.userId, projectId } },
    select: { id: true, firebaseUid: true, projectId: true },
  });
  if (!firebaseIdentity || firebaseIdentity.firebaseUid !== identity.uid || firebaseIdentity.projectId !== identity.audience) {
    throw new FirebaseStepUpError("INVALID_CHALLENGE");
  }

  const handleHash = hashStepUpHandle(input.challengeNonce);
  const proofHash = tokenFingerprint(input.firebaseIdToken);
  const now = new Date();
  const sessionHash = sessionFingerprint(input.userId, input.sessionId);
  const authTime = new Date(identity.authTime * 1000);

  try {
    const expiresAt = await prisma.$transaction(async (tx) => {
      const challenge = await tx.firebaseStepUpChallenge.findFirst({
        where: {
          userId: input.userId,
          firebaseUid: identity.uid,
          firebaseIdentityId: firebaseIdentity.id,
          operation: input.operation,
          sessionHash,
          handleHash,
          proofHash: null,
          verifiedAt: null,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true, createdAt: true, expiresAt: true },
      });
      if (!challenge || identity.authTime <= Math.floor(challenge.createdAt.getTime() / 1000)) {
        throw new FirebaseStepUpError("INVALID_CHALLENGE");
      }

      const updated = await tx.firebaseStepUpChallenge.updateMany({
        where: {
          id: challenge.id,
          userId: input.userId,
          firebaseIdentityId: firebaseIdentity.id,
          operation: input.operation,
          sessionHash,
          handleHash,
          proofHash: null,
          verifiedAt: null,
          consumedAt: null,
          expiresAt: { gt: now },
          createdAt: challenge.createdAt,
        },
        data: {
          authTime,
          secondFactor: identity.secondFactor,
          proofHash,
          verifiedAt: now,
        },
      });
      if (updated.count !== 1) throw new FirebaseStepUpError("INVALID_CHALLENGE");
      return challenge.expiresAt;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { handle: input.challengeNonce, expiresAt: expiresAt.toISOString(), operation: input.operation };
  } catch (error) {
    if (error instanceof FirebaseStepUpError) throw error;
    if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002") {
      throw new FirebaseStepUpError("INVALID_CHALLENGE");
    }
    throw error;
  }
}

type ChallengeConsumeClient = {
  firebaseStepUpChallenge: {
    updateMany(args: Prisma.FirebaseStepUpChallengeUpdateManyArgs): Promise<Prisma.BatchPayload>;
  };
};

/**
 * Consume the completed challenge inside the same Prisma transaction as the
 * protected domain mutation and audit insert. Any failure must throw so Prisma
 * rolls the complete transaction back; never call this in a separate transaction.
 */
export async function consumeFirebaseStepUpChallenge(
  tx: ChallengeConsumeClient,
  input: { userId: string; sessionId: string; operation: StepUpOperation; handle: string },
) {
  validateContext(input);
  const hash = hashStepUpHandle(input.handle);
  const consumedAt = new Date();
  const result = await tx.firebaseStepUpChallenge.updateMany({
    where: {
      userId: input.userId,
      operation: input.operation,
      sessionHash: sessionFingerprint(input.userId, input.sessionId),
      handleHash: hash,
      proofHash: { not: null },
      verifiedAt: { not: null },
      consumedAt: null,
      expiresAt: { gt: consumedAt },
    },
    data: { consumedAt },
  });
  if (result.count !== 1) throw new FirebaseStepUpError("INVALID_CHALLENGE");
  return { consumedAt };
}

export async function pruneExpiredFirebaseStepUpChallenges(now = new Date()) {
  return prisma.firebaseStepUpChallenge.deleteMany({
    where: {
      expiresAt: { lt: now },
      OR: [
        { consumedAt: null },
        { consumedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });
}

export const FIREBASE_STEP_UP_CHALLENGE_TTL_SECONDS = CHALLENGE_TTL_MS / 1000;
