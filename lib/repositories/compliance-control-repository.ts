export type ComplianceControlRepository = {
  listPortfolio(input: {
    organizationId: string;
    clientId?: string;
    status?: string;
    dueWithinDays?: number;
  }): Promise<unknown[]>;
  recordEscalation(input: {
    obligationId: string;
    level: number;
    reason: string;
    actorUserId?: string;
  }): Promise<unknown>;
  recordNotification(input: {
    obligationId: string;
    channel: string;
    scheduledFor: Date;
    subject: string;
    body: string;
  }): Promise<unknown>;
};
