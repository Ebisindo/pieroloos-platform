import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import {
  withClientPortalGrantTransaction,
  type ClientPortalPrincipal,
} from "@/lib/auth/client-portal-access";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { getS3ObjectStorage } from "@/lib/storage/s3-object-storage";

type PortalResourceType = "TASK" | "FORMATION_TASK" | "OBLIGATION";

async function isPublishedPortalResource(
  transaction: Prisma.TransactionClient,
  scope: { organizationId: string; workspaceId: string; clientId: string },
  resourceType: PortalResourceType,
  resourceId: string,
) {
  if (resourceType === "TASK") {
    return Boolean(await transaction.task.findFirst({
      where: {
        id: resourceId,
        workspaceId: scope.workspaceId,
        portalVisible: true,
        engagement: { clientId: scope.clientId, workspaceId: scope.workspaceId },
      },
      select: { id: true },
    }));
  }
  if (resourceType === "FORMATION_TASK") {
    return Boolean(await transaction.formationTask.findFirst({
      where: {
        id: resourceId,
        portalVisible: true,
        formationStage: { formationPlan: { clientId: scope.clientId, workspaceId: scope.workspaceId } },
      },
      select: { id: true },
    }));
  }
  if (resourceType !== "OBLIGATION") return false;
  return Boolean(await transaction.complianceObligation.findFirst({
    where: {
      id: resourceId,
      organizationId: scope.organizationId,
      clientId: scope.clientId,
      workspaceId: scope.workspaceId,
      portalVisible: true,
    },
    select: { id: true },
  }));
}

function hashAcknowledgmentContent(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function recordPortalInteractionAudit(
  transaction: Prisma.TransactionClient,
  scope: { organizationId: string; workspaceId: string; clientId: string },
  actorUserId: string,
  action: string,
  interactionId: string,
  metadata?: Prisma.InputJsonValue,
  grantId?: string,
) {
  await transaction.clientPortalAuditEvent.create({
    data: {
      ...scope,
      grantId,
      actorUserId,
      action,
      resourceId: interactionId,
      metadata,
    },
  });
}

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

export async function listClientPortalInteractions(principal: ClientPortalPrincipal) {
  return withClientPortalGrantTransaction(principal, "VIEW_STATUS", async (transaction) => {
    const grant = await transaction.clientPortalGrant.findUniqueOrThrow({
      where: { id: principal.clientPortalGrantId },
      select: { canViewTasks: true },
    });
    const interactions = await transaction.clientPortalInteraction.findMany({
      where: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: principal.clientId,
        ...(grant.canViewTasks ? {} : { kind: "MESSAGE", resourceId: null }),
      },
      select: {
        id: true,
        kind: true,
        status: true,
        resourceType: true,
        resourceId: true,
        parentInteractionId: true,
        body: true,
        contentHash: true,
        reviewNote: true,
        reviewedAt: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
        parentInteraction: { select: { body: true, kind: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    await transaction.clientPortalAuditEvent.create({
      data: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: principal.clientId,
        grantId: principal.clientPortalGrantId,
        actorUserId: principal.userId,
        action: "PORTAL_INTERACTIONS_VIEWED",
      },
    });
    return interactions;
  });
}

export async function createClientPortalInteraction(
  principal: ClientPortalPrincipal,
  input:
    | { kind: "MESSAGE"; content: string; resourceType?: PortalResourceType; resourceId?: string }
    | { kind: "COMPLETION_SUBMISSION"; content: string; resourceType: PortalResourceType; resourceId: string }
    | { kind: "ACKNOWLEDGMENT"; requestId: string },
) {
  const capability = input.kind === "MESSAGE" && !input.resourceId ? "VIEW_STATUS" : "VIEW_TASKS";
  return withClientPortalGrantTransaction(principal, capability, async (transaction) => {
    if (input.kind === "ACKNOWLEDGMENT") {
      const request = await transaction.clientPortalInteraction.findFirst({
        where: {
          id: input.requestId,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          clientId: principal.clientId,
          kind: "ACKNOWLEDGMENT_REQUEST",
          status: "PENDING",
        },
        select: { id: true, body: true, resourceType: true, resourceId: true },
      });
      if (!request) throw new Error("CLIENT_PORTAL_ACKNOWLEDGMENT_REQUEST_NOT_FOUND");
      if (!request.resourceType || !request.resourceId ||
        !await isPublishedPortalResource(
          transaction,
          principal,
          request.resourceType as PortalResourceType,
          request.resourceId,
        )) {
        throw new Error("CLIENT_PORTAL_RESOURCE_NOT_FOUND");
      }

      const occurredAt = new Date();
      const contentHash = hashAcknowledgmentContent(request.body);
      await transaction.clientPortalInteraction.update({
        where: { id: request.id },
        data: { status: "ACKNOWLEDGED" },
      });
      const acknowledgment = await transaction.clientPortalInteraction.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          clientId: principal.clientId,
          grantId: principal.clientPortalGrantId,
          actorUserId: principal.userId,
          kind: "ACKNOWLEDGMENT",
          status: "ACKNOWLEDGED",
          resourceType: request.resourceType,
          resourceId: request.resourceId,
          parentInteractionId: request.id,
          body: request.body,
          contentHash,
          createdAt: occurredAt,
        },
        select: { id: true, kind: true, status: true, body: true, contentHash: true, createdAt: true },
      });
      await recordPortalInteractionAudit(
        transaction,
        principal,
        principal.userId,
        "CLIENT_ACKNOWLEDGED",
        acknowledgment.id,
        { requestId: request.id, contentHash },
        principal.clientPortalGrantId,
      );
      return acknowledgment;
    }

    if (input.kind === "COMPLETION_SUBMISSION" || input.resourceId) {
      if (!input.resourceType || !input.resourceId ||
        !await isPublishedPortalResource(transaction, principal, input.resourceType, input.resourceId)) {
        throw new Error("CLIENT_PORTAL_RESOURCE_NOT_FOUND");
      }
    }

    if (input.kind === "COMPLETION_SUBMISSION") {
      const pending = await transaction.clientPortalInteraction.findFirst({
        where: {
          clientId: principal.clientId,
          kind: "COMPLETION_SUBMISSION",
          status: "PENDING",
          resourceType: input.resourceType,
          resourceId: input.resourceId,
        },
        select: { id: true },
      });
      if (pending) throw new Error("CLIENT_PORTAL_SUBMISSION_PENDING");
    }

    const interaction = await transaction.clientPortalInteraction.create({
      data: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: principal.clientId,
        grantId: principal.clientPortalGrantId,
        actorUserId: principal.userId,
        kind: input.kind,
        status: input.kind === "COMPLETION_SUBMISSION" ? "PENDING" : null,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        body: input.content,
      },
      select: { id: true, kind: true, status: true, body: true, resourceType: true, resourceId: true, createdAt: true },
    });
    await recordPortalInteractionAudit(
      transaction,
      principal,
      principal.userId,
      input.kind === "MESSAGE" ? "CLIENT_MESSAGE_SENT" : "CLIENT_COMPLETION_SUBMITTED",
      interaction.id,
      undefined,
      principal.clientPortalGrantId,
    );
    return interaction;
  });
}

export async function listWorkspaceClientPortalInteractions(
  clientId: string,
  principal: WorkspacePrincipal,
) {
  return withAuthorizedWorkspaceTransaction(principal, "client:read", async (transaction) => {
    const client = await transaction.client.findFirst({
      where: {
        id: clientId,
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
      },
      select: { id: true },
    });
    if (!client) throw new Error("CLIENT_NOT_FOUND");
    return transaction.clientPortalInteraction.findMany({
      where: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: client.id,
      },
      select: {
        id: true,
        kind: true,
        status: true,
        resourceType: true,
        resourceId: true,
        parentInteractionId: true,
        body: true,
        contentHash: true,
        reviewNote: true,
        reviewedAt: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
        parentInteraction: { select: { body: true, kind: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
  });
}

export async function createWorkspaceClientPortalInteraction(
  clientId: string,
  principal: WorkspacePrincipal,
  input:
    | { kind: "MESSAGE"; content: string; resourceType?: PortalResourceType; resourceId?: string }
    | { kind: "ACKNOWLEDGMENT_REQUEST"; content: string; resourceType: PortalResourceType; resourceId: string },
) {
  return withAuthorizedWorkspaceTransaction(principal, "client:write", async (transaction) => {
    const client = await transaction.client.findFirst({
      where: {
        id: clientId,
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
      },
      select: { id: true },
    });
    if (!client) throw new Error("CLIENT_NOT_FOUND");
    const clientScope = { organizationId: principal.organizationId, workspaceId: principal.workspaceId, clientId: client.id };
    const activeGrant = await transaction.clientPortalGrant.findFirst({
      where: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: client.id,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (!activeGrant) throw new Error("CLIENT_PORTAL_GRANT_NOT_ACTIVE");
    if ((input.kind === "ACKNOWLEDGMENT_REQUEST" || input.resourceId) &&
      (!input.resourceType || !input.resourceId ||
        !await isPublishedPortalResource(
          transaction,
          clientScope,
          input.resourceType,
          input.resourceId,
        ))) {
      throw new Error("CLIENT_PORTAL_RESOURCE_NOT_FOUND");
    }
    const interaction = await transaction.clientPortalInteraction.create({
      data: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: client.id,
        grantId: activeGrant.id,
        actorUserId: principal.userId,
        kind: input.kind,
        status: input.kind === "ACKNOWLEDGMENT_REQUEST" ? "PENDING" : null,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        body: input.content,
      },
      select: { id: true, kind: true, status: true, body: true, resourceType: true, resourceId: true, createdAt: true },
    });
    await recordPortalInteractionAudit(
      transaction,
      clientScope,
      principal.userId,
      input.kind === "MESSAGE" ? "STAFF_MESSAGE_SENT" : "ACKNOWLEDGMENT_REQUESTED",
      interaction.id,
    );
    return interaction;
  });
}

export async function reviewClientPortalCompletionSubmission(
  clientId: string,
  interactionId: string,
  principal: WorkspacePrincipal,
  decision: "ACCEPTED" | "CHANGES_REQUESTED",
  note?: string,
) {
  return withAuthorizedWorkspaceTransaction(principal, "client:write", async (transaction) => {
    const interaction = await transaction.clientPortalInteraction.findFirst({
      where: {
        id: interactionId,
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId,
        kind: "COMPLETION_SUBMISSION",
        status: "PENDING",
      },
      select: { id: true, clientId: true },
    });
    if (!interaction) throw new Error("CLIENT_PORTAL_SUBMISSION_NOT_FOUND");
    const reviewedAt = new Date();
    const updated = await transaction.clientPortalInteraction.update({
      where: { id: interaction.id },
      data: {
        status: decision,
        reviewedByUserId: principal.userId,
        reviewedAt,
        reviewNote: note || null,
      },
      select: { id: true, status: true, reviewedAt: true, reviewNote: true },
    });
    await recordPortalInteractionAudit(
      transaction,
      { organizationId: principal.organizationId, workspaceId: principal.workspaceId, clientId: interaction.clientId },
      principal.userId,
      `COMPLETION_${decision}`,
      interaction.id,
      { note: note ?? null },
    );
    return updated;
  });
}
