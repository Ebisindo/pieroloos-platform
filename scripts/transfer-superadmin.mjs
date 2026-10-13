import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArguments(args) {
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!["--from-user-id", "--to-user-id", "--reason"].includes(key) || !value || options.has(key)) {
      throw new Error("Usage: npm run admin:transfer-superadmin -- --from-user-id <id> --to-user-id <id> --reason <reason>");
    }
    options.set(key, value.trim());
  }
  const source = options.get("--from-user-id");
  const target = options.get("--to-user-id");
  const reason = options.get("--reason");
  if (!source || !target || source === target || !reason || reason.length < 8 || reason.length > 500) {
    throw new Error("Provide different existing staff user IDs and a reason between 8 and 500 characters.");
  }
  return { source, target, reason };
}

async function main() {
  const { source, target, reason } = parseArguments(process.argv.slice(2));
  await prisma.$transaction(async (transaction) => {
    const current = await transaction.platformSuperAdmin.findUnique({
      where: { id: "singleton" },
      select: { userId: true },
    });
    if (!current || current.userId !== source) {
      throw new Error("The supplied source user is not the current Super Administrator.");
    }
    const targetUser = await transaction.user.findUnique({
      where: { id: target },
      select: { id: true, memberships: { select: { id: true }, take: 1 } },
    });
    if (!targetUser?.memberships.length) {
      throw new Error("The target must be an existing staff user with an organization membership.");
    }

    await transaction.platformAdministrator.deleteMany({ where: { userId: target } });
    await transaction.platformSuperAdmin.update({
      where: { id: "singleton" },
      data: { userId: target, assignedAt: new Date() },
    });
    await transaction.platformAuditEvent.create({
      data: {
        actorUserId: source,
        actorRole: "SUPER_ADMIN",
        action: "SUPER_ADMIN_TRANSFERRED",
        subjectType: "USER",
        subjectId: target,
        outcome: "SUCCESS",
        reason,
        details: { previousSuperAdminUserId: source },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  console.log("Super Administrator transfer completed and audited.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Super Administrator transfer failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
