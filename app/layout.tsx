import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { BootLayer } from "@/components/shell/BootLayer";

export const metadata: Metadata = {
  title: {
    default: "PieroloOS",
    template: "%s | PieroloOS",
  },
  description:
    "Corporate Intelligence & Formation Platform for structured business formation, compliance, research, and professional-service workflows.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <BootLayer>
          <AppShell>{children}</AppShell>
        </BootLayer>
      </body>
    </html>
  );
}
