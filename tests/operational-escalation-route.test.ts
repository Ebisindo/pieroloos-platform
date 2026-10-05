import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/workers/escalations/route";

const runWorkerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services/operational-escalation-worker", () => ({
  runOperationalEscalationWorker: runWorkerMock,
}));

const originalSecret = process.env.OPERATIONAL_WORKER_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.OPERATIONAL_WORKER_SECRET;
  else process.env.OPERATIONAL_WORKER_SECRET = originalSecret;
  runWorkerMock.mockReset();
});

describe("operational escalation worker route", () => {
  it("requires configuration and a matching bearer secret", async () => {
    delete process.env.OPERATIONAL_WORKER_SECRET;
    expect((await POST(new Request("http://localhost/api/workers/escalations", { method: "POST" }))).status).toBe(503);

    process.env.OPERATIONAL_WORKER_SECRET = "correct-secret";
    expect((await POST(new Request("http://localhost/api/workers/escalations", {
      method: "POST",
      headers: { authorization: "Bearer incorrect-secret" },
    }))).status).toBe(401);
    expect(runWorkerMock).not.toHaveBeenCalled();
  });

  it("runs the worker only for a valid bearer secret", async () => {
    process.env.OPERATIONAL_WORKER_SECRET = "correct-secret";
    runWorkerMock.mockResolvedValue({ evaluated: 4, escalatedActionIds: ["action-1"] });

    const response = await POST(new Request("http://localhost/api/workers/escalations", {
      method: "POST",
      headers: { authorization: "Bearer correct-secret" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { evaluated: 4, escalatedActionIds: ["action-1"] } });
    expect(runWorkerMock).toHaveBeenCalledOnce();
  });
});
