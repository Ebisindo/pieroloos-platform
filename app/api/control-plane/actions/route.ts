import { NextResponse } from "next/server";
import { z } from "zod";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { listActiveOperationalActions } from "@/lib/db/operational-action-query";
import { createActionFromTrustedSignal } from "@/lib/services/trusted-action-service";

const createActionSchema = z.object({ signalId: z.string().regex(/^evidence-gap:[^:]+$/) });

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:read")) {
    return NextResponse.json({ error: "Compliance access denied." }, { status: 403 });
  }

  const actions = await listActiveOperationalActions(context.principal);
  return NextResponse.json({ data: actions });
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:write")) {
    return NextResponse.json({ error: "Compliance write permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = createActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid trusted signal ID is required." }, { status: 422 });
  }

  try {
    const result = await createActionFromTrustedSignal(parsed.data.signalId, context.principal);
    return NextResponse.json({ data: result.action }, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "TRUSTED_SIGNAL_NOT_FOUND") {
      return NextResponse.json({ error: "Trusted signal not found in the active workspace." }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to create operational action." }, { status: 500 });
  }
}
