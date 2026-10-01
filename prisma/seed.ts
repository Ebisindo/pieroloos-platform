import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "ebisindojames@gmail.com";
  const organization = await prisma.organization.upsert({
    where: { slug: "ebisindo-platform" },
    update: { name: "Ebisindo Platform" },
    create: { name: "Ebisindo Platform", slug: "ebisindo-platform" },
  });
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: "Ebisindo James" },
    create: { email, name: "Ebisindo James" },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
    update: { role: "OWNER" },
    create: { userId: user.id, organizationId: organization.id, role: "OWNER" },
  });

  await prisma.workspace.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: "command-center" } },
    update: { name: "Command Center" },
    create: { organizationId: organization.id, name: "Command Center", slug: "command-center" },
  });

  console.log(`Seeded platform owner membership for ${email}.`);
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
