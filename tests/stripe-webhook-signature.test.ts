import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeWebhookSignature } from "@/lib/domain/stripe-webhook-signature";

function signatureFor(body: string, secret: string, timestamp: number) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("Stripe webhook signature verification", () => {
  const now = 1_800_000_000;
  const secret = "whsec_test_secret";
  const body = JSON.stringify({ id: "evt_test_1", type: "checkout.session.completed" });

  it("accepts a valid current signature over the original body", () => {
    expect(verifyStripeWebhookSignature(body, signatureFor(body, secret, now), secret, now)).toBe(true);
  });

  it("rejects a modified body", () => {
    expect(verifyStripeWebhookSignature(body + " ", signatureFor(body, secret, now), secret, now)).toBe(false);
  });

  it("rejects stale timestamps and malformed signatures", () => {
    expect(verifyStripeWebhookSignature(body, signatureFor(body, secret, now - 301), secret, now)).toBe(false);
    expect(verifyStripeWebhookSignature(body, "t=nope,v1=00", secret, now)).toBe(false);
    expect(verifyStripeWebhookSignature(body, signatureFor(body, secret, now), "", now)).toBe(false);
  });

  it("supports multiple v1 signatures during key rotation", () => {
    const valid = signatureFor(body, secret, now).split(",")[1];
    expect(verifyStripeWebhookSignature(body, `t=${now},v1=${"0".repeat(64)},${valid}`, secret, now)).toBe(true);
  });
});
