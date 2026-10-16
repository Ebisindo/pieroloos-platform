import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { clientRepository } from "@/lib/db/client-repository";
import { businessProfileRepository } from "@/lib/db/business-profile-repository";
import { reportRepository } from "@/lib/db/report-repository";
import { engagementRepository } from "@/lib/db/engagement-repository";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

const integrationEnabled = process.env.DATABASE_INTEGRATION_TESTS === "1";
const prisma = new PrismaClient();
const organizationIds: string[] = [];

async function createOrganization(slug: string) {
  const organization = await prisma.organization.create({
    data: { name: `Integration ${slug}`, slug },
  });
  organizationIds.push(organization.id);
  return organization;
}

async function createWorkspace(organizationId: string, slug: string) {
  return prisma.workspace.create({
    data: { name: slug, slug, organizationId },
  });
}

describe.skipIf(!integrationEnabled)("PostgreSQL database integrity", () => {
  afterEach(async () => {
    if (organizationIds.length > 0) {
      await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
      organizationIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("enforces foreign keys for workspace ownership", async () => {
    await expect(
      prisma.workspace.create({
        data: {
          name: "Orphan workspace",
          slug: `orphan-${crypto.randomUUID()}`,
          organizationId: `missing-${crypto.randomUUID()}`,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("scopes workspace uniqueness to its organization", async () => {
    const suffix = crypto.randomUUID();
    const first = await createOrganization(`first-${suffix}`);
    const second = await createOrganization(`second-${suffix}`);

    await prisma.workspace.create({
      data: { name: "First workspace", slug: "operations", organizationId: first.id },
    });
    await prisma.workspace.create({
      data: { name: "Second workspace", slug: "operations", organizationId: second.id },
    });

    await expect(
      prisma.workspace.create({
        data: { name: "Duplicate workspace", slug: "operations", organizationId: first.id },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("arbitrates concurrent writes through the database unique constraint", async () => {
    const organization = await createOrganization(`concurrent-${crypto.randomUUID()}`);
    const slug = `race-${crypto.randomUUID()}`;
    const attempts = await Promise.allSettled([
      prisma.workspace.create({ data: { name: "Race A", slug, organizationId: organization.id } }),
      prisma.workspace.create({ data: { name: "Race B", slug, organizationId: organization.id } }),
    ]);

    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((result) => result.status === "rejected");
    expect(rejected).toBeDefined();
    if (rejected?.status === "rejected") {
      expect(rejected.reason).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect(rejected.reason.code).toBe("P2002");
    }
  });

  it("cascades organization deletion to its workspace-owned clients", async () => {
    const organization = await createOrganization(`cascade-${crypto.randomUUID()}`);
    const workspace = await prisma.workspace.create({
      data: {
        name: "Cascade workspace",
        slug: `cascade-${crypto.randomUUID()}`,
        organizationId: organization.id,
      },
    });
    const client = await prisma.client.create({
      data: { organizationId: organization.id, workspaceId: workspace.id, name: "Test client" },
    });

    await prisma.organization.delete({ where: { id: organization.id } });
    organizationIds.splice(organizationIds.indexOf(organization.id), 1);

    await expect(prisma.workspace.findUnique({ where: { id: workspace.id } })).resolves.toBeNull();
    await expect(prisma.client.findUnique({ where: { id: client.id } })).resolves.toBeNull();
  });

  it("prevents resource-ID access and mutations across workspace boundaries", async () => {
    const suffix = crypto.randomUUID();
    const ownerOrganization = await createOrganization(`owner-${suffix}`);
    const otherOrganization = await createOrganization(`other-${suffix}`);
    const ownerWorkspace = await createWorkspace(ownerOrganization.id, `owner-${suffix}`);
    const otherWorkspace = await createWorkspace(otherOrganization.id, `other-${suffix}`);
    const owner = await prisma.user.create({
      data: { email: `owner-${suffix}@integration.invalid` },
    });
    await prisma.membership.create({
      data: { userId: owner.id, organizationId: ownerOrganization.id, role: "OWNER" },
    });
    const otherClient = await prisma.client.create({
      data: {
        organizationId: otherOrganization.id,
        workspaceId: otherWorkspace.id,
        name: "Other tenant client",
      },
    });
    const principal: WorkspacePrincipal = {
      userId: owner.id,
      organizationId: ownerOrganization.id,
      workspaceId: ownerWorkspace.id,
      role: "owner",
      permissions: ["client:read", "client:write"],
    };

    await expect(clientRepository.findById(otherClient.id, principal)).resolves.toBeNull();
    await expect(
      clientRepository.update(otherClient.id, { legalName: "Unauthorized change" }, principal),
    ).rejects.toThrow("CLIENT_NOT_FOUND");
    await expect(prisma.client.findUnique({ where: { id: otherClient.id } })).resolves.toMatchObject({
      name: "Other tenant client",
      workspaceId: otherWorkspace.id,
    });
  });

  it("enforces document, version, evidence, and access-log workspace boundaries in PostgreSQL", async () => {
    const suffix = crypto.randomUUID();
    const firstOrganization = await createOrganization(`documents-first-${suffix}`);
    const secondOrganization = await createOrganization(`documents-second-${suffix}`);
    const firstWorkspace = await createWorkspace(firstOrganization.id, `documents-first-${suffix}`);
    const secondWorkspace = await createWorkspace(secondOrganization.id, `documents-second-${suffix}`);
    const firstClient = await prisma.client.create({
      data: {
        organizationId: firstOrganization.id,
        workspaceId: firstWorkspace.id,
        name: "First tenant client",
      },
    });

    const secondClient = await prisma.client.create({
      data: {
        organizationId: secondOrganization.id,
        workspaceId: secondWorkspace.id,
        name: "Second tenant client",
      },
    });

    async function createDocument(input: {
      workspaceId: string;
      clientId: string;
      rootDocumentId?: string;
      version?: number;
    }) {
      const id = crypto.randomUUID();
      return prisma.document.create({
        data: {
          id,
          workspaceId: input.workspaceId,
          clientId: input.clientId,
          rootDocumentId: input.rootDocumentId ?? id,
          version: input.version ?? 1,
          name: "Evidence.pdf",
          mimeType: "application/pdf",
          storageKey: `${input.workspaceId}/documents/${id}/v${input.version ?? 1}/evidence.pdf`,
          sizeBytes: 5,
          checksum: "a".repeat(64),
          uploadedByUserId: "integration-user",
        },
      });
    }

    const secondDocument = await createDocument({
      workspaceId: secondWorkspace.id,
      clientId: secondClient.id,
    });
    await expect(createDocument({
      workspaceId: firstWorkspace.id,
      clientId: secondClient.id,
    })).rejects.toMatchObject({ code: "P2003" });

    const firstDocument = await createDocument({
      workspaceId: firstWorkspace.id,
      clientId: firstClient.id,
    });
    await expect(createDocument({
      workspaceId: firstWorkspace.id,
      clientId: firstClient.id,
      rootDocumentId: firstDocument.id,
      version: 1,
    })).rejects.toMatchObject({ code: "P2002" });
    await expect(createDocument({
      workspaceId: firstWorkspace.id,
      clientId: firstClient.id,
      rootDocumentId: secondDocument.id,
      version: 2,
    })).rejects.toMatchObject({ code: "P2003" });

    const obligation = await prisma.complianceObligation.create({
      data: {
        organizationId: firstOrganization.id,
        workspaceId: firstWorkspace.id,
        clientId: firstClient.id,
        title: "File annual return",
        type: "ANNUAL_FILING",
      },
    });
    await expect(prisma.complianceEvidence.create({
      data: {
        workspaceId: firstWorkspace.id,
        obligationId: obligation.id,
        documentId: secondDocument.id,
        evidenceClass: "E1",
      },
    })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.documentAccessEvent.create({
      data: {
        documentId: firstDocument.id,
        workspaceId: secondWorkspace.id,
        action: "DOWNLOAD_URL_ISSUED",
      },
    })).rejects.toMatchObject({ code: "P2003" });
  });

  it("enforces notification tenant scope, recipient-preference uniqueness, and attempt deletion", async () => {
    const suffix = crypto.randomUUID();
    const organization = await createOrganization(`notifications-${suffix}`);
    const otherOrganization = await createOrganization(`notifications-other-${suffix}`);
    const workspace = await createWorkspace(organization.id, `notifications-${suffix}`);
    const user = await prisma.user.create({
      data: { email: `notifications-${suffix}@integration.invalid` },
    });

    await prisma.membership.create({
      data: { userId: user.id, organizationId: organization.id, role: "MEMBER" },
    });
    await prisma.notificationPreference.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        emailEnabled: true,
        timezone: "America/New_York",
      },
    });
    await expect(prisma.notificationPreference.create({
      data: { workspaceId: workspace.id, userId: user.id },
    })).rejects.toMatchObject({ code: "P2002" });

    const notification = await prisma.complianceNotification.create({
      data: {
        organizationId: organization.id,
        workspaceId: workspace.id,
        recipientUserId: user.id,
        channel: "EMAIL",
        subject: "Test delivery",
        body: "Test",
        scheduledFor: new Date(),
        dedupeKey: `notification-${suffix}`,
      },
    });
    await expect(prisma.complianceNotification.create({
      data: {
        organizationId: otherOrganization.id,
        workspaceId: workspace.id,
        channel: "IN_APP",
        subject: "Cross-tenant delivery",
        body: "Must fail",
        scheduledFor: new Date(),
        dedupeKey: `cross-tenant-${suffix}`,
      },
    })).rejects.toMatchObject({ code: "P2003" });

    await prisma.notificationDeliveryAttempt.create({
      data: {
        notificationId: notification.id,
        attemptNumber: 1,
        status: "ATTEMPTING",
      },
    });
    await prisma.complianceNotification.delete({ where: { id: notification.id } });
    await expect(prisma.notificationDeliveryAttempt.count({
      where: { notificationId: notification.id },
    })).resolves.toBe(0);
  });

  it("isolates Business Profile, Reports, and Engagements reads and writes across workspace boundaries", async () => {
    const suffix = crypto.randomUUID();
    const firstOrganization = await createOrganization(`release-first-${suffix}`);
    const secondOrganization = await createOrganization(`release-second-${suffix}`);
    const ownerWorkspace = await createWorkspace(firstOrganization.id, `release-owner-${suffix}`);
    const siblingWorkspace = await createWorkspace(firstOrganization.id, `release-sibling-${suffix}`);
    const foreignWorkspace = await createWorkspace(secondOrganization.id, `release-foreign-${suffix}`);

    const owner = await prisma.user.create({
      data: { email: `release-owner-${suffix}@integration.invalid` },
    });
    await prisma.membership.create({
      data: { userId: owner.id, organizationId: firstOrganization.id, role: "OWNER" },
    });

    async function createClient(workspaceId: string, organizationId: string, name: string) {
      return prisma.client.create({
        data: { workspaceId, organizationId, name, organizationName: name, proposedBusiness: `${name} consulting` },
      });
    }

    const ownClient = await createClient(ownerWorkspace.id, firstOrganization.id, "Own workspace client");
    const siblingClient = await createClient(siblingWorkspace.id, firstOrganization.id, "Sibling workspace client");
    const foreignClient = await createClient(foreignWorkspace.id, secondOrganization.id, "Foreign organization client");

    const ownProfile = await prisma.businessProfile.create({
      data: { clientId: ownClient.id, businessName: "Own profile", businessObjective: "Baseline objective" },
    });
    const siblingProfile = await prisma.businessProfile.create({
      data: { clientId: siblingClient.id, businessName: "Sibling profile", businessObjective: "Private sibling objective" },
    });
    const foreignProfile = await prisma.businessProfile.create({
      data: { clientId: foreignClient.id, businessName: "Foreign profile", businessObjective: "Private foreign objective" },
    });

    const ownEngagement = await prisma.engagement.create({
      data: { workspaceId: ownerWorkspace.id, clientId: ownClient.id, service: "Own formation review", status: "DRAFT" },
    });
    const siblingEngagement = await prisma.engagement.create({
      data: { workspaceId: siblingWorkspace.id, clientId: siblingClient.id, service: "Sibling private engagement", status: "DRAFT" },
    });
    const foreignEngagement = await prisma.engagement.create({
      data: { workspaceId: foreignWorkspace.id, clientId: foreignClient.id, service: "Foreign private engagement", status: "DRAFT" },
    });

    const ownReport = await prisma.report.create({
      data: {
        workspaceId: ownerWorkspace.id, clientId: ownClient.id,
        title: "Own private report", status: "GENERATED", format: "TEST",
        content: JSON.stringify({ title: "Own private report" }),
      },
    });
    const siblingReport = await prisma.report.create({
      data: {
        workspaceId: siblingWorkspace.id, clientId: siblingClient.id,
        title: "Sibling private report", status: "GENERATED", format: "TEST",
        content: JSON.stringify({ title: "Sibling private report" }),
      },
    });
    const foreignReport = await prisma.report.create({
      data: {
        workspaceId: foreignWorkspace.id, clientId: foreignClient.id,
        title: "Foreign private report", status: "GENERATED", format: "TEST",
        content: JSON.stringify({ title: "Foreign private report" }),
      },
    });

    const principal: WorkspacePrincipal = {
      userId: owner.id,
      organizationId: firstOrganization.id,
      workspaceId: ownerWorkspace.id,
      role: "owner",
      permissions: [
        "client:read", "client:write",
        "reports:read", "reports:write",
        "engagement:read", "engagement:write",
      ],
    };

    const profiles = await businessProfileRepository.listByWorkspace(principal);
    expect(profiles.map((client) => client.businessProfile?.id)).toContain(ownProfile.id);
    expect(profiles.map((client) => client.id)).toEqual([ownClient.id]);
    await expect(businessProfileRepository.findById(siblingProfile.id, principal)).resolves.toBeNull();
    await expect(businessProfileRepository.findById(foreignProfile.id, principal)).resolves.toBeNull();
    await expect(
      businessProfileRepository.update(siblingProfile.id, { objective: "Unauthorized overwrite" }, principal),
    ).rejects.toThrow("BUSINESS_PROFILE_NOT_FOUND");
    await expect(
      businessProfileRepository.update(foreignProfile.id, { objective: "Unauthorized overwrite" }, principal),
    ).rejects.toThrow("BUSINESS_PROFILE_NOT_FOUND");

    const updatedProfile = await businessProfileRepository.update(
      ownProfile.id, { objective: "Updated own objective" }, principal,
    );
    expect(updatedProfile.version).toBe(2);
    expect(updatedProfile.businessObjective).toBe("Updated own objective");

    const reports = await reportRepository.listWorkspaceReports(principal);
    expect(reports.map((report) => report.id)).toEqual([ownReport.id]);
    await expect(reportRepository.findWorkspaceReport(siblingReport.id, principal)).resolves.toBeNull();
    await expect(reportRepository.findWorkspaceReport(foreignReport.id, principal)).resolves.toBeNull();
    await expect(reportRepository.generateClientSummary(siblingClient.id, principal)).rejects.toThrow("REPORT_CLIENT_NOT_FOUND");
    await expect(reportRepository.generateClientSummary(foreignClient.id, principal)).rejects.toThrow("REPORT_CLIENT_NOT_FOUND");

    const generated = await reportRepository.generateClientSummary(ownClient.id, principal);
    expect(generated.document.sections.some((section) => section.id === "business-profile")).toBe(true);
    expect(generated.document.sections.some((section) => section.id === "engagements")).toBe(true);
    expect(generated.document.sections.map((section) => section.content).join("\n")).toContain("Updated own objective");
    await expect(reportRepository.findWorkspaceReport(generated.id, principal)).resolves.toMatchObject({
      id: generated.id,
      title: generated.title,
    });

    const engagements = await engagementRepository.listByWorkspace(principal);
    expect(engagements.map((engagement) => engagement.id)).toEqual([ownEngagement.id]);
    await expect(engagementRepository.findById(siblingEngagement.id, principal)).resolves.toBeNull();
    await expect(engagementRepository.findById(foreignEngagement.id, principal)).resolves.toBeNull();
    await expect(
      engagementRepository.update(siblingEngagement.id, { service: "Unauthorized overwrite" }, principal),
    ).rejects.toThrow("ENGAGEMENT_NOT_FOUND");
    await expect(
      engagementRepository.update(foreignEngagement.id, { service: "Unauthorized overwrite" }, principal),
    ).rejects.toThrow("ENGAGEMENT_NOT_FOUND");
    await expect(
      engagementRepository.transition(siblingEngagement.id, "ACTIVE", "Unauthorized transition", principal),
    ).rejects.toThrow("ENGAGEMENT_NOT_FOUND");
    await expect(
      engagementRepository.create({ clientId: siblingClient.id, service: "Cross-workspace create" }, principal),
    ).rejects.toThrow("CLIENT_NOT_FOUND");

    await expect(prisma.businessProfile.findUnique({ where: { id: siblingProfile.id } })).resolves.toMatchObject({
      businessObjective: "Private sibling objective",
    });
    await expect(prisma.businessProfile.findUnique({ where: { id: foreignProfile.id } })).resolves.toMatchObject({
      businessObjective: "Private foreign objective",
    });
    await expect(prisma.engagement.findUnique({ where: { id: siblingEngagement.id } })).resolves.toMatchObject({
      service: "Sibling private engagement", status: "DRAFT",
    });
    await expect(prisma.engagement.findUnique({ where: { id: foreignEngagement.id } })).resolves.toMatchObject({
      service: "Foreign private engagement", status: "DRAFT",
    });
  });

});
