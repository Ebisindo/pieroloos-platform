import { ClientIntakeForm } from "@/components/forms/ClientIntakeForm";
import { getRequestTranslator } from "@/lib/i18n/request";

export default async function NewClientPage() {
  const t = await getRequestTranslator();
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">{t("app.intake.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{t("app.intake.title")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{t("app.intake.description")}</p>
      </div>
      <ClientIntakeForm />
    </div>
  );
}
