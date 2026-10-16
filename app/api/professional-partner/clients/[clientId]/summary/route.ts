import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthenticatedUserId } from "@/lib/auth/professional-partner-session";
import { withProfessionalPartnerGrantTransaction, isPartnerGrantDenied } from "@/lib/auth/professional-partner-grant";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { clientId } = await params;

  try {
    const data = await withProfessionalPartnerGrantTransaction({
      userId,
      clientId,
      capability: "CLIENT_PROFILE_READ",
      action: "PARTNER_CLIENT_SUMMARY_READ",
      resourceId: clientId,
    }, async (tx, grant) => {
      const client = await tx.client.findFirst({
        where: {
          id: clientId,
          workspaceId: grant.workspaceId,
          OR: [{ organizationId: grant.organizationId }, { organizationId: null }],
        },
        select: {
          id: true, name: true, organizationName: true, country: true, proposedBusiness: true,
          createdAt: true, updatedAt: true,
        },
      });
      if (!client) throw new Error("PROFESSIONAL_PARTNER_RESOURCE_NOT_FOUND");
      return client;
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (isPartnerGrantDenied(error)) return NextResponse.json({ error: "Client access is not available under an active professional partner grant." }, { status: 403 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_RESOURCE_NOT_FOUND") return NextResponse.json({ error: "Client not found in the authorized grant scope." }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Grant or client scope changed concurrently. Retry the request." }, { status: 409 });
    console.error("Professional partner client summary read failed.");
    return NextResponse.json({ error: "Unable to read the authorized client summary." }, { status: 500 });
  }
}
