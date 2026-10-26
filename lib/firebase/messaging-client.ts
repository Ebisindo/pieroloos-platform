"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from "firebase/messaging";
import { getFirebaseMessagingConfig } from "@/lib/firebase/messaging-config";

const APP_NAME = "pieroloos-web-push";

async function getBrowserMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!(await isSupported())) return null;

  const config = getFirebaseMessagingConfig();
  if (!config) return null;

  const app = getApps().some((item) => item.name === APP_NAME)
    ? getApp(APP_NAME)
    : initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        appId: config.appId,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      }, APP_NAME);

  return getMessaging(app);
}

/**
 * Requests permission only after an explicit user gesture. Call from a button
 * handler; never prompt automatically on page load.
 */
export async function enableWebPushNotifications(): Promise<
  { ok: true; token: string } | { ok: false; reason: string }
> {
  const config = getFirebaseMessagingConfig();
  if (!config) return { ok: false, reason: "Firebase Web Push configuration is incomplete." };

  const messaging = await getBrowserMessaging();
  if (!messaging) return { ok: false, reason: "This browser does not support Firebase Web Push." };

  if (Notification.permission === "denied") {
    return { ok: false, reason: "Notifications are blocked in browser settings." };
  }

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "Notification permission was not granted." };
  }

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, reason: "Firebase did not return a Web Push token." };
    return { ok: true, token };
  } catch {
    return { ok: false, reason: "Web Push registration failed. Check HTTPS, Firebase settings, and service-worker availability." };
  }
}

export async function onForegroundPush(
  callback: (payload: MessagePayload) => void,
): Promise<(() => void) | null> {
  const messaging = await getBrowserMessaging();
  if (!messaging) return null;
  return onMessage(messaging, callback);
}
