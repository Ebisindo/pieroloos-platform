import { prisma } from "@/lib/db/prisma";
import type { PartnershipInquiryInput } from "@/lib/validation/partnership-inquiry";

export const partnershipInquiryRepository = {
  create(input: Omit<PartnershipInquiryInput, "consent" | "hp">) {
    return prisma.partnershipInquiry.create({
      data: { ...input, consentAcceptedAt: new Date() },
      select: { id: true, partnerType: true, organisationName: true, createdAt: true },
    });
  },

  listRecent(limit = 100) {
    return prisma.partnershipInquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
