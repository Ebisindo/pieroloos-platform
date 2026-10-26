import { describe, expect, it } from "vitest";
import { getFirebaseMessagingConfig } from "@/lib/firebase/messaging-config";

const validEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "browser-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "pieroloos-platform.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "pieroloos-platform",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:abcdef",
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: "A".repeat(87),
};

describe("Firebase Web Push configuration", () => {
  it("accepts a complete browser-only configuration", () => {
    expect(getFirebaseMessagingConfig(validEnv)).toEqual({
      apiKey: validEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: validEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: validEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: validEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
      vapidKey: validEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });
  });

  it("fails closed when any required public setting is missing", () => {
    const { NEXT_PUBLIC_FIREBASE_VAPID_KEY: _ignored, ...withoutVapidKey } = validEnv;
    expect(getFirebaseMessagingConfig(withoutVapidKey)).toBeNull();
  });

  it("rejects malformed project IDs and VAPID keys", () => {
    expect(getFirebaseMessagingConfig({ ...validEnv, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "bad id" })).toBeNull();
    expect(getFirebaseMessagingConfig({ ...validEnv, NEXT_PUBLIC_FIREBASE_VAPID_KEY: "not-a-vapid-key" })).toBeNull();
  });

  it("does not depend on or return server-side private credentials", () => {
    expect(getFirebaseMessagingConfig({
      ...validEnv,
      FIREBASE_PRIVATE_KEY: "must-not-be-read",
      FIREBASE_CLIENT_EMAIL: "must-not-be-read",
    })).not.toHaveProperty("privateKey");
  });
});
