import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthenticatedUserId } from "@/lib/auth/professional-partner-session";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withProfessionalPartnerGrantTransaction, isPartnerGrantDenied } from "@/lib/auth/professional-partner-grant";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { clientId } = await params;

  try {
    const data = await withProfessionalPartnerGrantTransaction({
      userId,
      clientId,
      capability: "COMPLIANCE_READ",
      action: "PARTNER_COMPLIANCE_OVERVIEW_READ",
      resourceId: clientId,
    }, async (tx, grant) => {
      const obligations = await tx.complianceObligation.findMany({
        where: {
          clientId,
          workspaceId: grant.workspaceId,
          organizationId: grant.organizationId,
        },
        select: {
          id: true, title: true, description: true, type: true, status: true,
          dueAt: true, completedAt: true, requiresEvidence: true,
          professionalReviewRequired: true, professionalReviewCompleted: true,
          updatedAt: true,
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      });
      return {
        obligations,
        summary: {
          total: obligations.length,
          overdue: obligations.filter((item) => item.status === "OVERDUE").length,
          completed: obligations.filter((item) => ["COMPLETE", "COMPLETED", "COMPLIANT"].includes(item.status)).length,
          awaitingReview: obligations.filter((item) => item.status === "IN_REVIEW" || (item.professionalReviewRequired && !item.professionalReviewCompleted)).length,
        },
      };
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (isPartnerGrantDenied(error)) return NextResponse.json({ error: "Compliance access is not available under an active professional partner grant." }, { status: 403 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Grant or compliance scope changed concurrently. Retry the request." }, { status: 409 });
    console.error("Professional partner compliance read failed.");
    return NextResponse.json({ error: "Unable to read the authorized compliance overview." }, { status: 500 });
  }
}
