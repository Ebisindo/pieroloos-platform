import { NextResponse } from "next/server";
import { engagementService } from "@/lib/services/engagement-service";
import { engagementCreateSchema } from "@/lib/validation/engagement";

export async function POST(request: Request) {
  try {
    const parsed = engagementCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 }
      );
    }
    const engagement = await engagementService.create(parsed.data);
    return NextResponse.json({ data: engagement }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create engagement." }, { status: 500 });
  }
}
