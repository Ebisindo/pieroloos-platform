import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

const DEFAULT_FRESHNESS_SECONDS = 5 * 60;
const CLOCK_SKEW_SECONDS = 30;
const HANDLE_BYTES = 32;
const handlePattern = /^[A-Za-z0-9_-]{43}$/;

export type FirebaseStepUpIdentity = {
  uid: string;
  authTime: number;
  issuedAt: number;
  expiresAt: number;
  secondFactor: string;
  issuer: string;
  audience: string;
};

export type FirebaseStepUpErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_TOKEN"
  | "MFA_REQUIRED"
  | "STALE_AUTHENTICATION"
  | "INVALID_CHALLENGE"
  | "PERSISTENCE_FAILURE";

export class FirebaseStepUpError extends Error {
  constructor(readonly code: FirebaseStepUpErrorCode) {
    super(code);
    this.name = "FirebaseStepUpError";
  }
}

function projectId(): string {
  const value = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!value || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value)) {
    throw new FirebaseStepUpError("NOT_CONFIGURED");
  }
  return value;
}

function firebaseAdminAuth() {
  const project = projectId();
  const appName = "pieroloos-step-up";
  const existing = getApps().find((app) => app.name === appName);
  if (existing) {
    if (existing.options.projectId !== project) {
      throw new FirebaseStepUpError("NOT_CONFIGURED");
    }
    return getAuth(existing);
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const credential = clientEmail && privateKey
    ? cert({ projectId: project, clientEmail, privateKey })
    : applicationDefault();
  const app = initializeApp({ credential, projectId: project }, appName);
  return getAuth(app);
}

function numericClaim(token: DecodedIdToken, name: "auth_time" | "iat" | "exp") {
  const value = token[name];
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new FirebaseStepUpError("INVALID_TOKEN");
  }
  return value;
}

export function verifyFreshFirebaseMfaClaims(
  token: DecodedIdToken,
  options: { projectId: string; nowSeconds?: number; maxAgeSeconds?: number } ,
): FirebaseStepUpIdentity {
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxAge = options.maxAgeSeconds ?? DEFAULT_FRESHNESS_SECONDS;
  const expectedIssuer = `https://securetoken.google.com/${options.projectId}`;
  if (!options.projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(options.projectId)) {
    throw new FirebaseStepUpError("NOT_CONFIGURED");
  }
  if (
    token.aud !== options.projectId ||
    token.iss !== expectedIssuer ||
    typeof token.sub !== "string" ||
    token.sub.length === 0 ||
    token.sub.length > 128
  ) {
    throw new FirebaseStepUpError("INVALID_TOKEN");
  }

  const authTime = numericClaim(token, "auth_time");
  const issuedAt = numericClaim(token, "iat");
  const expiresAt = numericClaim(token, "exp");
  if (
    authTime > now + CLOCK_SKEW_SECONDS ||
    issuedAt > now + CLOCK_SKEW_SECONDS ||
    expiresAt <= now ||
    issuedAt < authTime ||
    now - authTime > maxAge ||
    now - issuedAt > maxAge + CLOCK_SKEW_SECONDS
  ) {
    throw new FirebaseStepUpError("STALE_AUTHENTICATION");
  }

  const firebaseClaim = token.firebase;
  if (!firebaseClaim || typeof firebaseClaim !== "object") {
    throw new FirebaseStepUpError("MFA_REQUIRED");
  }
  const secondFactor = (firebaseClaim as { sign_in_second_factor?: unknown }).sign_in_second_factor;
  if (typeof secondFactor !== "string" || secondFactor.length === 0 || secondFactor.length > 100) {
    throw new FirebaseStepUpError("MFA_REQUIRED");
  }

  return {
    uid: token.sub,
    authTime,
    issuedAt,
    expiresAt,
    secondFactor,
    issuer: expectedIssuer,
    audience: options.projectId,
  };
}

export async function verifyFirebaseMfaIdToken(idToken: string): Promise<FirebaseStepUpIdentity> {
  if (typeof idToken !== "string" || idToken.length < 100 || idToken.length > 12_000 || /\s/.test(idToken)) {
    throw new FirebaseStepUpError("INVALID_TOKEN");
  }
  const project = projectId();
  let decoded: DecodedIdToken;
  try {
    decoded = await firebaseAdminAuth().verifyIdToken(idToken, true);
  } catch {
    // Never expose provider errors or token contents to callers.
    throw new FirebaseStepUpError("INVALID_TOKEN");
  }
  return verifyFreshFirebaseMfaClaims(decoded, { projectId: project });
}

export function hashStepUpHandle(handle: string): string {
  if (!handlePattern.test(handle)) throw new FirebaseStepUpError("INVALID_CHALLENGE");
  return createHash("sha256").update(handle, "utf8").digest("hex");
}

export function createOpaqueStepUpHandle(): { handle: string; handleHash: string } {
  const handle = randomBytes(HANDLE_BYTES).toString("base64url");
  return { handle, handleHash: createHash("sha256").update(handle, "utf8").digest("hex") };
}

/**
 * Creates a verified identity proof and a one-time opaque handle.
 * Persistence and operation binding are handled by the step-up service.
 */
export async function verifyAndPrepareStepUp(idToken: string) {
  const identity = await verifyFirebaseMfaIdToken(idToken);
  const { handle, handleHash } = createOpaqueStepUpHandle();
  return {
    identity,
    handle,
    handleHash,
    expiresAt: new Date(Math.min(identity.authTime * 1000 + DEFAULT_FRESHNESS_SECONDS * 1000, Date.now() + 2 * 60 * 1000)),
  };
}

export const FIREBASE_STEP_UP_FRESHNESS_SECONDS = DEFAULT_FRESHNESS_SECONDS;
export const FIREBASE_STEP_UP_HANDLE_TTL_SECONDS = 2 * 60;
