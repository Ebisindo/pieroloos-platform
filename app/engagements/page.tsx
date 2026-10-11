import { getRequestTranslator } from "@/lib/i18n/request";
import { PageHeader, EmptyState } from "@/components/ui/primitives";

export default async function Page() {
  const t = await getRequestTranslator();
  return (
    <div className="page-stack">
      <PageHeader eyebrow={t("engagements.eyebrow")} title={t("engagements.title")} description={t("engagements.description")} />
      <EmptyState
        title={t("engagements.emptyTitle")}
        description={t("engagements.emptyDescription")}
      />
    </div>
  );
}
