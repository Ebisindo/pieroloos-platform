import { NextResponse } from "next/server";
import { clientRepository } from "@/lib/db/client-repository";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };
const clientUpdateSchema = z.object({
  legalName: z.string().trim().min(1).max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  residenceCountry: z.string().trim().max(100).optional(),
}).strict();

export async function GET(_: Request, context: Context) {
  const workspaceContext = await getWorkspaceContext();
  if (!workspaceContext.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!workspaceContext.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!workspaceContext.principal.permissions.includes("client:read")) {
    return NextResponse.json({ error: "Client read permission required." }, { status: 403 });
  }
  const { id } = await context.params;
  const client = await clientRepository.findById(id, workspaceContext.principal);

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  return NextResponse.json({ data: client });
}

export async function PATCH(request: Request, context: Context) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const workspaceContext = await getWorkspaceContext();
  if (!workspaceContext.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!workspaceContext.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!workspaceContext.principal.permissions.includes("client:write")) {
    return NextResponse.json({ error: "Client write permission required." }, { status: 403 });
  }
  const { id } = await context.params;
  const parsed = clientUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid client update.", issues: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const updated = await clientRepository.update(id, parsed.data, workspaceContext.principal);
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to update client.", error);
    return NextResponse.json({ error: "Unable to update client." }, { status: 500 });
  }
}
