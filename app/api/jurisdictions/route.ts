import { NextResponse } from "next/server";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { jurisdictionRepository } from "@/lib/db/jurisdiction-repository";
import { jurisdictionCreateSchema } from "@/lib/validation/jurisdiction";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";

export async function GET() {
	const context = await getWorkspaceContext();
	if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
	if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
	if (!context.principal.permissions.includes("jurisdictions:read")) {
		return NextResponse.json({ error: "Jurisdiction access denied." }, { status: 403 });
	}
	return NextResponse.json({ data: await jurisdictionRepository.list(context.principal.workspaceId) });
}

export async function POST(request: Request) {
	if (hasInvalidRequestOrigin(request)) {
		return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
	}

	const context = await getWorkspaceContext();
	if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
	if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
	if (!context.principal.permissions.includes("jurisdictions:write")) {
		return NextResponse.json({ error: "Jurisdiction management permission required." }, { status: 403 });
	}

	const parsed = jurisdictionCreateSchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: "Validation failed.", issues: parsed.error.flatten() }, { status: 422 });
	}

	const data = await jurisdictionRepository.create({
		...parsed.data,
	}, context.principal);
	return NextResponse.json({ data }, { status: 201 });
}
