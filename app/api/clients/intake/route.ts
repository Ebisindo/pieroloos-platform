import { NextResponse } from "next/server";
import { createClientFromIntake } from "@/lib/services/client-intake-service";
import { clientIntakeSchema } from "@/lib/validation/intake";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = clientIntakeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const client = await createClientFromIntake(parsed.data);

    return NextResponse.json({ data: client }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to create client from intake." },
      { status: 500 },
    );
  }
}
