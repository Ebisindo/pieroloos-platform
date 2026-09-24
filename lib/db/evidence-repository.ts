import { prisma } from "./prisma";
import type { EvidenceClass } from "@prisma/client";

export const evidenceRepository = {
  create(input: {
    subjectType: string;
    subjectId: string;
    evidenceClass: EvidenceClass;
    confidence?: number;
    sourceId?: string;
    reviewStatus?: string;
    notes?: string;
  }) {
    return prisma.evidence.create({ data: input });
  },

  listForSubject(subjectType: string, subjectId: string) {
    return prisma.evidence.findMany({
      where: { subjectType, subjectId },
      include: { source: true },
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
    return prisma.source.create({
      data: { ...input, retrievedAt: input.retrievedAt ?? new Date() },
    });
  },
};
