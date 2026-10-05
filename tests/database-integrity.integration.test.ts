import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { clientRepository } from "@/lib/db/client-repository";
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
});
