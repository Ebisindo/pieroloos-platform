"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  deleteToken,
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
        messagingSenderId: config.messagingSenderId,
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
  if (typeof Notification === "undefined") {
    return { ok: false, reason: "Notifications are not available in this browser." };
  }
  if (!("serviceWorker" in navigator)) {
    return { ok: false, reason: "This browser does not support service workers." };
  }
  if (Notification.permission === "denied") {
    return { ok: false, reason: "Notifications are blocked in browser settings." };
  }

  // Invoke the permission API immediately from the user gesture, before awaits.
  const permissionPromise = Notification.permission === "granted"
    ? Promise.resolve("granted" as NotificationPermission)
    : Notification.requestPermission();
  const permission = await permissionPromise;
  if (permission !== "granted") {
    return { ok: false, reason: "Notification permission was not granted." };
  }

  const messaging = await getBrowserMessaging();
  if (!messaging) return { ok: false, reason: "This browser does not support Firebase Web Push." };

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, reason: "Firebase did not return a Web Push token." };
    const serverRegistration = await fetch("/api/notifications/push-token", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!serverRegistration.ok) {
      return { ok: false, reason: "The push token could not be securely registered to your account." };
    }
    return { ok: true, token };
  } catch {
    return { ok: false, reason: "Web Push registration failed. Check HTTPS, Firebase settings, and service-worker availability." };
  }
}

/** Revoke this browser's token; workspace push is disabled if no active browser remains. */
export async function disableWebPushNotifications(): Promise<boolean> {
  const config = getFirebaseMessagingConfig();
  if (!config) return false;
  const messaging = await getBrowserMessaging();
  if (!messaging) return false;
  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;
    const response = await fetch("/api/notifications/push-token", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return false;
    await deleteToken(messaging);
    return true;
  } catch {
    return false;
  }
}

export async function onForegroundPush(
  callback: (payload: MessagePayload) => void,
): Promise<(() => void) | null> {
  const messaging = await getBrowserMessaging();
  if (!messaging) return null;
  return onMessage(messaging, callback);
}
