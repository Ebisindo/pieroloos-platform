import { ModuleBanner } from "@/components/ui/ModuleBanner";
import { EvidenceNetworkIllustration } from "@/components/illustrations/EvidenceNetworkIllustration";
import { EmptyState, GlassPanel } from "@/components/ui/primitives";
import { getRequestTranslator } from "@/lib/i18n/request";

export default async function Page() {
  const t = await getRequestTranslator();
  return (
    <div className="page-stack">
      <ModuleBanner
        eyebrow={t("app.reports.eyebrow")}
        title={t("app.reports.title")}
        description={t("ui.banner.reportsDescription")}
        visual="evidence"
      />
      <GlassPanel>
        <div className="p-4 sm:p-6"><EvidenceNetworkIllustration /></div>
        <EmptyState
          title={t("app.reports.emptyTitle")}
          description={t("app.reports.emptyDescription")}
        />
      </GlassPanel>
    </div>
  );
}
