import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createClientFromIntake } from "@/lib/services/client-intake-service";
import { clientIntakeSchema } from "@/lib/validation/intake";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("formation:write")) {
    return NextResponse.json({ error: "Formation write permission required." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = clientIntakeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const client = await createClientFromIntake(parsed.data, context.principal);

    return NextResponse.json(
      {
        data: {
          ...client,
          legalName: client.name,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Unable to create client from intake.",
      },
      { status: 500 },
    );
  }
}
