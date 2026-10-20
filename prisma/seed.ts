import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function requiredSeedValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to run the controlled workspace seed.`);
  }
  return value;
}

async function main() {
  const target = requiredSeedValue("PIEROLO_SEED_TARGET");
  if (!["local", "staging", "production"].includes(target)) {
    throw new Error("PIEROLO_SEED_TARGET must be local, staging, or production.");
  }
  if (process.env.DATABASE_ENV !== target) {
    throw new Error("DATABASE_ENV must match PIEROLO_SEED_TARGET before seeding.");
  }
  if (
    target === "production" &&
    process.env.CONFIRM_PRODUCTION_SEED !== "I_HAVE_VERIFIED_THE_PRODUCTION_TARGET"
  ) {
    throw new Error("Production seed requires CONFIRM_PRODUCTION_SEED=I_HAVE_VERIFIED_THE_PRODUCTION_TARGET.");
  }

  const organizationName = requiredSeedValue("PIEROLO_SEED_ORGANIZATION_NAME");
  const organizationSlug = requiredSeedValue("PIEROLO_SEED_ORGANIZATION_SLUG");
  const workspaceName = requiredSeedValue("PIEROLO_SEED_WORKSPACE_NAME");
  const workspaceSlug = requiredSeedValue("PIEROLO_SEED_WORKSPACE_SLUG");
  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: { name: organizationName },
    create: { name: organizationName, slug: organizationSlug },
  });

  const workspace = await prisma.workspace.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: workspaceSlug } },
    update: { name: workspaceName },
    create: { organizationId: organization.id, name: workspaceName, slug: workspaceSlug },
  });

  await prisma.workspaceSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: { workspaceId: workspace.id },
  });

  console.log(`Seeded workspace defaults for target "${target}". No user identity or regulatory data was created.`);
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
