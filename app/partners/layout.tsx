import type { Metadata } from "next";
import { createTranslator } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/request";
import { publicPageMetadata } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await getRequestLocale());
  return {
    ...publicPageMetadata("/partners"),
    title: t("metadata.partners.title"),
    description: t("metadata.partners.description"),
    openGraph: {
      title: `${t("metadata.partners.title")} | PieroloOS`,
      description: t("metadata.partners.description"),
      type: "website",
    },
  };
}

export default async function PartnersLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
