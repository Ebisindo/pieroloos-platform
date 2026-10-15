import Link from "next/link";
import { notFound } from "next/navigation";
import { ExportInstitutionDirectory } from "@/components/admin/ExportInstitutionDirectory";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";
import { prisma } from "@/lib/db/prisma";

export default async function ExportInstitutionsPage() {
  const actor = await getCurrentPlatformActor();
  if (!actor?.isSuperAdmin) notFound();

  const records = await prisma.exportInstitution.findMany({
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    include: { evidence: { orderBy: { observedAt: "desc" }, take: 5 } },
  });
  const initialData = records.map((record) => ({
    id: record.id,
    officialName: record.officialName,
    acronym: record.acronym,
    countryCode: record.countryCode,
    category: record.category,
    scope: record.scope,
    relationshipStatus: record.relationshipStatus,
    verificationStatus: record.verificationStatus,
    officialWebsite: record.officialWebsite,
    createdAt: record.createdAt.toISOString(),
    evidence: record.evidence.map((item) => ({
      id: item.id,
      sourceTitle: item.sourceTitle,
      evidenceClass: item.evidenceClass,
      verifiedAt: item.verifiedAt?.toISOString() ?? null,
    })),
  }));

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">SUPER ADMINISTRATOR</p>
          <h1>Global Export Institution Directory</h1>
          <p>Manage prospective export-promotion and trade institutions across countries and regions. All new records remain private and unconfirmed.</p>
        </div>
        <div className="page-header-actions">
          <Link className="button button-secondary" href="/admin/dashboard">Back to control centre</Link>
        </div>
      </header>
      <div className="glass-panel">
        <p><strong>Governance notice:</strong> A directory entry is not an endorsement or formal partnership. Public profile publication and logo use remain unauthorized unless separately approved in writing.</p>
      </div>
      <ExportInstitutionDirectory initialData={initialData} />
    </div>
  );
}
