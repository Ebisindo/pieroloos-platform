import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Production: load report, obligations and workspace-scoped evidence,
  // then call buildReportEvidenceSection for each included obligation.
  return NextResponse.json({ data: { reportId: id, status: "READY_FOR_REPORT_REPOSITORY_INTEGRATION" } });
}
