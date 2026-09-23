import "./globals.css"; import type { ReactNode } from "react"; import { AppShell } from "@/components/shell/AppShell";
export const metadata={title:"PIEROLOOS — Corporate Intelligence & Formation Platform",description:"Professional operating environment for structured corporate service workflows."};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en"><body><div className="cosmic-field" aria-hidden="true"/><AppShell>{children}</AppShell></body></html>}
