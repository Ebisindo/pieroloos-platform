import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";
import { listSuccessors } from "@/lib/services/successor-continuity-service";
import { SuccessorContinuityVault } from "@/components/admin/SuccessorContinuityVault";

export const dynamic = "force-dynamic";

export default async function BusinessContinuityPage() {
  const actor = await getCurrentPlatformActor();
  if (!actor?.isSuperAdmin) notFound();
  const data = await listSuccessors(actor);
  const initialData = {
    successors: data.successors.map((item) => ({
      ...item,
      permissions: item.permissions as Record<string, boolean>,
      createdAt: item.createdAt.toISOString(),
      lastOwnerActivityAt: item.lastOwnerActivityAt.toISOString(),
      warningSentAt: item.warningSentAt?.toISOString() ?? null,
      acceptedAt: item.acceptedAt?.toISOString() ?? null,
      idVerifiedAt: item.idVerifiedAt?.toISOString() ?? null,
      mfaVerifiedAt: item.mfaVerifiedAt?.toISOString() ?? null,
      continuityCases: item.continuityCases.map((currentCase) => ({
        ...currentCase,
        createdAt: currentCase.createdAt.toISOString(),
        warningSentAt: currentCase.warningSentAt?.toISOString() ?? null,
        reviewRequiredAt: currentCase.reviewRequiredAt?.toISOString() ?? null,
      })),
    })),
    assets: data.assets.map((asset) => ({ ...asset, updatedAt: asset.updatedAt.toISOString() })),
    runbooks: data.runbooks.map((runbook) => ({ ...runbook, updatedAt: runbook.updatedAt.toISOString(), reviewedAt: runbook.reviewedAt?.toISOString() ?? null })),
  };
  return (
    <div className="page-stack">
      <nav aria-label="Breadcrumb" className="admin-breadcrumb"><Link href="/admin/dashboard">Admin control centre</Link><span aria-hidden="true">/</span><span>Settings</span><span aria-hidden="true">/</span><span>Business Continuity</span></nav>
      <SuccessorContinuityVault initialData={initialData} ownerEmail={actor.email} />
    </div>
  );
}
