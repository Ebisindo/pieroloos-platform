"use client";

import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";

const appName = "pieroloos-step-up-client";

export function getFirebaseClientAuth() {
  const config: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId || !config.messagingSenderId) {
    throw new Error("Firebase client configuration is incomplete.");
  }
  const existing = getApps().find((app) => app.name === appName);
  const app = existing ?? initializeApp(config, appName);
  if (app.options.projectId !== config.projectId) {
    throw new Error("Firebase client project mismatch.");
  }
  return getAuth(app);
}
