import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for isolated CI E2E setup.`);
  return value;
}

function assertDisposableCiTarget() {
  if (process.env.CI !== "true" || process.env.DATABASE_ENV !== "ci" || process.env.PIEROLO_E2E_AUTH_ENABLED !== "true") {
    throw new Error("E2E seeding is permitted only when DATABASE_ENV=ci and PIEROLO_E2E_AUTH_ENABLED=true.");
  }
  const databaseUrl = requireValue("DATABASE_URL");
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
    !/_ci$/i.test(databaseName)
  ) {
    throw new Error("E2E seeding requires a loopback PostgreSQL database with a *_ci name.");
  }
  if (!requireValue("PIEROLO_E2E_AUTH_SECRET") || requireValue("PIEROLO_E2E_AUTH_SECRET").length < 32) {
    throw new Error("PIEROLO_E2E_AUTH_SECRET must be at least 32 characters.");
  }
}

async function main() {
  assertDisposableCiTarget();
  const testEmail = requireValue("PIEROLO_E2E_TEST_EMAIL").toLowerCase();
  if (!testEmail.endsWith("@integration.invalid")) {
    throw new Error("The E2E identity must use the reserved integration.invalid domain.");
  }

  const ownerOrganization = await prisma.organization.upsert({
    where: { slug: "pieroloos-e2e-org" },
    update: { name: "PieroloOS Isolated E2E" },
    create: { name: "PieroloOS Isolated E2E", slug: "pieroloos-e2e-org" },
  });
  const ownerWorkspace = await prisma.workspace.upsert({
    where: { organizationId_slug: { organizationId: ownerOrganization.id, slug: "e2e-workspace" } },
    update: { name: "E2E Workspace" },
    create: { name: "E2E Workspace", slug: "e2e-workspace", organizationId: ownerOrganization.id },
  });
  const foreignOrganization = await prisma.organization.upsert({
    where: { slug: "pieroloos-e2e-foreign-org" },
    update: { name: "PieroloOS Isolated Foreign E2E" },
    create: { name: "PieroloOS Isolated Foreign E2E", slug: "pieroloos-e2e-foreign-org" },
  });
  const foreignWorkspace = await prisma.workspace.upsert({
    where: { organizationId_slug: { organizationId: foreignOrganization.id, slug: "foreign-workspace" } },
    update: { name: "Foreign Workspace" },
    create: { name: "Foreign Workspace", slug: "foreign-workspace", organizationId: foreignOrganization.id },
  });

  const user = await prisma.user.upsert({
    where: { email: testEmail },
    update: { name: "PieroloOS CI Test Owner" },
    create: { email: testEmail, name: "PieroloOS CI Test Owner" },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: ownerOrganization.id } },
    update: { role: "OWNER" },
    create: { userId: user.id, organizationId: ownerOrganization.id, role: "OWNER" },
  });
  await prisma.workspaceSettings.upsert({
    where: { workspaceId: ownerWorkspace.id },
    update: {},
    create: { workspaceId: ownerWorkspace.id },
  });

  const primaryClient = await prisma.client.upsert({
    where: { id: "pieroloos-e2e-primary-client" },
    update: {
      workspaceId: ownerWorkspace.id,
      organizationId: ownerOrganization.id,
      name: "E2E Primary Client",
      organizationName: "E2E Primary Client",
      email: "primary-client@integration.invalid",
      country: "Nigeria",
      proposedBusiness: "Primary E2E Consulting",
    },
    create: {
      id: "pieroloos-e2e-primary-client",
      workspaceId: ownerWorkspace.id,
      organizationId: ownerOrganization.id,
      name: "E2E Primary Client",
      organizationName: "E2E Primary Client",
      email: "primary-client@integration.invalid",
      country: "Nigeria",
      proposedBusiness: "Primary E2E Consulting",
    },
  });
  await prisma.businessProfile.upsert({
    where: { clientId: primaryClient.id },
    update: {
      businessName: "Primary E2E Consulting",
      businessType: "Consulting",
      businessObjective: "Initial objective from CI seed",
      businessModel: "Professional services",
      targetMarket: "Small businesses",
      version: 1,
    },
    create: {
      clientId: primaryClient.id,
      businessName: "Primary E2E Consulting",
      businessType: "Consulting",
      businessObjective: "Initial objective from CI seed",
      businessModel: "Professional services",
      targetMarket: "Small businesses",
    },
  });
  await prisma.engagement.upsert({
    where: { id: "pieroloos-e2e-existing-engagement" },
    update: {
      workspaceId: ownerWorkspace.id,
      clientId: primaryClient.id,
      service: "Seeded E2E advisory",
      status: "DRAFT",
      nextAction: "Confirm scope with the client",
    },
    create: {
      id: "pieroloos-e2e-existing-engagement",
      workspaceId: ownerWorkspace.id,
      clientId: primaryClient.id,
      service: "Seeded E2E advisory",
      status: "DRAFT",
      nextAction: "Confirm scope with the client",
    },
  });

  const secondaryClient = await prisma.client.upsert({
    where: { id: "pieroloos-e2e-secondary-client" },
    update: {
      workspaceId: ownerWorkspace.id,
      organizationId: ownerOrganization.id,
      name: "E2E Secondary Client",
      organizationName: "E2E Secondary Client",
      proposedBusiness: "Secondary E2E Services",
    },
    create: {
      id: "pieroloos-e2e-secondary-client",
      workspaceId: ownerWorkspace.id,
      organizationId: ownerOrganization.id,
      name: "E2E Secondary Client",
      organizationName: "E2E Secondary Client",
      proposedBusiness: "Secondary E2E Services",
    },
  });
  await prisma.businessProfile.upsert({
    where: { clientId: secondaryClient.id },
    update: { businessName: "Secondary E2E Services" },
    create: { clientId: secondaryClient.id, businessName: "Secondary E2E Services" },
  });

  const foreignClient = await prisma.client.upsert({
    where: { id: "pieroloos-e2e-foreign-client" },
    update: {
      workspaceId: foreignWorkspace.id,
      organizationId: foreignOrganization.id,
      name: "Foreign Private Client",
      organizationName: "Foreign Private Client",
      proposedBusiness: "Foreign Private Business",
    },
    create: {
      id: "pieroloos-e2e-foreign-client",
      workspaceId: foreignWorkspace.id,
      organizationId: foreignOrganization.id,
      name: "Foreign Private Client",
      organizationName: "Foreign Private Client",
      proposedBusiness: "Foreign Private Business",
    },
  });
  await prisma.businessProfile.upsert({
    where: { clientId: foreignClient.id },
    update: { businessName: "Foreign Private Business", businessObjective: "Must not be visible cross-tenant" },
    create: { clientId: foreignClient.id, businessName: "Foreign Private Business", businessObjective: "Must not be visible cross-tenant" },
  });
  await prisma.report.upsert({
    where: { id: "pieroloos-e2e-foreign-report" },
    update: { workspaceId: foreignWorkspace.id, clientId: foreignClient.id, title: "Foreign Private Report" },
    create: {
      id: "pieroloos-e2e-foreign-report",
      workspaceId: foreignWorkspace.id,
      clientId: foreignClient.id,
      title: "Foreign Private Report",
      format: "PIEROLOOS_CLIENT_SUMMARY_V1",
      status: "GENERATED",
      content: JSON.stringify({ title: "Foreign Private Report" }),
    },
  });
  await prisma.engagement.upsert({
    where: { id: "pieroloos-e2e-foreign-engagement" },
    update: {
      workspaceId: foreignWorkspace.id,
      clientId: foreignClient.id,
      service: "Foreign Private Engagement",
      status: "DRAFT",
    },
    create: {
      id: "pieroloos-e2e-foreign-engagement",
      workspaceId: foreignWorkspace.id,
      clientId: foreignClient.id,
      service: "Foreign Private Engagement",
      status: "DRAFT",
    },
  });

  console.log("Seeded isolated CI workspace, permitted user, Business Profile, Engagements, and foreign-tenant records.");
}

main()
  .catch((error) => {
    console.error("Isolated CI E2E seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
