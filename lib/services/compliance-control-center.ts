import { buildComplianceControlSnapshot } from "../domain/compliance-control";
import { evaluateEscalation, type EscalationPolicy } from "../domain/escalation";

export function buildControlCenter(input: {
  obligations: Parameters<typeof buildComplianceControlSnapshot>[0];
  escalationPolicy: EscalationPolicy;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const snapshot = buildComplianceControlSnapshot(input.obligations, now);
  const escalations = snapshot.alerts
    .map(alert => ({ alert, decision: evaluateEscalation(alert, input.escalationPolicy) }))
    .filter(item => item.decision.shouldEscalate);

  return { snapshot, escalations };
}
