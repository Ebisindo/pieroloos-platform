import type { EvidenceClass, Prisma } from "@prisma/client";
import { assertPermission, type WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { prisma } from "./prisma";

type EvidenceInput = {
  title: string;
  source?: string | null;
  sourceType?: string | null;
  jurisdictionId?: string | null;
  complianceItemId?: string | null;
  evidenceClass: EvidenceClass;
  confidence?: number | null;
  reviewStatus?: string | null;
  notes?: string | null;
};

async function assertEvidenceSubject(
  transaction: Prisma.TransactionClient,
  input: Pick<EvidenceInput, "jurisdictionId" | "complianceItemId">,
  principal: WorkspacePrincipal,
) {
  if (input.jurisdictionId) {
    const jurisdiction = await transaction.jurisdiction.findFirst({
      where: { id: input.jurisdictionId, workspaceId: principal.workspaceId },
      select: { id: true },
    });
    if (!jurisdiction) throw new Error("EVIDENCE_SUBJECT_NOT_FOUND");
    return { jurisdictionId: jurisdiction.id, complianceItemId: null };
  }
  if (input.complianceItemId) {
    const item = await transaction.complianceItem.findFirst({
      where: { id: input.complianceItemId, workspaceId: principal.workspaceId },
      select: { id: true },
    });
    if (!item) throw new Error("EVIDENCE_SUBJECT_NOT_FOUND");
    return { jurisdictionId: null, complianceItemId: item.id };
  }
  throw new Error("EVIDENCE_SUBJECT_REQUIRED");
}

export const evidenceRepository = {
  create(input: EvidenceInput, principal: WorkspacePrincipal) {
    return withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
      const subject = await assertEvidenceSubject(transaction, input, principal);
      const evidence = await transaction.evidence.create({
        data: {
          title: input.title,
          source: input.source,
          sourceType: input.sourceType,
          ...subject,
          evidenceClass: input.evidenceClass,
          confidence: input.confidence,
          reviewStatus: input.reviewStatus,
          notes: input.notes,
        },
      });
      await transaction.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "CREATED",
          title: "Evidence record created",
          metadata: { evidenceId: evidence.id },
        },
      });
      return evidence;
    });
  },

  async listForSubject(subjectType: string, subjectId: string, principal: WorkspacePrincipal) {
    assertPermission(principal, "compliance:read");
    if (subjectType === "jurisdiction") {
      const jurisdiction = await prisma.jurisdiction.findFirst({
        where: { id: subjectId, OR: [{ workspaceId: principal.workspaceId }, { workspaceId: null }] },
        select: { id: true },
      });
      if (!jurisdiction) throw new Error("EVIDENCE_SUBJECT_NOT_FOUND");
      return prisma.evidence.findMany({
        where: { jurisdictionId: jurisdiction.id },
        orderBy: { createdAt: "desc" },
      });
    }
    if (subjectType === "compliance-item") {
      const item = await prisma.complianceItem.findFirst({
        where: { id: subjectId, workspaceId: principal.workspaceId },
        select: { id: true },
      });
      if (!item) throw new Error("EVIDENCE_SUBJECT_NOT_FOUND");
      return prisma.evidence.findMany({
        where: { complianceItemId: item.id },
        orderBy: { createdAt: "desc" },
      });
    }
    throw new Error("UNSUPPORTED_EVIDENCE_SUBJECT");
  },

  createSource(input: {
    jurisdictionId: string;
    title: string;
    url?: string;
    sourceType: string;
    publicationDate?: Date;
    retrievedAt?: Date;
  }, principal: WorkspacePrincipal) {
    return withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
      const subject = await assertEvidenceSubject(transaction, input, principal);
      const evidence = await transaction.evidence.create({
        data: {
          ...subject,
          title: input.title,
          source: input.url,
          sourceType: input.sourceType,
          publicationDate: input.publicationDate,
          retrievedAt: input.retrievedAt ?? new Date(),
          evidenceClass: "E0_UNKNOWN",
        },
      });
      await transaction.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "CREATED",
          title: "Evidence source created",
          metadata: { evidenceId: evidence.id },
        },
      });
      return evidence;
    });
  },
};
