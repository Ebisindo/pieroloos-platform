import { afterEach, describe, expect, it, vi } from "vitest";
import { createCorrelationId, logOperationalEvent } from "@/lib/observability/logger";

describe("operational logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits structured allow-listed fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const correlationId = createCorrelationId();

    logOperationalEvent({
      event: "health_check_succeeded",
      level: "info",
      correlationId,
      dependency: "database",
      outcome: "ok",
      durationMs: 3.6,
    });

    expect(JSON.parse(String(info.mock.calls[0][0]))).toEqual({
      event: "health_check_succeeded",
      level: "info",
      correlationId,
      dependency: "database",
      outcome: "ok",
      durationMs: 4,
    });
  });

  it("does not serialize arbitrary fields or invalid correlation IDs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const correlationId = createCorrelationId();

    logOperationalEvent({
      event: "dependency_check_failed",
      level: "warn",
      correlationId: "forged\nsecret",
      dependency: "database",
      outcome: "degraded",
    });

    const output = String(warn.mock.calls[0][0]);
    expect(output).not.toContain("secret");
    expect(JSON.parse(output).correlationId).not.toBe("forged\nsecret");
  });

  it("clamps negative duration and never logs exception objects", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logOperationalEvent({
      event: "health_check_failed",
      level: "error",
      correlationId: createCorrelationId(),
      dependency: "database",
      outcome: "failed",
      durationMs: -5,
    });

    const output = String(error.mock.calls[0][0]);
    expect(JSON.parse(output).durationMs).toBe(0);
    expect(output).not.toContain("stack");
  });
});
