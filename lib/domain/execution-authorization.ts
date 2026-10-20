import { createHash } from "node:crypto";
import { z } from "zod";

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/i, "Expected a SHA-256 digest.");
const identifier = z.string().trim().min(1).max(200);

const base = {
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/),
  confirmExactOperation: z.literal(true),
};

const graphNodeSchema = z.object({
  name: z.string().trim().min(2).max(200),
  nodeType: z.enum(["COMPANY", "PERSON", "TRUST", "PARTNERSHIP", "BRANCH", "BANKING_RELATIONSHIP", "LICENSE", "TAX_REGISTRATION", "OTHER"]),
  jurisdictionCode: z.string().trim().min(2).max(16).optional(),
  entityType: z.string().trim().max(100).optional(),
  registrationNumber: z.string().trim().max(200).optional(),
}).strict();

const graphChangesSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  nodeType: z.enum(["COMPANY", "PERSON", "TRUST", "PARTNERSHIP", "BRANCH", "BANKING_RELATIONSHIP", "LICENSE", "TAX_REGISTRATION", "OTHER"]).optional(),
  jurisdictionCode: z.string().trim().min(2).max(16).nullable().optional(),
  entityType: z.string().trim().max(100).nullable().optional(),
  registrationNumber: z.string().trim().max(200).nullable().optional(),
}).strict();

const relationshipSchema = z.object({
  relation: z.enum(["OWNS", "CONTROLS", "SUBSIDIARY_OF", "BRANCH_OF", "BANKS_WITH", "LICENSED_BY", "TAX_REGISTERED_WITH", "RELATED_TO"]),
  ownershipPercent: z.number().min(0).max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict().superRefine((relationship, context) => {
  if (relationship.ownershipPercent !== undefined &&
    relationship.relation !== "OWNS" && relationship.relation !== "CONTROLS") {
    context.addIssue({
      code: "custom",
      path: ["ownershipPercent"],
      message: "Ownership percentage is only valid for ownership/control relationships.",
    });
  }
});

const graphOperationSchema = z.object({
  action: z.enum(["CREATE_NODE", "UPDATE_NODE", "ARCHIVE_NODE", "CREATE_RELATIONSHIP", "ARCHIVE_RELATIONSHIP"]),
  targetIds: z.array(identifier).max(2),
  clientId: identifier.optional(),
  node: graphNodeSchema.optional(),
  changes: graphChangesSchema.optional(),
  relationship: relationshipSchema.optional(),
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
  if (operation.action === "CREATE_NODE" && (!operation.node || operation.changes || operation.relationship)) {
    context.addIssue({ code: "custom", path: ["node"], message: "Create-node operations require only a node snapshot." });
  }
  if (operation.action === "UPDATE_NODE" && (
    !operation.changes || !Object.values(operation.changes).some((value) => value !== undefined) ||
    operation.node || operation.relationship
  )) {
    context.addIssue({ code: "custom", path: ["changes"], message: "Update-node operations require at least one explicit change." });
  }
  if (operation.action === "CREATE_RELATIONSHIP" && (!operation.relationship || operation.node || operation.changes)) {
    context.addIssue({ code: "custom", path: ["relationship"], message: "Create-relationship operations require a relationship snapshot." });
  }
  if ((operation.action === "ARCHIVE_NODE" || operation.action === "ARCHIVE_RELATIONSHIP") &&
    (operation.node || operation.changes || operation.relationship)) {
    context.addIssue({ code: "custom", path: ["action"], message: "Archive operations cannot include mutation payloads." });
  }
});

export const executionAuthorizationRequestSchema = z.discriminatedUnion("operationType", [
  z.object({
    ...base,
    operationType: z.literal("CORPORATE_GRAPH_MUTATION"),
    operation: graphOperationSchema,
  }).strict(),
  z.object({
    ...base,
    operationType: z.literal("FILING_SUBMISSION"),
    operation: z.object({
      legalEntityId: identifier,
      jurisdictionCode: z.string().trim().min(2).max(16),
      filingType: z.string().trim().min(2).max(100),
      contentDigest: digestSchema,
      environment: z.literal("SANDBOX"),
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
      environment: z.literal("SANDBOX"),
    }).strict(),
  }).strict(),
  z.object({
    ...base,
    operationType: z.literal("PRIVILEGE_CHANGE"),
    operation: z.object({
      action: z.enum(["ASSIGN_ROLE", "REVOKE_MEMBERSHIP"]),
      targetUserId: identifier,
      role: z.enum(["OWNER", "ADMIN", "ADVISOR", "MEMBER", "VIEWER"]),
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
