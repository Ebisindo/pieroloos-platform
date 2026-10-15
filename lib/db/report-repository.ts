import { prisma } from "@/lib/db/prisma";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { assertPermission } from "@/lib/auth/workspace-access";
import { createReportDocument } from "@/lib/services/report-service";
import type { ReportDocument, ReportSection } from "@/lib/domain/report";

function text(value: string | null | undefined, fallback = "Not recorded") {
  return value?.trim() || fallback;
}

export const reportRepository = {
  async listWorkspaceReports(principal: WorkspacePrincipal) {
    assertPermission(principal, "reports:read");
    return prisma.report.findMany({
      where: { workspaceId: principal.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, title: true, format: true, status: true, createdAt: true,
        client: { select: { id: true, name: true, organizationName: true } },
        content: true,
      },
    });
  },

  async listReportClients(principal: WorkspacePrincipal) {
    assertPermission(principal, "reports:read");
    return prisma.client.findMany({
      where: { workspaceId: principal.workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { id: true, name: true, organizationName: true, proposedBusiness: true },
    });
  },

  async generateClientSummary(clientId: string, principal: WorkspacePrincipal): Promise<{ id: string; title: string; createdAt: Date; document: ReportDocument }> {
    return withAuthorizedWorkspaceTransaction(principal, "reports:write", async (tx) => {
      const client = await tx.client.findFirst({
        where: { id: clientId, workspaceId: principal.workspaceId },
        select: {
          id: true, name: true, organizationName: true, email: true, phone: true,
          country: true, proposedBusiness: true, createdAt: true, updatedAt: true,
          businessProfile: {
            select: {
              id: true, businessName: true, businessType: true, businessObjective: true,
              businessModel: true, targetMarket: true, revenueModel: true, ownershipContext: true,
              fundingStage: true, expansionObjectives: true, constraints: true, strategicNotes: true,
              operationalContext: true, data: true, version: true, updatedAt: true,
            },
          },
          engagements: {
            orderBy: { updatedAt: "desc" },
            take: 100,
            select: { id: true, service: true, status: true, nextAction: true, dueAt: true, updatedAt: true },
          },
          complianceObligations: {
            orderBy: { updatedAt: "desc" },
            take: 100,
            select: { id: true, title: true, status: true, dueAt: true, requiresEvidence: true },
          },
        },
      });
      if (!client) throw new Error("REPORT_CLIENT_NOT_FOUND");

      const profile = client.businessProfile;
      const sections: ReportSection[] = [
        {
          id: "client-overview",
          title: "Client overview",
          content: [
            `Client / organisation: ${text(client.organizationName ?? client.name)}`,
            `Proposed business: ${text(client.proposedBusiness)}`,
            `Country: ${text(client.country)}`,
            `Email: ${text(client.email)}`,
            `Phone: ${text(client.phone)}`,
            `Client record created: ${client.createdAt.toISOString()}`,
            `Client record last updated: ${client.updatedAt.toISOString()}`,
          ].join("\n"),
        },
        {
          id: "business-profile",
          title: "Business profile",
          content: profile ? [
            `Business name: ${text(profile.businessName ?? client.proposedBusiness)}`,
            `Business type: ${text(profile.businessType)}`,
            `Objective: ${text(profile.businessObjective)}`,
            `Business model: ${text(profile.businessModel)}`,
            `Target market: ${text(profile.targetMarket)}`,
            `Revenue model: ${text(profile.revenueModel)}`,
            `Ownership context: ${text(profile.ownershipContext)}`,
            `Funding stage: ${text(profile.fundingStage)}`,
            `Expansion objectives: ${text(profile.expansionObjectives)}`,
            `Risks and constraints: ${text(profile.constraints)}`,
            `Strategic notes: ${text(profile.strategicNotes)}`,
            `Operational context: ${text(profile.operationalContext)}`,
            `Profile version: ${profile.version}`,
            `Profile last updated: ${profile.updatedAt.toISOString()}`,
            "Data classification: profile information is not independently verified by report generation.",
          ].join("\n") : "No business profile record is associated with this client.",
        },
        {
          id: "engagements",
          title: "Engagement records",
          content: client.engagements.length ? client.engagements.map((engagement, index) => [
            `${index + 1}. ${engagement.service}`,
            `Status: ${engagement.status}`,
            `Next action: ${text(engagement.nextAction)}`,
            `Due date: ${engagement.dueAt?.toISOString() ?? "Not recorded"}`,
            `Last updated: ${engagement.updatedAt.toISOString()}`,
          ].join(" | ")).join("\n") : "No engagement records are associated with this client.",
        },
        {
          id: "compliance",
          title: "Compliance records",
          content: client.complianceObligations.length ? client.complianceObligations.map((item, index) => [
            `${index + 1}. ${item.title}`,
            `Recorded status: ${item.status}`,
            `Due date: ${item.dueAt?.toISOString() ?? "Not recorded"}`,
            `Evidence required: ${item.requiresEvidence ? "Yes" : "No / not specified"}`,
          ].join(" | ")).join("\n") : "No compliance obligation records are associated with this client. This does not establish that no obligations apply.",
        },
        {
          id: "data-quality",
          title: "Data scope, freshness and review",
          content: [
            "This report summarises records available in the active workspace at generation time.",
            "Values shown as not recorded are unknown in these records, not zero and not proof of absence.",
            "Report generation does not validate source documents or turn user-provided information into verified evidence.",
            "Check the original records for subsequent updates. Obtain qualified professional review for legal, tax, licensing, accounting, regulatory and compliance decisions.",
          ].join("\n"),
        },
      ];

      const document = createReportDocument({
        title: `Client summary — ${text(client.organizationName ?? client.name ?? client.proposedBusiness, "Client")}`,
        clientId: client.id,
        sections,
      });
      const report = await tx.report.create({
        data: {
          workspaceId: principal.workspaceId,
          clientId: client.id,
          title: document.title,
          format: "PIEROLOOS_CLIENT_SUMMARY_V1",
          status: "GENERATED",
          content: JSON.stringify(document),
        },
        select: { id: true, title: true, createdAt: true },
      });
      await tx.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "REPORT",
          title: "Client summary report generated",
          summary: "A client summary report was generated from workspace records.",
          metadata: { reportId: report.id, clientId: client.id, format: "PIEROLOOS_CLIENT_SUMMARY_V1" },
        },
      });
      return { ...report, document };
    });
  },

  async findWorkspaceReport(id: string, principal: WorkspacePrincipal) {
    assertPermission(principal, "reports:read");
    return prisma.report.findFirst({
      where: { id, workspaceId: principal.workspaceId },
      select: {
        id: true, title: true, format: true, status: true, createdAt: true, content: true,
        client: { select: { id: true, name: true, organizationName: true } },
      },
    });
  },
};
