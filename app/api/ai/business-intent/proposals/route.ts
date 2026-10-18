import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { businessIntentInputSchema } from "@/lib/domain/business-intent-proposal";
import { analyzeBusinessIntent, BusinessIntentProviderError } from "@/lib/services/business-intent-provider";
import { assertBusinessIntentEntitlement, BUSINESS_INTENT_ENTITLEMENT_KEY } from "@/lib/services/business-intent-entitlement";

const analysisRateLimit = { name: "business-intent-analysis", limit: 5, windowMs: 60_000 };

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!context.principal) {
    return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  }
  if (!context.principal.permissions.includes("formation:write")) {
    return NextResponse.json({ error: "Business formation write permission required." }, { status: 403 });
  }

  const limited = await enforceRateLimit(analysisRateLimit, context.userId);
  if (limited) return limited;

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (rawBody.length > 50_000) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = businessIntentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid business-intent input.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const principal = context.principal;
  const now = new Date();

  try {
    await withAuthorizedWorkspaceTransaction(principal, "formation:write", async (transaction) => {
      await assertBusinessIntentEntitlement(transaction, principal.organizationId, now);
      if (parsed.data.clientId) {
        const client = await transaction.client.findFirst({
          where: {
            id: parsed.data.clientId,
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
          },
          select: { id: true },
        });
        if (!client) throw new Error("INTENT_CLIENT_NOT_FOUND");
      }
    });
  } catch (error) {
    const response = entitlementOrClientError(error);
    if (response) return response;
    if (isSerializationConflict(error)) {
      return NextResponse.json({ error: "Workspace changed during authorization. Retry the request." }, { status: 409 });
    }
    console.error("Business-intent preflight failed.", safeErrorCode(error));
    return NextResponse.json({ error: "Unable to authorize business-intent analysis." }, { status: 500 });
  }

  let analysis;
  try {
    analysis = await analyzeBusinessIntent(parsed.data);
  } catch (error) {
    if (error instanceof BusinessIntentProviderError) {
      if (error.kind === "NOT_CONFIGURED") {
        return NextResponse.json({ error: "AI proposal generation is not configured for this environment." }, { status: 503 });
      }
      if (error.kind === "TIMEOUT") {
        return NextResponse.json({ error: "AI proposal generation timed out. Retry the request." }, { status: 504 });
      }
      if (error.kind === "INVALID_RESPONSE") {
        return NextResponse.json({ error: "The AI provider returned an invalid proposal. No proposal was saved." }, { status: 502 });
      }
      return NextResponse.json({ error: "AI proposal generation is temporarily unavailable." }, { status: 502 });
    }
    console.error("Business-intent analysis failed.", safeErrorCode(error));
    return NextResponse.json({ error: "AI proposal generation is temporarily unavailable." }, { status: 502 });
  }

  const inputDigest = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
  // Caller-provided claims remain unverified. Evidence references are resolved against
  // server-owned records inside the authorized write transaction below.
  const submittedEvidenceIds = [...new Set(parsed.data.knownFacts.map((fact) => fact.evidenceId).filter((id): id is string => Boolean(id)))];

  try {
    const proposal = await withAuthorizedWorkspaceTransaction(
      principal,
      "formation:write",
      async (transaction) => {
        // Re-check entitlement, usage and client scope immediately before writes;
        // the provider call is outside the transaction to avoid holding DB locks.
        await assertBusinessIntentEntitlement(transaction, principal.organizationId, new Date());
        if (parsed.data.clientId) {
          const client = await transaction.client.findFirst({
            where: {
              id: parsed.data.clientId,
              organizationId: principal.organizationId,
              workspaceId: principal.workspaceId,
            },
            select: { id: true },
          });
          if (!client) throw new Error("INTENT_CLIENT_NOT_FOUND");
        }

        const trustedEvidence = submittedEvidenceIds.length === 0 ? [] : await transaction.evidence.findMany({
          where: { id: { in: submittedEvidenceIds }, reviewStatus: "VERIFIED", evidenceClass: { in: ["E3", "E4", "E3_PRIMARY", "E4_CROSS_VERIFIED"] }, documents: { some: { workspaceId: principal.workspaceId, ...(parsed.data.clientId ? { clientId: parsed.data.clientId } : {}), status: "AVAILABLE", scanStatus: "CLEAN", reviewStatus: "VERIFIED", deletedAt: null } } },
          select: { id: true, title: true, source: true, sourceType: true, publicationDate: true, retrievedAt: true, evidenceClass: true, reviewStatus: true, jurisdictionId: true, documents: { where: { workspaceId: principal.workspaceId, ...(parsed.data.clientId ? { clientId: parsed.data.clientId } : {}), status: "AVAILABLE", scanStatus: "CLEAN", reviewStatus: "VERIFIED", deletedAt: null }, select: { id: true, clientId: true, workspaceId: true, checksum: true }, take: 1 } },
        });
        if (trustedEvidence.length !== submittedEvidenceIds.length || trustedEvidence.some((evidence) => !evidence.retrievedAt || !evidence.source?.trim() || !evidence.documents.length)) {
          throw new Error("INTENT_EVIDENCE_NOT_TRUSTED");
        }
        const trustedEvidenceReferences = trustedEvidence.map((evidence) => ({ id: evidence.id, title: evidence.title, source: evidence.source, sourceType: evidence.sourceType, publicationDate: evidence.publicationDate?.toISOString() ?? null, retrievedAt: evidence.retrievedAt?.toISOString() ?? null, evidenceClass: evidence.evidenceClass, reviewStatus: evidence.reviewStatus, jurisdictionId: evidence.jurisdictionId, documentId: evidence.documents[0]?.id ?? null, documentChecksum: evidence.documents[0]?.checksum ?? null }));
        const submittedClaims = parsed.data.knownFacts.map((fact) => ({ statement: fact.statement, evidenceId: fact.evidenceId ?? null, verificationState: fact.evidenceId ? (trustedEvidenceReferences.some((evidence) => evidence.id === fact.evidenceId) ? "SOURCE_VERIFIED_RECORD" : "UNVERIFIED") : "UNVERIFIED" }));
        const created = await transaction.businessIntentProposal.create({
          data: {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            clientId: parsed.data.clientId ?? null,
            createdByUserId: principal.userId,
            status: "PROPOSED",
            version: 1,
            inputDigest,
            proposal: analysis.proposal as unknown as Prisma.InputJsonValue,
            evidenceReferences: { claims: submittedClaims, trustedSources: trustedEvidenceReferences } as unknown as Prisma.InputJsonValue,
            provider: analysis.provider,
            providerModel: analysis.model,
          },
        });

        await transaction.billingUsageEvent.create({
          data: {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            entitlementKey: BUSINESS_INTENT_ENTITLEMENT_KEY,
            quantity: 1,
            unit: "proposal",
            idempotencyKey: `business-intent-proposal:${created.id}`,
            metadata: {
              proposalId: created.id,
              provider: analysis.provider,
              model: analysis.model,
              inputDigest,
            },
          },
        });

        await transaction.activity.create({
          data: {
            workspaceId: principal.workspaceId,
            actorId: principal.userId,
            type: "CREATED",
            title: "Business intent proposal created",
            summary: "Unapproved planning proposal saved for human review.",
            metadata: {
              proposalId: created.id,
              status: created.status,
              version: created.version,
              inputDigest,
              provider: analysis.provider,
              model: analysis.model,
            },
          },
        });

        return created;
      },
    );

    return NextResponse.json({ data: proposal }, { status: 201 });
  } catch (error) {
    const response = entitlementOrClientError(error);
    if (response) return response;
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
    }
    if (isSerializationConflict(error)) {
      return NextResponse.json({ error: "A concurrent update changed the usage limit or workspace state. Retry the request." }, { status: 409 });
    }
    console.error("Business-intent proposal persistence failed.", safeErrorCode(error));
    return NextResponse.json({ error: "Unable to save the business-intent proposal." }, { status: 500 });
  }
}

function entitlementOrClientError(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
    return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
  }
  if (error instanceof Error && error.message === "AI_ENTITLEMENT_REQUIRED") {
    return NextResponse.json({ error: "The active plan does not include AI business-intent analysis." }, { status: 403 });
  }
  if (error instanceof Error && error.message === "AI_USAGE_LIMIT_REACHED") {
    return NextResponse.json({ error: "The AI business-intent analysis limit has been reached for this billing period." }, { status: 429 });
  }
  if (error instanceof Error && error.message === "INTENT_CLIENT_NOT_FOUND") {
    return NextResponse.json({ error: "Client not found in the active workspace." }, { status: 404 });
  }
  if (error instanceof Error && error.message === "INTENT_EVIDENCE_NOT_TRUSTED") {
    return NextResponse.json({ error: "One or more evidence references are unknown, unverified, revoked, or outside the active workspace/client. Submit claims as unverified or attach eligible evidence first." }, { status: 422 });
  }
  return null;
}

function isSerializationConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === "P2034";
}

function safeErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error &&
    typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return error instanceof Error ? error.name : "unknown";
}
