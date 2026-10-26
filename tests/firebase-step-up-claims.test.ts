import { describe, expect, it } from "vitest";
import { createOpaqueStepUpHandle, hashStepUpHandle, verifyFreshFirebaseMfaClaims, FirebaseStepUpError } from "@/lib/auth/firebase-step-up";

const now = 1_800_000_000;
function claims(overrides: Record<string, unknown> = {}) {
  return {
    aud: "pieroloos-platform",
    iss: "https://securetoken.google.com/pieroloos-platform",
    sub: "firebase-uid-123",
    auth_time: now - 30,
    iat: now - 20,
    exp: now + 3600,
    firebase: { sign_in_second_factor: "phone" },
    ...overrides,
  } as never;
}

describe("Firebase MFA claim policy", () => {
  it("accepts correct project, recent auth and second-factor claim", () => {
    const proof = verifyFreshFirebaseMfaClaims(claims(), { projectId: "pieroloos-platform", nowSeconds: now });
    expect(proof.uid).toBe("firebase-uid-123");
    expect(proof.secondFactor).toBe("phone");
    expect(proof.issuer).toBe("https://securetoken.google.com/pieroloos-platform");
    expect(proof.audience).toBe("pieroloos-platform");
  });

  it("rejects wrong audience and issuer", () => {
    expect(() => verifyFreshFirebaseMfaClaims(claims({ aud: "other-project" }), { projectId: "pieroloos-platform", nowSeconds: now })).toThrow(FirebaseStepUpError);
    expect(() => verifyFreshFirebaseMfaClaims(claims({ iss: "https://evil.invalid" }), { projectId: "pieroloos-platform", nowSeconds: now })).toThrow(FirebaseStepUpError);
  });

  it("rejects empty subject, expired token and future auth_time", () => {
    expect(() => verifyFreshFirebaseMfaClaims(claims({ sub: "" }), { projectId: "pieroloos-platform", nowSeconds: now })).toThrow(FirebaseStepUpError);
    expect(() => verifyFreshFirebaseMfaClaims(claims({ exp: now - 1 }), { projectId: "pieroloos-platform", nowSeconds: now })).toThrow(FirebaseStepUpError);
    expect(() => verifyFreshFirebaseMfaClaims(claims({ auth_time: now + 60 }), { projectId: "pieroloos-platform", nowSeconds: now })).toThrow(FirebaseStepUpError);
  });

  it("rejects authentication older than the step-up window", () => {
    expect(() => verifyFreshFirebaseMfaClaims(claims({ auth_time: now - 301, iat: now - 10 }), { projectId: "pieroloos-platform", nowSeconds: now })).toThrow(FirebaseStepUpError);
  });

  it("rejects absent or empty second-factor claims", () => {
    expect(() => verifyFreshFirebaseMfaClaims(claims({ firebase: undefined }), { projectId: "pieroloos-platform", nowSeconds: now })).toThrow(FirebaseStepUpError);
    expect(() => verifyFreshFirebaseMfaClaims(claims({ firebase: { sign_in_second_factor: "" } }), { projectId: "pieroloos-platform", nowSeconds: now })).toThrow(FirebaseStepUpError);
    expect(() => verifyFreshFirebaseMfaClaims(claims({ firebase: { sign_in_second_factor: null } }), { projectId: "pieroloos-platform", nowSeconds: now })).toThrow(FirebaseStepUpError);
  });

  it("creates cryptographically random opaque handles and hashes only their public-safe digest", () => {
    const a = createOpaqueStepUpHandle();
    const b = createOpaqueStepUpHandle();
    expect(a.handle).not.toEqual(b.handle);
    expect(a.handleHash).toEqual(hashStepUpHandle(a.handle));
    expect(a.handleHash).not.toEqual(a.handle);
    expect(() => hashStepUpHandle("not-a-handle")).toThrow(FirebaseStepUpError);
  });
});
