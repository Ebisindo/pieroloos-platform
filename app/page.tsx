import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_WORKSPACE_SETTINGS, workspaceSettingsSchema } from "@/lib/validation/settings";

export default async function Home() {
  const context = await getWorkspaceContext();
  if (!context.userId) redirect("/signin?callbackUrl=/");
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
