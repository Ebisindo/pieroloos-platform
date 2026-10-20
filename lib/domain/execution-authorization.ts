import { createHash } from "node:crypto";
import { z } from "zod";

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/i, "Expected a SHA-256 digest.");
const identifier = z.string().trim().min(1).max(200);

const base = {
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/),
  confirmExactOperation: z.literal(true),
};

export const executionAuthorizationRequestSchema = z.discriminatedUnion("operationType", [
  z.object({
    ...base,
    operationType: z.literal("CORPORATE_GRAPH_MUTATION"),
    operation: z.object({
      action: z.enum(["CREATE_NODE", "UPDATE_NODE", "ARCHIVE_NODE", "CREATE_RELATIONSHIP", "ARCHIVE_RELATIONSHIP"]),
      targetIds: z.array(identifier).max(20),
      clientId: identifier.optional(),
      changesDigest: digestSchema,
    }).strict().superRefine((operation, context) => {
      const expectedTargets = operation.action === "CREATE_NODE" ? 0
        : operation.action === "CREATE_RELATIONSHIP" ? 2 : 1;
      if (operation.targetIds.length !== expectedTargets) {
        context.addIssue({
          code: "custom",
          path: ["targetIds"],
          message: `\${operation.action} requires exactly \${expectedTargets} target IDs.`,
        });
      }
      if (new Set(operation.targetIds).size !== operation.targetIds.length) {
        context.addIssue({ code: "custom", path: ["targetIds"], message: "Target IDs must be unique." });
      }
    }),
  }).strict(),
  z.object({
    ...base,
    operationType: z.literal("FILING_SUBMISSION"),
    operation: z.object({
      legalEntityId: identifier,
      jurisdictionCode: z.string().trim().min(2).max(16),
      filingType: z.string().trim().min(2).max(100),
      contentDigest: digestSchema,
      environment: z.enum(["SANDBOX", "PRODUCTION"]),
    }).strict(),
  }).strict(),
  z.object({
    ...base,
    operationType: z.literal("PAYMENT"),
    operation: z.object({
      currency: z.string().regex(/^[A-Z]{3}$/),
      amountMinor: z.string().regex(/^[1-9][0-9]{0,17}$/),
      recipientReference: z.string().trim().min(1).max(200),
      purpose: z.string().trim().min(4).max(500),
      environment: z.enum(["SANDBOX", "PRODUCTION"]),
    }).strict(),
  }).strict(),
  z.object({
    ...base,
    operationType: z.literal("PRIVILEGE_CHANGE"),
    operation: z.object({
      action: z.enum(["GRANT", "REVOKE"]),
      targetUserId: identifier,
      permission: z.string().trim().min(3).max(100),
    }).strict(),
  }).strict(),
]);

export type ExecutionAuthorizationRequest = z.infer<typeof executionAuthorizationRequestSchema>;
export type ExecutionOperationType = ExecutionAuthorizationRequest["operationType"];

function canonicalize(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return "{" + entries.map(([key, item]) => JSON.stringify(key) + ":" + canonicalize(item)).join(",") + "}";
}

/** Digest the exact validated operation parameters; never hash raw request text. */
export function digestExecutionOperation(
  operationType: ExecutionOperationType,
  operation: ExecutionAuthorizationRequest["operation"],
): string {
  return createHash("sha256")
    .update(canonicalize({ operationType, operation }))
    .digest("hex");
}

export function executionAuthorizationExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + 15 * 60 * 1000);
}
