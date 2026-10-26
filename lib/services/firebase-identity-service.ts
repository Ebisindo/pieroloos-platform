import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { FirebaseStepUpError, verifyFirebaseMfaIdToken } from "@/lib/auth/firebase-step-up";

export type FirebaseIdentityLinkErrorCode =
  | "NOT_CONFIGURED"
  | "SUPER_ADMIN_REQUIRED"
  | "ALREADY_LINKED"
  | "INVALID_FIREBASE_IDENTITY";

export class FirebaseIdentityLinkError extends Error {
  constructor(readonly code: FirebaseIdentityLinkErrorCode) {
    super(code);
    this.name = "FirebaseIdentityLinkError";
  }
}

export async function linkCurrentSuperAdminFirebaseIdentity(input: {
  userId: string;
  firebaseIdToken: string;
}) {
  if (!input.userId) throw new FirebaseIdentityLinkError("SUPER_ADMIN_REQUIRED");
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw new FirebaseIdentityLinkError("NOT_CONFIGURED");

  let proof;
  try {
    proof = await verifyFirebaseMfaIdToken(input.firebaseIdToken);
  } catch (error) {
    if (error instanceof FirebaseStepUpError) {
      if (error.code === "NOT_CONFIGURED") throw new FirebaseIdentityLinkError("NOT_CONFIGURED");
      throw new FirebaseIdentityLinkError("INVALID_FIREBASE_IDENTITY");
    }
    throw new FirebaseIdentityLinkError("INVALID_FIREBASE_IDENTITY");
  }
  if (proof.audience !== projectId) throw new FirebaseIdentityLinkError("INVALID_FIREBASE_IDENTITY");

  const identityId = randomUUID();
  const auditEventId = randomUUID();
  try {
    return await prisma.$transaction(async (tx) => {
      const currentSuperAdmin = await tx.platformSuperAdmin.findUnique({
        where: { id: "singleton" },
        select: { userId: true },
      });
      if (currentSuperAdmin?.userId !== input.userId) {
        throw new FirebaseIdentityLinkError("SUPER_ADMIN_REQUIRED");
      }

      const existing = await tx.firebaseIdentity.findUnique({
        where: { userId: input.userId },
        select: { projectId: true, firebaseUid: true },
      });
      if (existing) throw new FirebaseIdentityLinkError("ALREADY_LINKED");

      await tx.platformAuditEvent.create({
        data: {
          id: auditEventId,
          actorUserId: input.userId,
          actorRole: "SUPER_ADMIN",
          action: "FIREBASE_IDENTITY_LINKED",
          subjectType: "FIREBASE_IDENTITY",
          subjectId: identityId,
          outcome: "SUCCESS",
          details: {
            firebaseProjectId: projectId,
            firebaseUid: proof.uid,
            secondFactor: proof.secondFactor,
            authTime: proof.authTime,
          },
        },
      });

      const linked = await tx.firebaseIdentity.create({
        data: {
          id: identityId,
          userId: input.userId,
          projectId,
          firebaseUid: proof.uid,
          linkedByUserId: input.userId,
          auditEventId,
        },
        select: { id: true, projectId: true, firebaseUid: true, linkedAt: true, auditEventId: true },
      });

      return { ...linked, firebaseUid: linked.firebaseUid, projectId: linked.projectId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof FirebaseIdentityLinkError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new FirebaseIdentityLinkError("ALREADY_LINKED");
    }
    throw error;
  }
}
