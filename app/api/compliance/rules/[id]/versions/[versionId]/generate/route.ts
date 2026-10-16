import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { prisma } from "@/lib/db/prisma";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";

const generationSchema = z.object({
  clientId: z.string().trim().min(1).max(120),
  businessType: z.string().trim().min(1).max(120).nullable(),
  formationCompleted: z.boolean().nullable(),
  // Prevent null from being coerced to the Unix epoch before nullable handling.
  baseDate: z.preprocess((value) => value === null ? null : value, z.coerce.date().nullable()),
  factEvidence: z.array(z.object({
    key: z.enum(["BUSINESS_TYPE", "FORMATION_COMPLETED", "TRIGGER_DATE"]),
    evidenceId: z.string().trim().min(1).max(120),
  }).strict()).max(10),
}).strict().superRefine((value, context) => {
  const keys = value.factEvidence.map((item) => item.key);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["factEvidence"], message: "Each fact may have only one evidence reference." });
  }
});

const SOURCE_MAX_AGE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

type RouteContext = { params: Promise<{ id: string; versionId: string }> };

function hasEvidenceFor(input: z.infer<typeof generationSchema>, key: "BUSINESS_TYPE" | "FORMATION_COMPLETED" | "TRIGGER_DATE") {
  return input.factEvidence.some((item) => item.key === key);
}

function addDaysUtc(base: Date, days: number) {
  const due = new Date(base);
  due.setUTCDate(due.getUTCDate() + days);
  return due;
}

/**
 * Creates one obligation per client and reviewed rule version. Unknown or insufficient facts
 * never create an obligation. Evidence references must already be professionally verified,
 * active, workspace-scoped and attached to the same client's clean document.
 */
export async function POST(request: Request, routeContext: RouteContext) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:write")) {
    return NextResponse.json({ error: "Compliance write permission required." }, { status: 403 });
  }

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = generationSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid obligation-generation request.", issues: parsed.error.flatten() }, { status: 422 });

  const principal = context.principal;
  const { id, versionId } = await routeContext.params;
  const input = parsed.data;
  const now = new Date();
  const generationKey = createHash("sha256")
    .update(["compliance-rule-version", principal.organizationId, principal.workspaceId, input.clientId, versionId].join(":"))
    .digest("hex");

  try {
    const result = await withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
      const version = await transaction.complianceRuleVersion.findFirst({
        where: {
          id: versionId,
          ruleId: id,
          workspaceId: principal.workspaceId,
          rule: { organizationId: principal.organizationId, workspaceId: principal.workspaceId, active: true },
        },
        select: {
          id: true, ruleId: true, version: true, jurisdictionId: true, title: true, description: true,
          obligationType: true, sourceUrl: true, sourceAuthority: true, sourceRetrievedAt: true,
          effectiveFrom: true, effectiveThrough: true, evidenceClass: true, applicability: true,
          relativeDueDays: true, requiresEvidence: true, professionalReviewRequired: true, reviewState: true,
          reviewedByUserId: true, reviewedAt: true, reviewNote: true,
        },
      });
      if (!version) throw new Error("COMPLIANCE_RULE_VERSION_NOT_FOUND");

      const unknownReasons: string[] = [];
      if (version.reviewState !== "VERIFIED") unknownReasons.push("RULE_NOT_VERIFIED");
      if (!version.sourceRetrievedAt || version.sourceRetrievedAt > now) unknownReasons.push("SOURCE_NOT_RETRIEVED");
      if (version.sourceRetrievedAt && now.getTime() - version.sourceRetrievedAt.getTime() > SOURCE_MAX_AGE_DAYS * DAY_MS) {
        unknownReasons.push("SOURCE_REVIEW_STALE");
      }
      if (version.effectiveFrom > now || (version.effectiveThrough && version.effectiveThrough < now)) {
        unknownReasons.push("RULE_OUTSIDE_EFFECTIVE_WINDOW");
      }
      if (version.evidenceClass !== "E3" && version.evidenceClass !== "E4" &&
          version.evidenceClass !== "E3_PRIMARY" && version.evidenceClass !== "E4_CROSS_VERIFIED") {
        unknownReasons.push("RULE_EVIDENCE_INSUFFICIENT");
      }

      const applicability = version.applicability && typeof version.applicability === "object" && !Array.isArray(version.applicability)
        ? version.applicability as { businessTypes?: unknown; formationCompleted?: unknown }
        : {};
      const businessTypes = Array.isArray(applicability.businessTypes)
        ? applicability.businessTypes.filter((value): value is string => typeof value === "string")
        : [];
      const needsBusinessType = businessTypes.length > 0;
      const needsFormationState = typeof applicability.formationCompleted === "boolean";
      if (needsBusinessType && !input.businessType) unknownReasons.push("MISSING_BUSINESS_TYPE");
      if (needsFormationState && input.formationCompleted === null) unknownReasons.push("MISSING_FORMATION_STATE");
      if (version.relativeDueDays !== null && version.relativeDueDays !== undefined && !input.baseDate) {
        unknownReasons.push("MISSING_DEADLINE_TRIGGER_DATE");
      }
      if (needsBusinessType && !hasEvidenceFor(input, "BUSINESS_TYPE")) unknownReasons.push("BUSINESS_TYPE_EVIDENCE_MISSING");
      if (needsFormationState && !hasEvidenceFor(input, "FORMATION_COMPLETED")) unknownReasons.push("FORMATION_STATE_EVIDENCE_MISSING");
      if (version.relativeDueDays !== null && version.relativeDueDays !== undefined && !hasEvidenceFor(input, "TRIGGER_DATE")) {
        unknownReasons.push("DEADLINE_TRIGGER_EVIDENCE_MISSING");
      }
      if (unknownReasons.length) return { state: "UNKNOWN" as const, reasons: [...new Set(unknownReasons)] };

      const client = await transaction.client.findFirst({
        where: { id: input.clientId, workspaceId: principal.workspaceId, OR: [{ organizationId: principal.organizationId }, { organizationId: null }] },
        select: { id: true },
      });
      if (!client) throw new Error("COMPLIANCE_CLIENT_NOT_FOUND");

      if (needsBusinessType && input.businessType && businessTypes.length && !businessTypes.includes(input.businessType)) {
        return { state: "NOT_APPLICABLE" as const, reasons: ["BUSINESS_TYPE_MISMATCH"] };
      }
      if (needsFormationState && applicability.formationCompleted !== input.formationCompleted) {
        return { state: "NOT_APPLICABLE" as const, reasons: ["FORMATION_STATE_MISMATCH"] };
      }

      const evidenceIds = input.factEvidence.map((item) => item.evidenceId);
      const evidenceRows = evidenceIds.length ? await transaction.complianceEvidence.findMany({
        where: {
          id: { in: evidenceIds },
          workspaceId: principal.workspaceId,
          reviewStatus: "VERIFIED",
          OR: [{ validThrough: null }, { validThrough: { gte: now } }],
          obligation: { workspaceId: principal.workspaceId, clientId: client.id, organizationId: principal.organizationId },
          document: { workspaceId: principal.workspaceId, clientId: client.id, status: "AVAILABLE", scanStatus: "CLEAN", deletedAt: null },
        },
        select: { id: true, evidenceClass: true, documentId: true, validThrough: true, factKey: true, factValue: true },
      }) : [];
      const expectedFactValue = (key: "BUSINESS_TYPE" | "FORMATION_COMPLETED" | "TRIGGER_DATE") => {
        if (key === "BUSINESS_TYPE") return input.businessType;
        if (key === "FORMATION_COMPLETED") return input.formationCompleted === null ? null : String(input.formationCompleted);
        return input.baseDate?.toISOString() ?? null;
      };
      const verifiedById = new Map(evidenceRows.filter((row) =>
        ["E3", "E4", "E3_PRIMARY", "E4_CROSS_VERIFIED"].includes(row.evidenceClass) &&
        (!row.validThrough || row.validThrough >= now)
      ).map((row) => [row.id, row]));
      const missingEvidence = input.factEvidence.filter((item) => {
        const evidence = verifiedById.get(item.evidenceId);
        return !evidence || evidence.factKey !== item.key || evidence.factValue !== expectedFactValue(item.key);
      }).map((item) => item.key);
      if (missingEvidence.length) {
        return { state: "UNKNOWN" as const, reasons: ["FACT_EVIDENCE_UNVERIFIED"], missingEvidence: [...new Set(missingEvidence)] };
      }

      const existing = await transaction.complianceObligation.findFirst({
        where: { workspaceId: principal.workspaceId, generationKey },
      });
      if (existing) return { state: "GENERATED" as const, alreadyExists: true, obligation: existing };

      const dueAt = version.relativeDueDays !== null && version.relativeDueDays !== undefined && input.baseDate
        ? addDaysUtc(input.baseDate, version.relativeDueDays)
        : null;
      const facts = {
        provenance: "REVIEWED_RULE_GENERATION",
        ruleId: version.ruleId,
        ruleVersionId: version.id,
        ruleVersion: version.version,
        sourceAuthority: version.sourceAuthority,
        sourceUrl: version.sourceUrl,
        sourceRetrievedAt: version.sourceRetrievedAt?.toISOString() ?? null,
        sourceReview: {
          state: version.reviewState,
          reviewerUserId: version.reviewedByUserId,
          reviewedAt: version.reviewedAt?.toISOString() ?? null,
          reviewNote: version.reviewNote,
          evidenceClass: version.evidenceClass,
        },
        confidenceState: version.reviewState === "VERIFIED" && ["E3", "E4", "E3_PRIMARY", "E4_CROSS_VERIFIED"].includes(version.evidenceClass)
          ? "PRIMARY_OR_CROSS_VERIFIED"
          : "INSUFFICIENT",
        applicability: { jurisdictionId: version.jurisdictionId, businessType: input.businessType, formationCompleted: input.formationCompleted },
        factEvidence: input.factEvidence.map((item) => ({
          key: item.key,
          evidenceId: item.evidenceId,
          documentId: evidenceRows.find((row) => row.id === item.evidenceId)?.documentId ?? null,
        })),
        dueDateBasis: version.relativeDueDays !== null && version.relativeDueDays !== undefined && input.baseDate
          ? { kind: "RELATIVE_DAYS", baseDate: input.baseDate.toISOString(), relativeDueDays: version.relativeDueDays, timezone: "UTC" }
          : { kind: "NOT_ESTABLISHED" },
        assessedAt: now.toISOString(),
      };

      const created = await transaction.complianceObligation.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          clientId: client.id,
          jurisdictionId: version.jurisdictionId,
          sourceRuleId: version.ruleId,
          sourceRuleVersionId: version.id,
          generationKey,
          title: version.title,
          description: version.description,
          type: version.obligationType,
          dueAt,
          status: "NOT_STARTED",
          requiresEvidence: version.requiresEvidence,
          professionalReviewRequired: version.professionalReviewRequired,
          ownerUserId: principal.userId,
        },
      });
      await transaction.complianceDeadlineSnapshot.create({
        data: {
          obligationId: created.id, workspaceId: principal.workspaceId, sequence: 1,
          previousDueAt: null, dueAt, reason: "Initial deadline from reviewed compliance rule version",
          sourceRuleVersionId: version.id, assessmentState: "APPLICABLE",
          assessmentFacts: facts as unknown as Prisma.InputJsonValue,
          actorUserId: principal.userId,
        },
      });
      await transaction.complianceActivity.create({
        data: {
          obligationId: created.id, action: "RULE_OBLIGATION_GENERATED", actorUserId: principal.userId,
          note: "Generated from a verified, sourced compliance rule version and reviewed evidence.",
          metadata: {
            generationKey, ruleId: version.ruleId, ruleVersionId: version.id, ruleVersion: version.version,
            sourceUrl: version.sourceUrl, deadlineSnapshotSequence: 1, factEvidenceIds: evidenceIds,
          },
        },
      });
      await transaction.complianceRuleActivity.create({
        data: {
          organizationId: principal.organizationId, workspaceId: principal.workspaceId, ruleId: version.ruleId,
          ruleVersionId: version.id, actorUserId: principal.userId, action: "OBLIGATION_GENERATED",
          note: "A client obligation was generated from this reviewed rule version.",
          metadata: { obligationId: created.id, clientId: client.id, generationKey },
        },
      });
      return { state: "GENERATED" as const, alreadyExists: false, obligation: created };
    });

    if (result.state === "UNKNOWN") return NextResponse.json({ data: result, mayGenerateObligation: false }, { status: 409 });
    if (result.state === "NOT_APPLICABLE") return NextResponse.json({ data: result, mayGenerateObligation: false }, { status: 200 });
    return NextResponse.json({ data: result.obligation, alreadyExists: result.alreadyExists }, { status: result.alreadyExists ? 200 : 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
    if (error instanceof Error && error.message === "COMPLIANCE_RULE_VERSION_NOT_FOUND") return NextResponse.json({ error: "Rule version not found in the active workspace." }, { status: 404 });
    if (error instanceof Error && error.message === "COMPLIANCE_CLIENT_NOT_FOUND") return NextResponse.json({ error: "Client not found in the active workspace." }, { status: 404 });
    if (typeof error === "object" && error !== null && "code" in error && ["P2002", "P2034"].includes(String((error as { code?: unknown }).code))) {
      const existing = await prisma.complianceObligation.findFirst({
        where: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          clientId: input.clientId,
          sourceRuleVersionId: versionId,
          generationKey,
        },
      });
      if (existing) return NextResponse.json({ data: existing, alreadyExists: true }, { status: 200 });
      return NextResponse.json({ error: "Concurrent obligation generation conflicted. Retry the request." }, { status: 409 });
    }
    console.error("Compliance obligation generation failed.");
    return NextResponse.json({ error: "Unable to generate the compliance obligation." }, { status: 500 });
  }
}
