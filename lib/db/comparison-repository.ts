import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { prisma } from "@/lib/db/prisma";

export const comparisonRepository = {
  create: (
    data: { businessProfileId?: string; methodologyVersion: string; criteriaJson: object; jurisdictionIds: string[]; resultsJson: object },
    principal: WorkspacePrincipal,
  ) => withAuthorizedWorkspaceTransaction(principal, "jurisdictions:write", async (transaction) => {
    const snapshot = await transaction.jurisdictionComparison.create({
      data: {
        workspaceId: principal.workspaceId,
        businessProfileId: data.businessProfileId,
        methodologyVersion: data.methodologyVersion,
        criteriaJson: JSON.stringify(data.criteriaJson),
        jurisdictionIdsJson: JSON.stringify(data.jurisdictionIds),
        resultsJson: JSON.stringify(data.resultsJson),
      },
    });
    await transaction.activity.create({
      data: {
        workspaceId: principal.workspaceId,
        actorId: principal.userId,
        type: "CREATED",
        title: "Jurisdiction comparison recorded",
        summary: "A workspace-scoped jurisdiction comparison snapshot was created.",
        metadata: { comparisonSnapshotId: snapshot.id },
      },
    });
    return snapshot;
  }),
  findById: (id: string, workspaceId: string) =>
    prisma.jurisdictionComparison.findFirst({ where: { id, workspaceId } }),
};
