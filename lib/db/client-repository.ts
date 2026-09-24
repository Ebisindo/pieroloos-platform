import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ClientIntakeInput } from "@/lib/validation/intake";

function profileData(input: ClientIntakeInput): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries({
      businessName: input.business.proposedName,
      businessType: input.business.businessType,
      businessModel: input.business.businessModel,
      targetMarket: input.business.targetMarket,
      revenueModel: input.business.revenueModel,
      ownership: input.business.ownershipContext,
      expansionObjectives: input.business.expansionObjectives,
      fundingStage: input.business.fundingContext,
      riskConstraints: input.business.constraints,
      strategicNotes: input.business.strategicNotes,
      operationalContext: input.business.operationalContext,
      objective: input.business.objective,
    }).filter(([, value]) => value !== undefined),
  ) as Prisma.InputJsonObject;
}

export const clientRepository = {
  async createFromIntake(input: ClientIntakeInput) {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findFirst({
        orderBy: { createdAt: "asc" },
        include: { organization: true },
      });

      if (!workspace) {
        throw new Error("No workspace is configured for client intake.");
      }

      const intakeData = JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;

      return tx.client.create({
        data: {
          organizationId: workspace.organizationId,
          workspaceId: workspace.id,
          name: input.client.legalName,
          email: input.client.email,
          country: input.client.residenceCountry,
          proposedBusiness: input.business.proposedName,
          intakeData,
          businessProfile: {
            create: { data: profileData(input) },
          },
          engagements: input.engagement
            ? {
                create: {
                  workspaceId: workspace.id,
                  service: input.engagement.service,
                  status: input.engagement.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
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
    });
  },

  async findById(id: string) {
    return prisma.client.findUnique({
      where: { id },
      include: {
        businessProfile: true,
        engagements: {
          orderBy: { createdAt: "desc" },
          include: {
            activities: {
              orderBy: { createdAt: "desc" },
              take: 50,
            },
          },
        },
      },
    });
  },

  async listByWorkspace(workspaceId: string) {
    return prisma.client.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      include: { businessProfile: true, engagements: true },
    });
  },

  async update(
    id: string,
    data: Partial<Pick<ClientIntakeInput["client"], "legalName" | "email" | "phone" | "residenceCountry">>,
  ) {
    return prisma.client.update({
      where: { id },
      data: {
        ...(data.legalName !== undefined ? { name: data.legalName } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.residenceCountry !== undefined ? { country: data.residenceCountry } : {}),
      },
    });
  },
};
