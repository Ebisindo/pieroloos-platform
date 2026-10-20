import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export type RateLimitPolicy = { name: string; limit: number; windowMs: number };
export type RateLimitStore = {
  hit(key: string, windowMs: number, now: number): Promise<{ count: number; resetAt: number }>;
};

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowMs: number, now: number) {
    if (this.windows.size > 10_000) {
      for (const [k, v] of this.windows) if (v.resetAt <= now) this.windows.delete(k);
    }
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.windows.set(key, fresh);
      return fresh;
    }
    current.count += 1;
    return current;
  }
}

/** Shared, atomic fixed-window counters using an Upstash-compatible Redis REST endpoint. */
export class RedisRestRateLimitStore implements RateLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error("Rate-limit Redis REST URL must use HTTPS");
    }
    if (!token.trim()) throw new Error("Rate-limit Redis REST token is required");
  }

  async hit(key: string, windowMs: number, _now: number) {
    if (!Number.isSafeInteger(windowMs) || windowMs < 1) {
      throw new Error("Rate-limit window must be a positive safe integer");
    }

    // Hash the policy/subject pair so Redis keys do not reveal user or IP identifiers.
    const redisKey = `pieroloos:rate-limit:${createHash("sha256").update(key).digest("hex")}`;
    const script = [
      "local current = redis.call('INCR', KEYS[1])",
      "local ttl = redis.call('PTTL', KEYS[1])",
      "if current == 1 or ttl < 0 then",
      "  redis.call('PEXPIRE', KEYS[1], ARGV[1])",
      "  ttl = tonumber(ARGV[1])",
      "end",
      "local t = redis.call('TIME')",
      "local now = (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000)",
      "return {current, now + ttl}",
    ].join("\n");

    const response = await this.fetcher(this.url.replace(/\/$/, ""), {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", script, "1", redisKey, String(windowMs)]),
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) throw new Error(`Rate-limit shared store returned HTTP ${response.status}`);

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("result" in payload)) {
      throw new Error("Rate-limit shared store returned an invalid response");
    }
    const result = (payload as { result?: unknown }).result;
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error("Rate-limit shared store returned an invalid counter result");
    }
    const count = Number(result[0]);
    const resetAt = Number(result[1]);
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(resetAt)) {
      throw new Error("Rate-limit shared store returned invalid counter values");
    }
    return { count, resetAt };
  }
}

function createDefaultRateLimitStore(): RateLimitStore {
  const url = process.env.RATE_LIMIT_REDIS_REST_URL?.trim();
  const token = process.env.RATE_LIMIT_REDIS_REST_TOKEN?.trim();
  if (url || token) {
    if (!url || !token) {
      throw new Error("Both RATE_LIMIT_REDIS_REST_URL and RATE_LIMIT_REDIS_REST_TOKEN must be configured together");
    }
    return new RedisRestRateLimitStore(url, token);
  }
  return new InMemoryRateLimitStore();
}

let store: RateLimitStore = createDefaultRateLimitStore();
export function setRateLimitStore(next: RateLimitStore) {
  store = next;
}

export const PORTAL_READ_LIMIT: RateLimitPolicy = { name: "portal-read", limit: 120, windowMs: 60_000 };
export const PORTAL_UPLOAD_LIMIT: RateLimitPolicy = { name: "portal-upload", limit: 10, windowMs: 60_000 };
export const PORTAL_INTERACTION_LIMIT: RateLimitPolicy = { name: "portal-interaction", limit: 30, windowMs: 60_000 };
export const PARTNERSHIP_INQUIRY_LIMIT: RateLimitPolicy = { name: "partnership-inquiry", limit: 5, windowMs: 3_600_000 };
export const PARTNERSHIP_INQUIRY_GLOBAL_LIMIT: RateLimitPolicy = { name: "partnership-inquiry-global", limit: 200, windowMs: 3_600_000 };
export const PLATFORM_ADMIN_MUTATION_LIMIT: RateLimitPolicy = { name: "platform-admin-mutation", limit: 10, windowMs: 60_000 };

// Do not silently downgrade a production security boundary to per-process counters.
export async function enforceRateLimit(
  policy: RateLimitPolicy,
  subject: string,
  now = Date.now(),
): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === "production" && !(store instanceof RedisRestRateLimitStore)) {
    throw new Error("Shared rate limiting is required in production; configure RATE_LIMIT_REDIS_REST_URL and RATE_LIMIT_REDIS_REST_TOKEN");
  }
  const { count, resetAt } = await store.hit(`${policy.name}:${subject}`, policy.windowMs, now);
  if (count <= policy.limit) return null;
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please retry later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
