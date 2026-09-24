import { NextResponse } from "next/server";
import { activityRepository } from "@/lib/db/activity-repository";
import { activityService } from "@/lib/services/activity-service";
import { activityCreateSchema } from "@/lib/validation/engagement";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const { id } = await context.params;
  return NextResponse.json({ data: await activityRepository.listByEngagement(id) });
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    const parsed = activityCreateSchema.safeParse({ ...body, engagementId: id });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 }
      );
    }
    return NextResponse.json({
      data: await activityService.create(parsed.data),
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to record activity." }, { status: 400 });
  }
}
