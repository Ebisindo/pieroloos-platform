import { notFound, redirect } from "next/navigation";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await getCurrentPlatformActor();
  if (!actor) redirect("/signin?callbackUrl=%2Fadmin%2Fdashboard");
  if (!actor.isSuperAdmin && actor.permissions.length === 0) notFound();
  return children;
}
