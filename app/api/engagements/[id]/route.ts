import { NextResponse } from "next/server";
import { engagementRepository } from "@/lib/db/engagement-repository";
import { engagementService } from "@/lib/services/engagement-service";
import { engagementUpdateSchema } from "@/lib/validation/engagement";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const { id } = await context.params;
  const engagement = await engagementRepository.findById(id);
  if (!engagement) return NextResponse.json({ error: "Engagement not found." }, { status: 404 });
  return NextResponse.json({ data: engagement });
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  try {
    const parsed = engagementUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 }
      );
    }
    return NextResponse.json({ data: await engagementService.update(id, parsed.data) });
  } catch {
    return NextResponse.json({ error: "Unable to update engagement." }, { status: 400 });
  }
}
