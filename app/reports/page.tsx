import { ModuleBanner } from "@/components/ui/ModuleBanner";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { ReportWorkspace } from "@/components/reports/ReportWorkspace";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { reportRepository } from "@/lib/db/report-repository";
import { getRequestTranslator } from "@/lib/i18n/request";

function parseDocument(content: string | null) {
  if (!content) return null;
  try {
    const value: unknown = JSON.parse(content);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.title !== "string" || typeof record.clientId !== "string" || typeof record.generatedAt !== "string" || typeof record.disclaimer !== "string" || !Array.isArray(record.sections)) return null;
    const sections = record.sections.filter((section): section is { id: string; title: string; content: string } =>
      Boolean(section) && typeof section === "object" &&
      typeof (section as Record<string, unknown>).id === "string" &&
      typeof (section as Record<string, unknown>).title === "string" &&
      typeof (section as Record<string, unknown>).content === "string");
    return { title: record.title, clientId: record.clientId, generatedAt: record.generatedAt, disclaimer: record.disclaimer, sections };
  } catch { return null; }
}

export default async function ReportsPage() {
  const t = await getRequestTranslator();
  const context = await getWorkspaceContext();
  if (!context.userId) return <WorkspaceAccessState title={t("app.clients.signInTitle")} description={t("app.clients.signInDescription")} href="/signin?callbackUrl=/reports" action={t("navigation.signIn")} />;
  if (!context.activeWorkspace || !context.principal) return <WorkspaceAccessState title={t("app.clients.workspaceRequired")} description={t("app.clients.workspaceDescription")} />;
  if (!context.principal.permissions.includes("reports:read")) return <WorkspaceAccessState title={t("app.clients.accessRequired")} description={t("app.clients.accessDescription")} href="/command-center" action={t("navigation.businessFormation")} />;

  const canWrite = context.principal.permissions.includes("reports:write");
  const [reports, clients] = await Promise.all([
    reportRepository.listWorkspaceReports(context.principal),
    canWrite ? reportRepository.listReportClients(context.principal) : Promise.resolve([]),
  ]);
  const initialReports = reports.map((report) => ({ ...report, document: parseDocument(report.content) }));
  return (
    <main className="page-stack">
      <ModuleBanner eyebrow={t("app.reports.eyebrow")} title={t("app.reports.title")} description={t("reports.managerDescription")} visual="evidence" />
      <ReportWorkspace initialReports={initialReports} clients={clients} canWrite={canWrite} />
    </main>
  );
}
