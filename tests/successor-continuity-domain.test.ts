import { describe, expect, it } from "vitest";
import {
  createInvitationToken, hashInvitationToken, getWarningAt, getTriggerAt,
  shouldWarn, hasReachedTrigger, permissionsAreValid, validateInactivityDays,
} from "@/lib/domain/successor-continuity";

describe("successor continuity domain rules", () => {
  const activity = new Date("2026-01-01T00:00:00.000Z");

  it("creates high-entropy invitation tokens and stores only their hash", () => {
    const invite = createInvitationToken();
    expect(invite.token).toHaveLength(43);
    expect(invite.tokenHash).not.toBe(invite.token);
    expect(hashInvitationToken(invite.token)).toBe(invite.tokenHash);
    expect(createInvitationToken().token).not.toBe(invite.token);
  });

  it("warns seven days before the configured inactivity trigger", () => {
    expect(getWarningAt(activity, 30).toISOString()).toBe("2026-01-24T00:00:00.000Z");
    expect(getTriggerAt(activity, 30).toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(shouldWarn(new Date("2026-01-23T23:59:59.999Z"), activity, 30)).toBe(false);
    expect(shouldWarn(new Date("2026-01-24T00:00:00.000Z"), activity, 30)).toBe(true);
  });

  it("does not treat inactivity as a completed transfer", () => {
    const trigger = getTriggerAt(activity, 60);
    expect(hasReachedTrigger(new Date(trigger.getTime() - 1), activity, 60)).toBe(false);
    expect(hasReachedTrigger(trigger, activity, 60)).toBe(true);
    // The domain function calculates time only; an explicit review case is still needed.
  });

  it("accepts only the configured trigger days", () => {
    expect([30, 60, 90].every(validateInactivityDays)).toBe(true);
    expect(validateInactivityDays(45)).toBe(false);
    expect(validateInactivityDays(0)).toBe(false);
  });

  it("rejects incomplete, extra, or non-boolean permissions", () => {
    expect(permissionsAreValid({ canTransferOwnership: true, canAccessSecrets: false, canDeploy: true, canAccessBilling: false })).toBe(true);
    expect(permissionsAreValid({ canTransferOwnership: true, canAccessSecrets: false, canDeploy: true })).toBe(false);
    expect(permissionsAreValid({ canTransferOwnership: true, canAccessSecrets: false, canDeploy: true, canAccessBilling: false, isSuperAdmin: true })).toBe(false);
    expect(permissionsAreValid(null)).toBe(false);
  });
});
