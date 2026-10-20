import { ModuleBanner } from "@/components/ui/ModuleBanner";
import { OperationalFlowIllustration } from "@/components/illustrations/OperationalFlowIllustration";
import { EmptyState, GlassPanel } from "@/components/ui/primitives";
import { getRequestTranslator } from "@/lib/i18n/request";

export default async function Page() {
  const t = await getRequestTranslator();
  return (
    <div className="page-stack">
      <ModuleBanner
        eyebrow={t("engagements.eyebrow")}
        title={t("engagements.title")}
        description={t("ui.banner.engagementsDescription")}
        visual="flow"
      />
      <GlassPanel>
        <div className="p-4 sm:p-6"><OperationalFlowIllustration /></div>
        <EmptyState
          title={t("engagements.emptyTitle")}
          description={t("engagements.emptyDescription")}
        />
      </GlassPanel>
    </div>
  );
}
