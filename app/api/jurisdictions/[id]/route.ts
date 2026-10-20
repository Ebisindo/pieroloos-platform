import { NextResponse } from "next/server";
import { jurisdictionRepository } from "@/lib/db/jurisdiction-repository";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const context = await getWorkspaceContext();
	if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
	if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
	if (!context.principal.permissions.includes("jurisdictions:read")) {
		return NextResponse.json({ error: "Jurisdiction access denied." }, { status: 403 });
	}

	const { id } = await params;
	const jurisdiction = await jurisdictionRepository.findById(id, context.principal.workspaceId);
	if (!jurisdiction) return NextResponse.json({ error: "Jurisdiction not found." }, { status: 404 });
	return NextResponse.json({ data: jurisdiction });
}
