import { describe, expect, it } from "vitest";
import {
  digestExecutionOperation,
  executionAuthorizationExpiresAt,
  executionAuthorizationRequestSchema,
} from "@/lib/domain/execution-authorization";

const base = {
  expectedVersion: 2,
  idempotencyKey: "audit-test-key-0001",
  confirmExactOperation: true,
};

describe("execution authorization request contract", () => {
  it("rejects unknown fields and production payment consent", () => {
    const unknownField = executionAuthorizationRequestSchema.safeParse({
      ...base,
      bypassApproval: true,
      operationType: "PAYMENT",
      operation: {
        currency: "NGN",
        amountMinor: "125000",
        recipientReference: "vendor-1",
        purpose: "Approved service fee",
        environment: "SANDBOX",
      },
    });
    expect(unknownField.success).toBe(false);

    const productionPayment = executionAuthorizationRequestSchema.safeParse({
      ...base,
      operationType: "PAYMENT",
      operation: {
        currency: "NGN",
        amountMinor: "125000",
        recipientReference: "vendor-1",
        purpose: "Approved service fee",
        environment: "PRODUCTION",
      },
    });
    expect(productionPayment.success).toBe(false);
  });

  it("requires exact graph targets and action-specific payloads", () => {
    const missingTarget = executionAuthorizationRequestSchema.safeParse({
      ...base,
      operationType: "CORPORATE_GRAPH_MUTATION",
      operation: {
        action: "UPDATE_NODE",
        targetIds: [],
        changes: { name: "Updated Holdings" },
      },
    });
    expect(missingTarget.success).toBe(false);

    const validCreate = executionAuthorizationRequestSchema.safeParse({
      ...base,
      operationType: "CORPORATE_GRAPH_MUTATION",
      operation: {
        action: "CREATE_NODE",
        targetIds: [],
        node: { name: "Sample Holdings", nodeType: "COMPANY" },
      },
    });
    expect(validCreate.success).toBe(true);
  });

  it("canonicalizes object key order but binds the digest to material values", () => {
    const first = {
      currency: "NGN",
      amountMinor: "125000",
      recipientReference: "vendor-1",
      purpose: "Approved service fee",
      environment: "SANDBOX" as const,
    };
    const reordered = {
      environment: "SANDBOX" as const,
      purpose: "Approved service fee",
      recipientReference: "vendor-1",
      amountMinor: "125000",
      currency: "NGN",
    };
    const changedAmount = { ...first, amountMinor: "125001" };

    expect(digestExecutionOperation("PAYMENT", first)).toBe(digestExecutionOperation("PAYMENT", reordered));
    expect(digestExecutionOperation("PAYMENT", first)).not.toBe(digestExecutionOperation("PAYMENT", changedAmount));
    expect(digestExecutionOperation("PAYMENT", first)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sets authorization expiry to exactly fifteen minutes after issue time", () => {
    const issuedAt = new Date("2026-10-20T12:00:00.000Z");
    expect(executionAuthorizationExpiresAt(issuedAt).toISOString()).toBe("2026-10-20T12:15:00.000Z");
  });
});
