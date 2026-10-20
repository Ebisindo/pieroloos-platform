import { ShieldAlert } from "lucide-react";
import type { EvidenceGapCode } from "@/lib/domain/trust-boundary";
import { getRequestTranslator } from "@/lib/i18n/request";
import type { MessageKey } from "@/lib/i18n/messages";

export async function TrustBoundaryNotice({
  gaps,
  heading,
}: {
  gaps?: EvidenceGapCode[];
  heading?: string;
}) {
  const t = await getRequestTranslator();
  return (
    <aside className="trust-notice" aria-label={t("trust.ariaLabel")}>
      <ShieldAlert size={16} aria-hidden="true" />
      <div>
        <p className="trust-notice-title">{heading ?? t("trust.heading")}</p>
        <p>{t("trust.notice")}</p>
        {gaps?.length ? (
          <ul>
            {gaps.map((gap) => <li key={gap}>{t(`trust.gap.${gap}` as MessageKey)}</li>)}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
