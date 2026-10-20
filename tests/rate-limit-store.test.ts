import { afterEach, describe, expect, it, vi } from "vitest";
import { RedisRestRateLimitStore } from "@/lib/http/rate-limit";

describe("RedisRestRateLimitStore", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses an atomic Lua counter and returns shared count/reset time", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ result: [2, 1_800_000_000_000] }), { status: 200 }),
    );
    const store = new RedisRestRateLimitStore("https://redis.example.test", "test-token", fetcher);
    await expect(store.hit("portal-read:user-1", 60_000, 0)).resolves.toEqual({
      count: 2,
      resetAt: 1_800_000_000_000,
    });

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://redis.example.test");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-token");
    const command = JSON.parse(String(init?.body)) as string[];
    expect(command[0]).toBe("EVAL");
    expect(command[1]).toContain("redis.call('INCR'");
    expect(command[1]).toContain("redis.call('PEXPIRE'");
    expect(command[1]).toContain("redis.call('TIME')");
    expect(command[3]).toMatch(/^pieroloos:rate-limit:[a-f0-9]{64}$/);
    expect(command[4]).toBe("60000");
  });

  it("rejects non-HTTPS remote endpoints", () => {
    expect(() => new RedisRestRateLimitStore("http://redis.example.test", "token")).toThrow(/HTTPS/);
  });

  it("rejects missing credentials", () => {
    expect(() => new RedisRestRateLimitStore("https://redis.example.test", " ")).toThrow(/token is required/);
  });

  it("fails safely when the shared store is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("unavailable", { status: 503 }));
    const store = new RedisRestRateLimitStore("https://redis.example.test", "test-token", fetcher);
    await expect(store.hit("subject", 1000, 0)).rejects.toThrow(/HTTP 503/);
  });

  it("rejects malformed counter responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ result: "unexpected" }), { status: 200 }),
    );
    const store = new RedisRestRateLimitStore("https://redis.example.test", "test-token", fetcher);
    await expect(store.hit("subject", 1000, 0)).rejects.toThrow(/invalid counter result/);
  });
});
