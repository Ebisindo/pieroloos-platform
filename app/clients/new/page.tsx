import { ClientIntakeForm } from "@/components/forms/ClientIntakeForm";
import { ModuleBanner } from "@/components/ui/ModuleBanner";
import { getRequestTranslator } from "@/lib/i18n/request";

export default async function NewClientPage() {
  const t = await getRequestTranslator();
  return (
    <div className="page-stack">
      <ModuleBanner
        eyebrow={t("ui.banner.intakeEyebrow")}
        title={t("app.intake.title")}
        description={t("app.intake.description")}
        visual="evidence"
      />
      <ClientIntakeForm />
    </div>
  );
}
