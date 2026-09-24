import { prisma } from "@/lib/db/prisma";
import type { ClientIntakeInput } from "@/lib/validation/intake";

export const clientRepository = {
  async createFromIntake(input: ClientIntakeInput) {
    return prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          legalName: input.client.legalName,
          email: input.client.email,
          phone: input.client.phone,
          residenceCountry: input.client.residenceCountry,
          businessProfile: {
            create: {
              businessName: input.business.proposedName,
              businessModel: input.business.businessModel,
              targetMarket: input.business.targetMarket,
              revenueModel: input.business.revenueModel,
              ownership: input.business.ownershipContext,
              expansionObjectives: input.business.expansionObjectives,
              fundingStage: input.business.fundingContext,
              riskConstraints: input.business.constraints,
              strategicNotes: input.business.strategicNotes,
              operationalContext: input.business.operationalContext,
            },
          },
          engagements: input.engagement
            ? {
                create: {
                  service: input.engagement.service,
                  status: input.engagement.status ?? "INTAKE",
                  nextAction: input.engagement.nextAction,
                  notes: input.engagement.notes,
                },
              }
            : undefined,
        },
        include: {
          businessProfile: true,
          engagements: true,
        },
      });

      return client;
    });
  },

  async findById(id: string) {
    return prisma.client.findUnique({
      where: { id },
      include: {
        businessProfile: true,
        engagements: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
  },

  async update(id: string, data: Partial<Pick<ClientIntakeInput["client"], "legalName" | "email" | "phone" | "residenceCountry">>) {
    return prisma.client.update({
      where: { id },
      data,
    });
  },
};
