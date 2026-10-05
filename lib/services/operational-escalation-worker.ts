import { operationalEscalationRepository } from "@/lib/db/operational-escalation-repository";
import { EscalationService } from "@/lib/services/escalation-service";

export async function runOperationalEscalationWorker(now = new Date()) {
  const result = await new EscalationService(operationalEscalationRepository).evaluateDueActions({ now });
  return {
    evaluated: result.evaluated,
    escalatedActionIds: result.escalated.map((event) => event.actionId),
  };
}
