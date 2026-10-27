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
    let previousToken: string | undefined;
    try {
      previousToken = window.localStorage.getItem("pieroloos-fcm-token") ?? undefined;
    } catch {
      // Registration can still succeed when browser storage is restricted.
    }
    const serverRegistration = await fetch("/api/notifications/push-token", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        ...(previousToken && previousToken !== token ? { previousToken } : {}),
      }),
    });
    if (!serverRegistration.ok) {
      return { ok: false, reason: "The push token could not be securely registered to your account." };
    }
    try {
      window.localStorage.setItem("pieroloos-fcm-token", token);
    } catch {
      // The Firebase SDK still retains its token if browser storage is restricted.
    }
    return { ok: true, token };
  } catch {
    return { ok: false, reason: "Web Push registration failed. Check HTTPS, Firebase settings, and service-worker availability." };
  }
}

/** Revoke this browser's token and disable push for the selected workspace. */
export async function disableWebPushNotifications(): Promise<boolean> {
  let token: string | null = null;
  try {
    token = window.localStorage.getItem("pieroloos-fcm-token");
  } catch {
    // Fall back to the Firebase SDK token store below.
  }

  let messaging: Messaging | null = null;
  if (!token) {
    const config = getFirebaseMessagingConfig();
    if (!config) return false;
    messaging = await getBrowserMessaging();
    if (!messaging) return false;
    try {
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      token = await getToken(messaging, {
        vapidKey: config.vapidKey,
        serviceWorkerRegistration: registration,
      });
    } catch {
      return false;
    }
  }
  if (!token) return false;

  try {
    const response = await fetch("/api/notifications/push-token", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return false;
    try {
      window.localStorage.removeItem("pieroloos-fcm-token");
    } catch {
      // Server-side revocation has already succeeded.
    }
    if (messaging) {
      try {
        await deleteToken(messaging);
      } catch {
        // Server-side revocation remains authoritative.
      }
    }
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
