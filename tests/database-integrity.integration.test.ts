import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { clientRepository } from "@/lib/db/client-repository";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

const integrationEnabled = process.env.DATABASE_INTEGRATION_TESTS === "1";
const prisma = new PrismaClient();
const organizationIds: string[] = [];
const evidenceIds: string[] = [];
const userIds: string[] = [];

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
      const workspaces = await prisma.workspace.findMany({
        where: { organizationId: { in: organizationIds } },
        select: { id: true },
      });
      if (workspaces.length > 0) {
        // Delete append-only source links before deleting documents/workspaces because
        // links deliberately restrict hard deletion of their evidence document.
        await prisma.businessIntentEvidenceReference.deleteMany({
          where: { workspaceId: { in: workspaces.map((workspace) => workspace.id) } },
        });
      }
      await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
      organizationIds.length = 0;
    }
    // Evidence is a legacy global model, so clean up explicitly after workspace-owned
    // documents and proposal references are removed.
    if (evidenceIds.length > 0) {
      await prisma.evidence.deleteMany({ where: { id: { in: evidenceIds } } });
      evidenceIds.length = 0;
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      userIds.length = 0;
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

  it("enforces business-intent evidence bindings across proposal, document, client, and workspace", async () => {
    const suffix = crypto.randomUUID();
    const organization = await createOrganization(`intent-evidence-${suffix}`);
    const workspace = await createWorkspace(organization.id, `intent-evidence-${suffix}`);
    const firstClient = await prisma.client.create({
      data: { organizationId: organization.id, workspaceId: workspace.id, name: "First client" },
    });
    const secondClient = await prisma.client.create({
      data: { organizationId: organization.id, workspaceId: workspace.id, name: "Second client" },
    });
    const creator = await prisma.user.create({
      data: { email: `intent-evidence-${suffix}@integration.invalid` },
    });
    userIds.push(creator.id);

    async function createSource(title: string) {
      const source = await prisma.evidence.create({
        data: {
          title,
          source: `https://registry.example.gov/${encodeURIComponent(title)}`,
          sourceType: "OFFICIAL_REGISTRY",
          retrievedAt: new Date("2026-10-18T10:00:00.000Z"),
          evidenceClass: "E3",
          reviewStatus: "VERIFIED",
        },
      });
      evidenceIds.push(source.id);
      return source;
    }
    const firstSource = await createSource("First verified source");
    const secondSource = await createSource("Second verified source");

    async function createSourceDocument(clientId: string, evidenceId: string) {
      const id = crypto.randomUUID();
      return prisma.document.create({
        data: {
          id,
          workspaceId: workspace.id,
          clientId,
          evidenceId,
          rootDocumentId: id,
          version: 1,
          latestVersion: 1,
          name: "Verified source.pdf",
          mimeType: "application/pdf",
          storageKey: `${workspace.id}/documents/${id}/source.pdf`,
          sizeBytes: 25,
          checksum: "b".repeat(64),
          status: "AVAILABLE",
          scanStatus: "CLEAN",
          reviewStatus: "VERIFIED",
          uploadedByUserId: creator.id,
        },
      });
    }
    const firstDocument = await createSourceDocument(firstClient.id, firstSource.id);
    const secondDocument = await createSourceDocument(secondClient.id, secondSource.id);

    async function createProposal(clientId: string, suffix: string) {
      return prisma.businessIntentProposal.create({
        data: {
          organizationId: organization.id,
          workspaceId: workspace.id,
          clientId,
          createdByUserId: creator.id,
          status: "PROPOSED",
          version: 1,
          inputDigest: suffix,
          proposal: { businessSummary: "Provisional proposal requiring advisor review." },
          evidenceReferences: { claims: [], trustedSources: [] },
        },
      });
    }
    const firstProposal = await createProposal(firstClient.id, `first-${suffix}`);
    const secondProposal = await createProposal(secondClient.id, `second-${suffix}`);

    const reference = await prisma.businessIntentEvidenceReference.create({
      data: {
        proposalId: firstProposal.id,
        workspaceId: workspace.id,
        evidenceId: firstSource.id,
        documentId: firstDocument.id,
        clientId: firstClient.id,
        claimStatement: "The statement is supported by the attached source record.",
        verificationState: "SOURCE_VERIFIED_RECORD",
      },
    });
    expect(reference.workspaceId).toBe(workspace.id);

    // A reference cannot substitute a different client's document, even in the same workspace.
    await expect(prisma.businessIntentEvidenceReference.create({
      data: {
        proposalId: secondProposal.id,
        workspaceId: workspace.id,
        evidenceId: secondSource.id,
        documentId: firstDocument.id,
        clientId: secondClient.id,
        claimStatement: "Cross-client attachment must be rejected.",
        verificationState: "SOURCE_VERIFIED_RECORD",
      },
    })).rejects.toThrow();

    // The evidence ID must be the evidence actually attached to the selected document.
    await expect(prisma.businessIntentEvidenceReference.create({
      data: {
        proposalId: secondProposal.id,
        workspaceId: workspace.id,
        evidenceId: firstSource.id,
        documentId: secondDocument.id,
        clientId: secondClient.id,
        claimStatement: "Evidence/document mismatch must be rejected.",
        verificationState: "SOURCE_VERIFIED_RECORD",
      },
    })).rejects.toThrow();

    // The proposal's client scope must match the evidence reference's client scope.
    await expect(prisma.businessIntentEvidenceReference.create({
      data: {
        proposalId: firstProposal.id,
        workspaceId: workspace.id,
        evidenceId: secondSource.id,
        documentId: secondDocument.id,
        clientId: secondClient.id,
        claimStatement: "Proposal/client mismatch must be rejected.",
        verificationState: "SOURCE_VERIFIED_RECORD",
      },
    })).rejects.toThrow();

    // Once a source document is referenced, its client/evidence/workspace identity cannot be rebound.
    await expect(prisma.document.update({
      where: { id: firstDocument.id },
      data: { clientId: secondClient.id },
    })).rejects.toThrow();
  });

});
