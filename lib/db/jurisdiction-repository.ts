import { prisma } from "@/lib/db/prisma";
import type { Jurisdiction as DomainJurisdiction, JurisdictionFactor } from "@/lib/domain/jurisdiction";

function profileValue(profile: unknown, key: string): string | undefined {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return undefined;
  }

  const value = (profile as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function mapJurisdiction(record: {
  id: string;
  name: string;
  countryCode: string | null;
  code: string | null;
  profile: unknown;
  observations: Array<{
    criterionKey: string;
    value: number;
    evidenceIds: string[];
    assumptions: string[];
    reviewRequired: boolean;
  }>;
}): DomainJurisdiction {
  const factors: JurisdictionFactor[] = record.observations.map((observation) => ({
    criterionKey: observation.criterionKey,
    value: observation.value,
    normalizedScore: observation.value,
    evidenceClass: "E0",
    sourceIds: observation.evidenceIds,
    confidence: 0,
    reviewRequired: observation.reviewRequired,
    notes: observation.assumptions.length
      ? observation.assumptions.join("; ")
      : undefined,
  }));

  return {
    id: record.id,
    code: record.countryCode ?? record.code ?? record.id,
    name: record.name,
    region: profileValue(record.profile, "region"),
    profileSummary:
      profileValue(record.profile, "profileSummary") ??
      profileValue(record.profile, "summary"),
    factors,
  };
}

export const jurisdictionRepository = {
  async list(workspaceId: string): Promise<DomainJurisdiction[]> {
    const records = await prisma.jurisdiction.findMany({
      where: { workspaceId },
      include: { observations: true },
      orderBy: { name: "asc" },
    });

    return records.map(mapJurisdiction);
  },

  async findById(id: string, workspaceId: string): Promise<DomainJurisdiction | null> {
    const record = await prisma.jurisdiction.findUnique({
      where: { id },
      include: { observations: true },
    });

    return record?.workspaceId === workspaceId ? mapJurisdiction(record) : null;
  },

  async create(data: {
    organizationId: string;
    workspaceId: string;
    code: string;
    name: string;
    country: string;
    region?: string;
    profileSummary?: string;
  }) {
    const created = await prisma.jurisdiction.create({
      data: {
        organizationId: data.organizationId,
        workspaceId: data.workspaceId,
        name: data.name,
        country: data.country,
        code: data.code,
        countryCode: data.code,
        profile: {
          region: data.region,
          profileSummary: data.profileSummary,
        },
      },
      include: { observations: true },
    });

    return mapJurisdiction(created);
  },
};
