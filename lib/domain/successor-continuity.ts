import { createHash, randomBytes } from "node:crypto";

export type SuccessorPermissions = {
  canTransferOwnership: boolean;
  canAccessSecrets: boolean;
  canDeploy: boolean;
  canAccessBilling: boolean;
};

export const DEFAULT_SUCCESSOR_PERMISSIONS: SuccessorPermissions = {
  canTransferOwnership: false,
  canAccessSecrets: false,
  canDeploy: false,
  canAccessBilling: false,
};

export function createInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: createHash("sha256").update(token).digest("hex") };
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getWarningAt(lastActivityAt: Date, inactivityDays: number) {
  return new Date(lastActivityAt.getTime() + (inactivityDays - 7) * 24 * 60 * 60 * 1000);
}

export function getTriggerAt(lastActivityAt: Date, inactivityDays: number) {
  return new Date(lastActivityAt.getTime() + inactivityDays * 24 * 60 * 60 * 1000);
}

export function shouldWarn(now: Date, lastActivityAt: Date, inactivityDays: number) {
  return now.getTime() >= getWarningAt(lastActivityAt, inactivityDays).getTime();
}

export function hasReachedTrigger(now: Date, lastActivityAt: Date, inactivityDays: number) {
  return now.getTime() >= getTriggerAt(lastActivityAt, inactivityDays).getTime();
}

export function permissionsAreValid(value: unknown): value is SuccessorPermissions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return ["canTransferOwnership", "canAccessSecrets", "canDeploy", "canAccessBilling"].every(
    (key) => typeof candidate[key] === "boolean",
  ) && Object.keys(candidate).every((key) =>
    ["canTransferOwnership", "canAccessSecrets", "canDeploy", "canAccessBilling"].includes(key),
  );
}

export function validateInactivityDays(value: number) {
  return value === 30 || value === 60 || value === 90;
}
