import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { PublicHome } from "@/components/public/PublicHome";
import { PublicShell } from "@/components/public/PublicShell";
import { DEFAULT_WORKSPACE_SETTINGS, workspaceSettingsSchema } from "@/lib/validation/settings";
import { getSiteUrl, publicPageMetadata } from "@/lib/site";
import { getRequestLocale } from "@/lib/i18n/request";
import { createTranslator } from "@/lib/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await getRequestLocale());
  return {
    ...publicPageMetadata("/"),
    title: { absolute: t("metadata.home.title") },
    description: t("metadata.home.description"),
    openGraph: {
      title: t("metadata.home.title"),
      description: t("metadata.home.description"),
      type: "website",
    },
  };
}

export default async function Home() {
  const context = await getWorkspaceContext();
  if (!context.userId) {
    const locale = await getRequestLocale();
    const t = createTranslator(locale);
    const site = getSiteUrl();
    // Escape "<" so serialized data can never terminate the script element.
    const structuredData = site ? JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "PieroloOS",
      url: site.toString(),
      logo: new URL("/brand/pierolocorp-logo.jpg", site).toString(),
      description: t("metadata.home.description"),
    }).replace(/</g, "\\u003c") : null;
    return (
      <PublicShell>
        {structuredData ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} /> : null}
        <PublicHome />
      </PublicShell>
    );
  }
  if (!context.activeWorkspace) redirect("/command-center");

  const settings = await prisma.workspaceSettings.findUnique({
    where: { workspaceId: context.activeWorkspace.id },
    select: { defaultLandingPage: true },
  });
  const parsedSettings = settings ? workspaceSettingsSchema.safeParse({
    ...DEFAULT_WORKSPACE_SETTINGS,
    defaultLandingPage: settings.defaultLandingPage,
  }) : null;
  const landingPage = parsedSettings?.success
    ? parsedSettings.data.defaultLandingPage
    : DEFAULT_WORKSPACE_SETTINGS.defaultLandingPage;
  redirect(landingPage);
}
