import type { ControlActionStatus, OperationalAction } from "@/lib/domain/action-control";

export type ActionQuery = {
  organizationId: string;
  workspaceId: string;
  status?: ControlActionStatus;
  assigneeUserId?: string;
  sourceSignalId?: string;
};

export interface ActionRepository {
  create(action: OperationalAction): Promise<OperationalAction>;
  findById(id: string): Promise<OperationalAction | null>;
  findMany(query: ActionQuery): Promise<OperationalAction[]>;
  update(action: OperationalAction): Promise<OperationalAction>;
}
