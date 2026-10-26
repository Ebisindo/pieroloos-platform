import "server-only";

import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "@/lib/db/prisma";

function firebaseAdminApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw new Error("FIREBASE_PUSH_NOT_CONFIGURED");
  const clientProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (clientProjectId && clientProjectId !== projectId) throw new Error("FIREBASE_PUSH_PROJECT_MISMATCH");
  const name = "pieroloos-push-delivery";
  const existing = getApps().find((app) => app.name === name);
  if (existing) {
    if (existing.options.projectId !== projectId) throw new Error("FIREBASE_PUSH_PROJECT_MISMATCH");
    return existing;
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const credential = clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey })
    : applicationDefault();
  return initializeApp({ credential, projectId }, name);
}

export async function sendFirebasePush(input: {
  userId: string;
  title: string;
  body: string;
  notificationId: string;
  url?: string;
}) {
  const tokens = await prisma.firebasePushToken.findMany({
    where: { userId: input.userId, revokedAt: null },
    select: { id: true, token: true },
    take: 50,
  });
  if (tokens.length === 0) throw new Error("NO_ACTIVE_PUSH_TOKENS");

  const safeUrl = input.url && input.url.startsWith("/") && !input.url.startsWith("//") ? input.url : "/notifications";
  const response = await getMessaging(firebaseAdminApp()).sendEachForMulticast({
    tokens: tokens.map(({ token }) => token),
    notification: { title: input.title.slice(0, 120), body: input.body.slice(0, 500) },
    data: { notificationId: input.notificationId, url: safeUrl },
    webpush: { fcmOptions: { link: safeUrl }, notification: { tag: input.notificationId } },
  });

  const invalidTokenIds: string[] = [];
  response.responses.forEach((result, index) => {
    if (!result.success && result.error && [
      "messaging/registration-token-not-registered",
      "messaging/invalid-registration-token",
    ].includes(result.error.code)) invalidTokenIds.push(tokens[index].id);
  });
  if (invalidTokenIds.length) {
    await prisma.firebasePushToken.updateMany({ where: { id: { in: invalidTokenIds } }, data: { revokedAt: new Date() } });
  }

  const permanentTokenErrors = [
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
    "messaging/invalid-argument",
  ];
  if (response.successCount === 0) {
    const permanent = response.failureCount > 0 && response.responses.every((result) =>
      result.error && permanentTokenErrors.includes(result.error.code),
    );
    throw new Error(permanent ? "PUSH_PERMANENT_FAILURE" : "PUSH_PROVIDER_FAILURE");
  }
  // Retry the outbox item if any token had a transient failure. The stable
  // notification tag reduces visual duplicates when a previously accepted
  // token receives the same event again on a later attempt.
  if (response.responses.some((result) =>
    !result.success && result.error && !permanentTokenErrors.includes(result.error.code),
  )) {
    throw new Error("PUSH_PROVIDER_PARTIAL_FAILURE");
  }
  return {
    messageId: response.responses.find((result) => result.success)?.messageId ?? ("fcm:" + input.notificationId),
    receipt: "accepted=" + response.successCount + ";failed=" + response.failureCount,
  };
}
