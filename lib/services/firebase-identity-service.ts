import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { FirebaseStepUpError, verifyFirebaseMfaIdToken } from "@/lib/auth/firebase-step-up";

export class FirebaseIdentityLinkError extends Error {
  constructor(readonly code: "NOT_SUPER_ADMIN" | "ALREADY_LINKED" | "INVALID_FIREBASE_IDENTITY" | "AUDIT_FAILED") {
    super(code);
    this.name = "FirebaseIdentityLinkError";
  }
}

/**
 * Link the current platform SuperAdmin's Firebase identity once, after a
 * revocation-checked, recent Firebase MFA token has been verified server-side.
 * The identity row and the audit record are written atomically.
 *
 * This helper deliberately does not accept a Firebase UID from the caller;
 * the UID/project are derived from the verified token and server configuration.
 */
export async function linkCurrentSuperAdminFirebaseIdentity(input: {
  userId: string;
  firebaseIdToken: string;
}) {
  if (!input.userId || input.userId.length > 256 || !input.firebaseIdToken) {
    throw new FirebaseIdentityLinkError("INVALID_FIREBASE_IDENTITY");
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw new FirebaseIdentityLinkError("INVALID_FIREBASE_IDENTITY");

  let identity;
  try {
    identity = await verifyFirebaseMfaIdToken(input.firebaseIdToken);
  } catch {
    throw new FirebaseIdentityLinkError("INVALID_FIREBASE_IDENTITY");
  }

  if (
    identity.audience !== projectId ||
    !identity.uid ||
    !identity.secondFactor ||
    !Number.isSafeInteger(identity.authTime) ||
    identity.authTime <= 0
  ) {
    throw new FirebaseIdentityLinkError("INVALID_FIREBASE_IDENTITY");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const superAdmin = await tx.platformSuperAdmin.findUnique({
        where: { id: "singleton" },
        select: { userId: true },
      });
      if (!superAdmin || superAdmin.userId !== input.userId) {
        throw new FirebaseIdentityLinkError("NOT_SUPER_ADMIN");
      }

      const existingForUser = await tx.firebaseIdentity.findUnique({
        where: { userId_projectId: { userId: input.userId, projectId } },
        select: { id: true },
      });
      if (existingForUser) throw new FirebaseIdentityLinkError("ALREADY_LINKED");

      const existingForProvider = await tx.firebaseIdentity.findUnique({
        where: { projectId_firebaseUid: { projectId, firebaseUid: identity.uid } },
        select: { id: true },
      });
      if (existingForProvider) throw new FirebaseIdentityLinkError("ALREADY_LINKED");

      const audit = await tx.platformAuditEvent.create({
        data: {
          actorUserId: input.userId,
          actorRole: "SUPER_ADMIN",
          action: "FIREBASE_IDENTITY_LINKED",
          subjectType: "FIREBASE_IDENTITY",
          subjectId: identity.uid,
          outcome: "SUCCESS",
          details: {
            projectId,
            firebaseUid: identity.uid,
            secondFactor: identity.secondFactor,
            authTime: identity.authTime,
            issuer: identity.issuer,
            audience: identity.audience,
          } satisfies Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      if (!audit?.id) throw new FirebaseIdentityLinkError("AUDIT_FAILED");

      const linked = await tx.firebaseIdentity.create({
        data: {
          userId: input.userId,
          projectId,
          firebaseUid: identity.uid,
          linkedByUserId: input.userId,
          auditEventId: audit.id,
        },
        select: { id: true, userId: true, projectId: true, firebaseUid: true, linkedAt: true },
      });

      return { firebaseIdentityId: linked.id, firebaseUid: linked.firebaseUid, projectId: linked.projectId, linkedAt: linked.linkedAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof FirebaseIdentityLinkError) throw error;
    if (error instanceof FirebaseStepUpError) {
      throw new FirebaseIdentityLinkError("INVALID_FIREBASE_IDENTITY");
    }
    if (error && typeof error === "object" && "code" in error) {
      const code = (error as { code?: unknown }).code;
      if (code === "P2002") throw new FirebaseIdentityLinkError("ALREADY_LINKED");
      if (code === "P2034") throw new FirebaseIdentityLinkError("ALREADY_LINKED");
    }
    throw error;
  }
}
