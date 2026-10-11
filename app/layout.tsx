import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { BootLayer } from "@/components/shell/BootLayer";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { getRequestLocale } from "@/lib/i18n/request";
import { locales } from "@/lib/i18n/config";
import { getSiteUrl } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: siteUrl } : {}),
  title: {
    default: "PieroloOS — Business Intelligence & Formation Platform",
    template: "%s | PieroloOS",
  },
  description:
    "From Business Idea to Business Infrastructure. Structured business formation, compliance, research, and professional-service workflows.",
  // Private by default; public marketing pages opt in with their own robots metadata.
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  return (
    <html lang={locales[locale].htmlLang} dir={locales[locale].direction} className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <BootLayer>
            <AppShell>{children}</AppShell>
          </BootLayer>
        </LocaleProvider>
      </body>
    </html>
  );
}
