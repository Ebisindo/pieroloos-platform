import { Prisma, PrismaClient } from "@prisma/client";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const prisma = new PrismaClient();

function parseArgs(args) {
  const allowed = new Set(["--user-id", "--firebase-uid", "--actor-user-id", "--confirm"]);
  const values = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!allowed.has(key) || values.has(key)) throw new Error("Unknown or duplicate argument.");
    if (key === "--confirm") {
      values.set(key, true);
      continue;
    }
    const value = args[index + 1]?.trim();
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}.`);
    values.set(key, value);
    index += 1;
  }
  const userId = values.get("--user-id");
  const firebaseUid = values.get("--firebase-uid");
  const actorUserId = values.get("--actor-user-id");
  if (!userId || !firebaseUid || !actorUserId || !values.get("--confirm")) {
    throw new Error("Usage: npm run admin:link-firebase-uid -- --user-id <local-user-id> --firebase-uid <firebase-uid> --actor-user-id <current-superadmin-user-id> --confirm");
  }
  if (firebaseUid.length > 128 || /\s/.test(firebaseUid)) throw new Error("Firebase UID is invalid.");
  return { userId, firebaseUid, actorUserId };
}

function getFirebaseAdminAuth() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId || projectId !== "pieroloos-platform") {
    throw new Error("FIREBASE_PROJECT_ID must be set to pieroloos-platform.");
  }
  const appName = "pieroloos-step-up";
  const existing = getApps().find((app) => app.name === appName);
  if (existing) return getAuth(existing);

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const credential = clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey })
    : applicationDefault();
  return getAuth(initializeApp({ credential, projectId }, appName));
}

async function main() {
  const { userId, firebaseUid, actorUserId } = parseArgs(process.argv.slice(2));
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const root = await prisma.platformSuperAdmin.findUnique({
    where: { id: "singleton" },
    select: { userId: true },
  });
  if (root?.userId !== actorUserId) {
    throw new Error("Only the currently provisioned Super Administrator may link a Firebase UID.");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firebaseUid: true,
      memberships: { select: { id: true }, take: 1 },
      platformAdministrator: { select: { id: true } },
      platformSuperAdmin: { select: { id: true } },
    },
  });
  if (!target || (!target.memberships.length && !target.platformAdministrator && !target.platformSuperAdmin)) {
    throw new Error("Target must be an existing staff account with a membership or platform-admin record.");
  }
  if (target.firebaseUid === firebaseUid) {
    console.log("This Firebase UID is already linked to this local user; no change made.");
    return;
  }
  if (target.firebaseUid) {
    throw new Error("This local user already has a Firebase UID; reassignment requires a separately reviewed recovery procedure.");
  }

  const duplicate = await prisma.user.findUnique({
    where: { firebaseUid },
    select: { id: true },
  });
  if (duplicate) throw new Error("This Firebase UID is already linked to another local user.");

  const firebaseUser = await getFirebaseAdminAuth().getUser(firebaseUid);
  if (firebaseUser.disabled) throw new Error("Firebase user is disabled.");
  const enrolledFactors = firebaseUser.multiFactor?.enrolledFactors ?? [];
  if (enrolledFactors.length < 1) throw new Error("Firebase user must have at least one enrolled MFA factor.");

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { firebaseUid: true },
    });
    if (!current || current.firebaseUid) {
      throw new Error("Target Firebase UID mapping changed concurrently; retry after review.");
    }
    const updated = await tx.user.updateMany({
      where: { id: userId, firebaseUid: null },
      data: { firebaseUid },
    });
    if (updated.count !== 1) throw new Error("Firebase UID mapping could not be committed.");
    await tx.platformAuditEvent.create({
      data: {
        actorUserId,
        actorRole: "SUPER_ADMIN",
        action: "FIREBASE_UID_LINKED",
        subjectType: "USER",
        subjectId: userId,
        outcome: "SUCCESS",
        details: {
          firebaseProjectId: projectId,
          firebaseUid,
          enrolledMfaFactors: enrolledFactors.length,
        },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.log("Firebase UID linked and audited. No credentials or ID tokens were stored.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Firebase UID linking failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
