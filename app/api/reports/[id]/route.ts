import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { reportRepository } from "@/lib/db/report-repository";

type RouteContext = { params: Promise<{ id: string }> };

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function parseReportDocument(content: string | null) {
  if (!content) return null;
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.title !== "string" || typeof record.clientId !== "string" || typeof record.generatedAt !== "string" || !Array.isArray(record.sections) || typeof record.disclaimer !== "string") return null;
    const sections = record.sections.filter((section): section is { id: string; title: string; content: string } =>
      Boolean(section) && typeof section === "object" &&
      typeof (section as Record<string, unknown>).id === "string" &&
      typeof (section as Record<string, unknown>).title === "string" &&
      typeof (section as Record<string, unknown>).content === "string");
    return { title: record.title, clientId: record.clientId, generatedAt: record.generatedAt, disclaimer: record.disclaimer, sections };
  } catch {
    return null;
  }
}

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("reports:read")) return NextResponse.json({ error: "Report read permission required." }, { status: 403 });

  const { id } = await routeContext.params;
  try {
    const report = await reportRepository.findWorkspaceReport(id, context.principal);
    if (!report) return NextResponse.json({ error: "Report not found in the active workspace." }, { status: 404 });
    const document = parseReportDocument(report.content);
    if (!document) return NextResponse.json({ error: "Stored report content is unavailable or invalid." }, { status: 422 });

    if (new URL(request.url).searchParams.get("format") === "html") {
      const sectionHtml = document.sections.map((section) =>
        `<section><h2>${escapeHtml(section.title)}</h2><pre>${escapeHtml(section.content)}</pre></section>`,
      ).join("\n");
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(document.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#172033}h1{line-height:1.2}section{border-top:1px solid #d8deea;padding:1rem 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}footer{margin-top:2rem;padding:1rem;border-top:2px solid #a7aebe;font-size:.9rem}@media print{body{margin:0;max-width:none}section{break-inside:avoid}}</style></head><body><header><h1>${escapeHtml(document.title)}</h1><p>Generated: ${escapeHtml(new Date(document.generatedAt).toISOString())}</p><p>Scope: one client record in the active workspace.</p></header>${sectionHtml}<footer>${escapeHtml(document.disclaimer)}<p>Values marked not recorded are unknown in the stored records, not proof of absence. Verify sources and obtain qualified professional review before taking consequential action.</p></footer></body></html>`;
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="pieroloos-report-${report.id}.html"`,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          "Cache-Control": "private, no-store",
        },
      });
    }

    return NextResponse.json({ data: { ...report, document } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    console.error("Unable to retrieve report.", error);
    return NextResponse.json({ error: "Unable to retrieve report." }, { status: 500 });
  }
}
