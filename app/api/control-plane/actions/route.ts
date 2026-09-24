import { NextResponse } from "next/server";

export async function GET() {
  // Production integration:
  // authenticate -> resolve workspace principal -> query ActionRepository
  // with organization/workspace scope -> return actions.
  return NextResponse.json({
    data: [],
    status: "READY_FOR_ACTION_REPOSITORY_INTEGRATION",
  });
}

export async function POST() {
  // Production integration:
  // accept a validated signal/action command, authorize, persist transactionally,
  // and append an audit event.
  return NextResponse.json({
    error: "Action command endpoint requires authenticated repository integration.",
  }, { status: 501 });
}
