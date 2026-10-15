import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { reportRepository } from "@/lib/db/report-repository";
import { reportGenerateSchema } from "@/lib/validation/report";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("reports:read")) return NextResponse.json({ error: "Report read permission required." }, { status: 403 });
  try {
    const [reports, clients] = await Promise.all([
      reportRepository.listWorkspaceReports(context.principal),
      reportRepository.listReportClients(context.principal),
    ]);
    return NextResponse.json({
      data: {
        reports: reports.map((report) => ({
          ...report,
          document: parseReport(report.content),
        })),
        clients,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    console.error("Unable to list workspace reports.", error);
    return NextResponse.json({ error: "Unable to list workspace reports." }, { status: 500 });
  }
}

function parseReport(content: string | null) {
  if (!content) return null;
  try {
    const value: unknown = JSON.parse(content);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.title !== "string" || typeof record.clientId !== "string" || typeof record.generatedAt !== "string" || !Array.isArray(record.sections) || typeof record.disclaimer !== "string") return null;
    return record;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("reports:write")) return NextResponse.json({ error: "Report write permission required." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = reportGenerateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });

  try {
    const result = await reportRepository.generateClientSummary(parsed.data.clientId, context.principal);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "REPORT_CLIENT_NOT_FOUND") return NextResponse.json({ error: "Client not found in the active workspace." }, { status: 404 });
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    console.error("Unable to generate workspace report.", error);
    return NextResponse.json({ error: "Unable to generate workspace report." }, { status: 500 });
  }
}
