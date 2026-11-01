export type FirebaseMessagingConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
  vapidKey: string;
};

export function getFirebaseMessagingConfig(
  env: Record<string, string | undefined> = process.env,
): FirebaseMessagingConfig | null {
  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const appId = env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
  const messagingSenderId = env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const vapidKey = env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();

  if (!apiKey || !authDomain || !projectId || !appId || !messagingSenderId || !vapidKey) return null;
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) return null;
  if (!/^\d+$/.test(messagingSenderId)) return null;
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(vapidKey)) return null;

  return { apiKey, authDomain, projectId, appId, messagingSenderId, vapidKey };
}
