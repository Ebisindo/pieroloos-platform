import type { EvidenceDocument } from "../domain/evidence";

export interface EvidenceDocumentRepository {
  create(
    input: Omit<EvidenceDocument, "id" | "createdAt" | "updatedAt">,
  ): Promise<EvidenceDocument>;

  findById(
    organizationId: string,
    documentId: string,
  ): Promise<EvidenceDocument | null>;

  listForObligation(
    organizationId: string,
    obligationId: string,
  ): Promise<EvidenceDocument[]>;

  listForClient(
    organizationId: string,
    clientId: string,
  ): Promise<EvidenceDocument[]>;

  createVersion(input: {
    organizationId: string;
    previousVersionId: string;
    document: Omit<EvidenceDocument, "id" | "createdAt" | "updatedAt">;
  }): Promise<EvidenceDocument>;

  updateReview(input: {
    organizationId: string;
    documentId: string;
    reviewStatus: EvidenceDocument["reviewStatus"];
    reviewedByUserId: string;
  }): Promise<EvidenceDocument>;
}
