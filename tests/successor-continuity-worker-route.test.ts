import { afterEach, describe, expect, it, vi } from "vitest";

const { runWorkerMock } = vi.hoisted(() => ({ runWorkerMock: vi.fn() }));
const originalSecret = process.env.OPERATIONAL_WORKER_SECRET;

vi.mock("@/lib/services/successor-continuity-worker", () => ({ runSuccessorContinuityWorker: runWorkerMock }));

import { POST } from "@/app/api/workers/successor-continuity/route";

afterEach(() => {
  if (originalSecret === undefined) delete process.env.OPERATIONAL_WORKER_SECRET;
  else process.env.OPERATIONAL_WORKER_SECRET = originalSecret;
  runWorkerMock.mockReset();
});

describe("successor continuity worker route", () => {
  it("requires a configured worker secret", async () => {
    delete process.env.OPERATIONAL_WORKER_SECRET;
    const response = await POST(new Request("http://localhost/api/workers/successor-continuity", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(runWorkerMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid worker secret", async () => {
    process.env.OPERATIONAL_WORKER_SECRET = "scheduler-secret";
    const response = await POST(new Request("http://localhost/api/workers/successor-continuity", {
      method: "POST", headers: { authorization: "Bearer wrong" },
    }));
    expect(response.status).toBe(401);
    expect(runWorkerMock).not.toHaveBeenCalled();
  });
});
