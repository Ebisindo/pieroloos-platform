import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { getRequestTranslator } from "@/lib/i18n/request";

export default async function Page() {
  const t = await getRequestTranslator();
  return (
    <div className="page-stack">
      <PageHeader eyebrow={t("app.reports.eyebrow")} title={t("app.reports.title")} description={t("app.reports.description")} />
      <EmptyState
        title={t("app.reports.emptyTitle")}
        description={t("app.reports.emptyDescription")}
      />
    </div>
  );
}
