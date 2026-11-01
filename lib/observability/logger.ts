import { randomUUID } from "node:crypto";

export type OperationalEvent =
  | "health_check_failed"
  | "health_check_succeeded"
  | "dependency_check_failed";

export type OperationalLevel = "info" | "warn" | "error";

export type OperationalLog = {
  event: OperationalEvent;
  level: OperationalLevel;
  correlationId: string;
  dependency?: "database" | "object_storage" | "worker";
  outcome?: "ok" | "degraded" | "failed";
  durationMs?: number;
};

/**
 * Emit a deliberately small, allow-listed operational event.
 * Never pass arbitrary request data, exception objects, headers, tokens,
 * document contents, user identifiers, or provider responses to this logger.
 */
export function createCorrelationId(): string {
  return randomUUID();
}

export function logOperationalEvent(entry: OperationalLog): void {
  const safeEntry: OperationalLog = {
    event: entry.event,
    level: entry.level,
    correlationId: /^[0-9a-f-]{36}$/i.test(entry.correlationId)
      ? entry.correlationId
      : createCorrelationId(),
    ...(entry.dependency ? { dependency: entry.dependency } : {}),
    ...(entry.outcome ? { outcome: entry.outcome } : {}),
    ...(Number.isFinite(entry.durationMs) && entry.durationMs !== undefined
      ? { durationMs: Math.max(0, Math.round(entry.durationMs)) }
      : {}),
  };

  const serialized = JSON.stringify(safeEntry);
  if (safeEntry.level === "error") console.error(serialized);
  else if (safeEntry.level === "warn") console.warn(serialized);
  else console.info(serialized);
}
