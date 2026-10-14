import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies Stripe's timestamped HMAC-SHA256 signature over the exact request body.
 * This validates authenticity only; the caller must still validate event semantics.
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  const parts = signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestampValue = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value).filter(Boolean);
  if (!timestampValue || !/^\d+$/.test(timestampValue) || !signatures.length || !secret) return false;
  const timestamp = Number(timestampValue);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${timestampValue}.${rawBody}`, "utf8").digest();
  return signatures.some((candidate) => {
    if (!/^[0-9a-f]{64}$/i.test(candidate)) return false;
    const actual = Buffer.from(candidate, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
