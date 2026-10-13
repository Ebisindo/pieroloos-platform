import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseEmailArgument(args) {
  if (args.length !== 2 || args[0] !== "--email") {
    throw new Error("Usage: npm run admin:provision-superadmin -- --email <existing-staff-email>");
  }
  const email = args[1]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid existing staff email is required.");
  }
  return email;
}

async function main() {
  const email = parseEmailArgument(process.argv.slice(2));
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, memberships: { select: { id: true }, take: 1 } },
  });
  if (!user || !user.memberships.length) {
    throw new Error("No existing staff account with an organization membership matches that email.");
  }

  const assigned = await prisma.$transaction(async (transaction) => {
    const current = await transaction.platformSuperAdmin.findUnique({
      where: { id: "singleton" },
      select: { userId: true },
    });
    if (current?.userId === user.id) return false;
    if (current) {
      throw new Error("A Super Administrator is already provisioned; bootstrap will not replace or add one.");
    }

    await transaction.platformAdministrator.deleteMany({ where: { userId: user.id } });
    await transaction.platformSuperAdmin.create({ data: { userId: user.id } });
    await transaction.platformAuditEvent.create({
      data: {
        actorRole: "SYSTEM_BOOTSTRAP",
        action: "INITIAL_SUPER_ADMIN_PROVISIONED",
        subjectType: "USER",
        subjectId: user.id,
        outcome: "SUCCESS",
      },
    });
    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.log(assigned
    ? "Initial Super Administrator provisioned and audited."
    : "This account is already the Super Administrator; no changes were made.");
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : "Super Administrator provisioning failed.";
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
