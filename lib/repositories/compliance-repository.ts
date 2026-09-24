import type { ComplianceStatus } from "../domain/compliance";

export type ComplianceRepository = {
  listByClient(clientId: string): Promise<unknown[]>;
  findById(id: string): Promise<unknown | null>;
  updateStatus(id: string, status: ComplianceStatus, note?: string): Promise<unknown>;
  addEvidence(id: string, input: {documentId:string; evidenceClass:string; note?:string}): Promise<unknown>;
  scheduleReminder(id: string, input: {scheduledFor:Date; channel:string; message:string}): Promise<unknown>;
};
