import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return NextResponse.json({
    error: "Transition endpoint requires authenticated ControlPlaneService integration.",
    actionId: id,
  }, { status: 501 });
}
