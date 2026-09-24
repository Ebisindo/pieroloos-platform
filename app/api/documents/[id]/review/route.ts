import { NextResponse } from "next/server";
import { documentReviewSchema } from "@/lib/validation/document";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = documentReviewSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Production integration point for authenticated repository + audit service.
  return NextResponse.json({
    data: {
      documentId: id,
      ...parsed.data,
      status: "READY_FOR_REPOSITORY_UPDATE",
    },
  });
}
