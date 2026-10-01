import { JurisdictionCard } from "@/components/jurisdiction/JurisdictionCard";
import { JurisdictionLensWorkflow } from "@/components/jurisdiction/JurisdictionLensWorkflow";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { jurisdictionRepository } from "@/lib/db/jurisdiction-repository";
import { prisma } from "@/lib/db/prisma";

export default async function JurisdictionsPage() {
  const context = await getWorkspaceContext();
  if (!context.userId) {
    return (
      <WorkspaceAccessState
        title="Sign in to use Jurisdiction Lens"
        description="Jurisdiction intelligence and comparisons are available to authenticated workspace members."
        href="/signin?callbackUrl=/jurisdictions"
        action="Sign in"
      />
    );
  }
  if (!context.activeWorkspace || !context.principal) {
    return <WorkspaceAccessState title="Workspace selection required" description="Select an active workspace to use Jurisdiction Lens." />;
  }
  if (!context.principal.permissions.includes("jurisdictions:read")) {
    return <WorkspaceAccessState title="Jurisdiction access required" description="Your workspace role cannot view jurisdiction intelligence." />;
  }

  const workspaceId = context.principal.workspaceId;
  const jurisdictions = await jurisdictionRepository.list(workspaceId);
  const profiles = await prisma.businessProfile.findMany({
    where: { client: { workspaceId } },
    select: {
      id: true,
      businessName: true,
      client: { select: { name: true, organizationName: true, firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const profileOptions = profiles.map((profile) => ({
    id: profile.id,
    name: profile.businessName
      ?? profile.client.organizationName
      ?? profile.client.name
      ?? [profile.client.firstName, profile.client.lastName].filter(Boolean).join(" ")
      ?? "Business profile",
  }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">
          Corporate Intelligence
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Jurisdiction Lens
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          Evidence-aware jurisdiction intelligence for structured comparison and professional review.
        </p>
      </header>

      <div className="rounded-2xl border border-amber-300/10 bg-amber-300/[0.035] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
          Decision-support boundary
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Analytical indicators are internal comparison outputs. They are not legal, tax, regulatory, banking or other professional conclusions.
        </p>
      </div>

      {!workspaceId ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-8 text-sm text-slate-400">
          Select or create a workspace to load jurisdiction intelligence.
        </div>
      ) : jurisdictions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          No jurisdiction records have been loaded yet for this workspace.
        </div>
      ) : (
        <JurisdictionLensWorkflow
          jurisdictions={jurisdictions}
          profiles={profileOptions}
          canCompare={context.principal.permissions.includes("jurisdictions:write")}
          canCreateFormation={context.principal.permissions.includes("formation:write")}
        />
      )}
    </div>
  );
}
