import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import {
  withClientPortalGrantTransaction,
  type ClientPortalPrincipal,
} from "@/lib/auth/client-portal-access";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { getS3ObjectStorage } from "@/lib/storage/s3-object-storage";

export async function listWorkspacePortalClients(principal: WorkspacePrincipal) {
  return withAuthorizedWorkspaceTransaction(principal, "client:read", async (transaction) => {
    const now = new Date();
    const clients = await transaction.client.findMany({
      where: {
        workspaceId: principal.workspaceId,
        organizationId: principal.organizationId,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        organizationName: true,
        email: true,
        portalAccessGrants: {
          select: {
            id: true,
            canViewStatus: true,
            canViewTasks: true,
            canUploadEvidence: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
            user: { select: { email: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        engagements: {
          where: { workspaceId: principal.workspaceId },
          select: {
            tasks: {
              select: { id: true, title: true, status: true, portalVisible: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        formationPlans: {
          where: { workspaceId: principal.workspaceId },
          select: {
            stages: {
              select: {
                tasks: {
                  select: { id: true, title: true, status: true, portalVisible: true },
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        },
        complianceObligations: {
          where: { workspaceId: principal.workspaceId },
          select: { id: true, title: true, status: true, portalVisible: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ organizationName: "asc" }, { name: "asc" }],
    });

    return clients.map((client) => ({
      id: client.id,
      displayName: client.organizationName
        || client.name
        || [client.firstName, client.lastName].filter(Boolean).join(" ")
        || "Client",
      email: client.email,
      grants: client.portalAccessGrants.map((grant) => ({
        ...grant,
        active: !grant.revokedAt && (!grant.expiresAt || grant.expiresAt > now),
      })),
      resources: [
        ...client.engagements.flatMap((engagement) => engagement.tasks.map((task) => ({
          id: task.id,
          type: "TASK" as const,
          title: task.title,
          status: task.status,
          visible: task.portalVisible,
        }))),
        ...client.formationPlans.flatMap((plan) => plan.stages.flatMap((stage) =>
          stage.tasks.map((task) => ({
            id: task.id,
            type: "FORMATION_TASK" as const,
            title: task.title,
            status: task.status,
            visible: task.portalVisible,
          })),
        )),
        ...client.complianceObligations.map((obligation) => ({
          id: obligation.id,
          type: "OBLIGATION" as const,
          title: obligation.title,
          status: obligation.status,
          visible: obligation.portalVisible,
        })),
      ],
    }));
  });
}

export async function createClientPortalGrant(
  clientId: string,
  email: string,
  principal: WorkspacePrincipal,
) {
  const normalizedEmail = email.trim().toLowerCase();
  return withAuthorizedWorkspaceTransaction(principal, "client:write", async (transaction) => {
    const client = await transaction.client.findFirst({
      where: { id: clientId, workspaceId: principal.workspaceId, organizationId: principal.organizationId },
      select: { id: true, email: true },
    });
    if (!client) throw new Error("CLIENT_NOT_FOUND");
    if (!client.email?.trim()) throw new Error("CLIENT_EMAIL_REQUIRED");
    if (client.email.trim().toLowerCase() !== normalizedEmail) throw new Error("CLIENT_PORTAL_EMAIL_MISMATCH");

    const existingUser = await transaction.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true },
    });
    const user = existingUser ?? await transaction.user.create({
      data: { email: normalizedEmail },
      select: { id: true },
    });

    const existing = await transaction.clientPortalGrant.findUnique({
      where: { clientId_userId: { clientId: client.id, userId: user.id } },
      select: { id: true },
    });
    const grant = existing
      ? await transaction.clientPortalGrant.update({
          where: { id: existing.id },
          data: {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            grantedByUserId: principal.userId,
            canViewStatus: true,
            canViewTasks: true,
            canUploadEvidence: true,
            revokedAt: null,
            expiresAt: null,
          },
        })
      : await transaction.clientPortalGrant.create({
          data: {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            clientId: client.id,
            userId: user.id,
            grantedByUserId: principal.userId,
          },
        });

    await transaction.clientPortalAuditEvent.create({
      data: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: client.id,
        grantId: grant.id,
        actorUserId: principal.userId,
        action: "ACCESS_GRANTED",
      },
    });
    return grant;
  });
}

export async function listClientPortalGrants(clientId: string, principal: WorkspacePrincipal) {
  return withAuthorizedWorkspaceTransaction(principal, "client:read", async (transaction) => {
    const client = await transaction.client.findFirst({
      where: { id: clientId, workspaceId: principal.workspaceId, organizationId: principal.organizationId },
      select: { id: true },
    });
    if (!client) throw new Error("CLIENT_NOT_FOUND");

    return transaction.clientPortalGrant.findMany({
      where: { clientId: client.id, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
      select: {
        id: true,
        userId: true,
        canViewStatus: true,
        canViewTasks: true,
        canUploadEvidence: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function revokeClientPortalGrant(
  clientId: string,
  grantId: string,
  principal: WorkspacePrincipal,
) {
  return withAuthorizedWorkspaceTransaction(principal, "client:write", async (transaction) => {
    const grant = await transaction.clientPortalGrant.findFirst({
      where: {
        id: grantId,
        clientId,
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
      },
      select: { id: true, clientId: true, revokedAt: true },
    });
    if (!grant) throw new Error("CLIENT_PORTAL_GRANT_NOT_FOUND");
    if (grant.revokedAt) return { id: grant.id, revokedAt: grant.revokedAt };

    const revokedAt = new Date();
    await transaction.clientPortalGrant.update({
      where: { id: grant.id },
      data: { revokedAt },
    });
    await transaction.clientPortalAuditEvent.create({
      data: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: grant.clientId,
        grantId: grant.id,
        actorUserId: principal.userId,
        action: "ACCESS_REVOKED",
      },
    });
    return { id: grant.id, revokedAt };
  });
}

export async function setClientPortalTaskVisibility(
  clientId: string,
  input: { resourceType: "TASK" | "FORMATION_TASK" | "OBLIGATION"; resourceId: string; visible: boolean },
  principal: WorkspacePrincipal,
) {
  return withAuthorizedWorkspaceTransaction(principal, "client:write", async (transaction) => {
    const client = await transaction.client.findFirst({
      where: { id: clientId, workspaceId: principal.workspaceId, organizationId: principal.organizationId },
      select: { id: true },
    });
    if (!client) throw new Error("CLIENT_NOT_FOUND");

    let changedId: string | null = null;
    if (input.resourceType === "TASK") {
      const task = await transaction.task.findFirst({
        where: {
          id: input.resourceId,
          workspaceId: principal.workspaceId,
          engagement: { clientId: client.id },
        },
        select: { id: true },
      });
      if (task) {
        await transaction.task.update({ where: { id: task.id }, data: { portalVisible: input.visible } });
        changedId = task.id;
      }
    } else if (input.resourceType === "FORMATION_TASK") {
      const task = await transaction.formationTask.findFirst({
        where: {
          id: input.resourceId,
          formationStage: {
            formationPlan: { clientId: client.id, workspaceId: principal.workspaceId },
          },
        },
        select: { id: true },
      });
      if (task) {
        await transaction.formationTask.update({
          where: { id: task.id },
          data: { portalVisible: input.visible },
        });
        changedId = task.id;
      }
    } else {
      const obligation = await transaction.complianceObligation.findFirst({
        where: {
          id: input.resourceId,
          workspaceId: principal.workspaceId,
          organizationId: principal.organizationId,
          clientId: client.id,
        },
        select: { id: true },
      });
      if (obligation) {
        await transaction.complianceObligation.update({
          where: { id: obligation.id },
          data: { portalVisible: input.visible },
        });
        changedId = obligation.id;
      }
    }

    if (!changedId) throw new Error("CLIENT_PORTAL_RESOURCE_NOT_FOUND");
    await transaction.clientPortalAuditEvent.create({
      data: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: client.id,
        actorUserId: principal.userId,
        action: input.visible ? "RESOURCE_PUBLISHED" : "RESOURCE_UNPUBLISHED",
        resourceId: changedId,
        metadata: { resourceType: input.resourceType },
      },
    });
    return { resourceId: changedId, visible: input.visible };
  });
}

export async function getClientPortalOverview(principal: ClientPortalPrincipal) {
  return withClientPortalGrantTransaction(principal, "VIEW_STATUS", async (transaction) => {
    const grant = await transaction.clientPortalGrant.findUniqueOrThrow({
      where: { id: principal.clientPortalGrantId },
      select: { canViewTasks: true },
    });
    const client = await transaction.client.findFirst({
      where: {
        id: principal.clientId,
        workspaceId: principal.workspaceId,
        organizationId: principal.organizationId,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        organizationName: true,
        engagements: {
          where: { workspaceId: principal.workspaceId },
          select: {
            id: true,
            service: true,
            status: true,
            dueAt: true,
            updatedAt: true,
            tasks: {
              where: { portalVisible: true },
              select: {
                id: true,
                title: true,
                status: true,
                dueAt: true,
                completedAt: true,
              },
              orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
            },
          },
          orderBy: { updatedAt: "desc" },
        },
        formationPlans: {
          where: { workspaceId: principal.workspaceId },
          select: {
            id: true,
            status: true,
            jurisdictionName: true,
            updatedAt: true,
            stages: {
              select: {
                id: true,
                title: true,
                status: true,
                order: true,
                tasks: {
                  where: { portalVisible: true },
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    completedAt: true,
                    order: true,
                    evidenceRequirements: {
                      where: { required: true },
                      select: { label: true, satisfied: true },
                    },
                  },
                  orderBy: { order: "asc" },
                },
              },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { updatedAt: "desc" },
        },
        complianceObligations: {
          where: { workspaceId: principal.workspaceId, portalVisible: true },
          select: {
            id: true,
            title: true,
            status: true,
            dueAt: true,
            requiresEvidence: true,
            professionalReviewRequired: true,
            professionalReviewCompleted: true,
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        },
      },
    });
    if (!client) throw new Error("CLIENT_PORTAL_CLIENT_NOT_FOUND");

    const documents = await transaction.document.findMany({
      where: {
        workspaceId: principal.workspaceId,
        clientId: client.id,
        uploadedByUserId: principal.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        rootDocumentId: true,
        version: true,
        name: true,
        documentType: true,
        reviewStatus: true,
        status: true,
        scanStatus: true,
        createdAt: true,
        rootDocument: { select: { latestVersion: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    await transaction.clientPortalAuditEvent.create({
      data: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: client.id,
        grantId: principal.clientPortalGrantId,
        actorUserId: principal.userId,
        action: "PORTAL_STATUS_VIEWED",
      },
    });

    return {
      client: {
        id: client.id,
        displayName: client.organizationName
          ?? client.name
          ?? [client.firstName, client.lastName].filter(Boolean).join(" ")
          ?? "Client",
      },
      engagements: client.engagements.map(({ tasks, ...engagement }) => ({
        ...engagement,
        tasks: grant.canViewTasks ? tasks : [],
      })),
      formationPlans: grant.canViewTasks ? client.formationPlans : [],
      obligations: grant.canViewTasks ? client.complianceObligations : [],
      documents: documents
        .filter((document) => document.version === document.rootDocument.latestVersion)
        .map(({ rootDocument: _rootDocument, ...document }) => document),
      nextActions: grant.canViewTasks
        ? [
            ...client.formationPlans.flatMap((plan) => plan.stages.flatMap((stage) =>
              stage.tasks.flatMap((task) => task.evidenceRequirements
                .filter((requirement) => !requirement.satisfied)
                .map((requirement) => ({
                  id: `${task.id}:${requirement.label}`,
                  title: `Provide ${requirement.label}`,
                  relatedTask: task.title,
                })),
              ),
            )),
            ...client.complianceObligations
              .filter((obligation) =>
                obligation.requiresEvidence &&
                !["COMPLETE", "COMPLETED", "COMPLIANT", "WAIVED", "NOT_APPLICABLE"].includes(obligation.status),
              )
              .map((obligation) => ({
                id: `${obligation.id}:evidence`,
                title: `Provide evidence for ${obligation.title}`,
                relatedTask: null,
              })),
          ]
        : [],
    };
  });
}

export async function listClientPortalDocuments(principal: ClientPortalPrincipal) {
  return withClientPortalGrantTransaction(principal, "VIEW_STATUS", async (transaction) => {
    const documents = await transaction.document.findMany({
      where: {
        workspaceId: principal.workspaceId,
        clientId: principal.clientId,
        uploadedByUserId: principal.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        rootDocumentId: true,
        version: true,
        name: true,
        documentType: true,
        reviewStatus: true,
        status: true,
        scanStatus: true,
        createdAt: true,
        rootDocument: { select: { latestVersion: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    await transaction.clientPortalAuditEvent.create({
      data: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: principal.clientId,
        grantId: principal.clientPortalGrantId,
        actorUserId: principal.userId,
        action: "PORTAL_EVIDENCE_LISTED",
      },
    });
    return documents
      .filter((document) => document.version === document.rootDocument.latestVersion)
      .map(({ rootDocument: _rootDocument, ...document }) => document);
  });
}

export async function assertPortalDocumentAccess(
  principal: ClientPortalPrincipal,
  documentId: string,
) {
  return withClientPortalGrantTransaction(principal, "VIEW_STATUS", async (transaction) => {
    const document = await transaction.document.findFirst({
      where: {
        id: documentId,
        workspaceId: principal.workspaceId,
        clientId: principal.clientId,
        uploadedByUserId: principal.userId,
        status: "AVAILABLE",
        scanStatus: "CLEAN",
        deletedAt: null,
      },
      select: {
        id: true,
        rootDocumentId: true,
        version: true,
        name: true,
        storageKey: true,
        rootDocument: { select: { latestVersion: true } },
      },
    });
    if (!document || document.version !== document.rootDocument.latestVersion) {
      throw new Error("CLIENT_PORTAL_DOCUMENT_NOT_FOUND");
    }
    await transaction.clientPortalAuditEvent.create({
      data: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: principal.clientId,
        grantId: principal.clientPortalGrantId,
        actorUserId: principal.userId,
        action: "DOCUMENT_DOWNLOAD_REQUESTED",
        resourceId: document.id,
      },
    });
    await transaction.documentAccessEvent.create({
      data: {
        documentId: document.id,
        workspaceId: principal.workspaceId,
        actorUserId: principal.userId,
        action: "PORTAL_DOWNLOAD_URL_ISSUED",
        metadata: { expiresInSeconds: 300 },
      },
    });
    const { rootDocument: _rootDocument, ...safeDocument } = document;
    return safeDocument;
  });
}

export async function createClientPortalDocumentDownloadUrl(
  principal: ClientPortalPrincipal,
  documentId: string,
) {
  const document = await assertPortalDocumentAccess(principal, documentId);
  return getS3ObjectStorage().createDownloadUrl(document.storageKey, {
    expiresInSeconds: 300,
    filename: document.name,
  });
}
