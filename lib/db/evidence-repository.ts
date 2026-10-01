import { prisma } from "./prisma";
import type { EvidenceClass } from "@prisma/client";

export const evidenceRepository = {
  create(input: {
    title: string;
    source?: string | null;
    sourceType?: string | null;
    jurisdictionId?: string | null;
    complianceItemId?: string | null;
    evidenceClass: EvidenceClass;
    confidence?: number | null;
    reviewStatus?: string | null;
    notes?: string | null;
  }) {
    return prisma.evidence.create({
      data: {
        title: input.title,
        source: input.source,
        sourceType: input.sourceType,
        jurisdictionId: input.jurisdictionId,
        complianceItemId: input.complianceItemId,
        evidenceClass: input.evidenceClass,
        confidence: input.confidence,
        reviewStatus: input.reviewStatus,
        notes: input.notes,
      },
    });
  },

  listForSubject(subjectType: string, subjectId: string) {
    return prisma.evidence.findMany({
      where: { jurisdictionId: subjectType === "jurisdiction" ? subjectId : null, complianceItemId: subjectType === "compliance-item" ? subjectId : null },
      orderBy: { createdAt: "desc" },
    });
  },

  createSource(input: {
    title: string;
    url?: string;
    sourceType: string;
    publicationDate?: Date;
    retrievedAt?: Date;
  }) {
    return prisma.evidence.create({
      data: {
        title: input.title,
        source: input.url,
        sourceType: input.sourceType,
        publicationDate: input.publicationDate,
        retrievedAt: input.retrievedAt ?? new Date(),
        evidenceClass: "E0_UNKNOWN",
      },
    });
  },
};
