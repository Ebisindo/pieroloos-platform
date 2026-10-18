import { NextResponse } from "next/server";

export type RateLimitPolicy = { name: string; limit: number; windowMs: number };

export type RateLimitStore = {
  hit(key: string, windowMs: number, now: number): Promise<{ count: number; resetAt: number }>;
};

// Per-process fixed-window store. Correct for a single instance only; production
// deployments with multiple instances must inject a shared store (e.g. Redis)
// or enforce limits at the edge/WAF. See docs/SESSION-27 gate.
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

let store: RateLimitStore = new InMemoryRateLimitStore();

export function setRateLimitStore(next: RateLimitStore) {
  store = next;
}

export const PORTAL_READ_LIMIT: RateLimitPolicy = { name: "portal-read", limit: 120, windowMs: 60_000 };
export const PORTAL_UPLOAD_LIMIT: RateLimitPolicy = { name: "portal-upload", limit: 10, windowMs: 60_000 };
export const PORTAL_INTERACTION_LIMIT: RateLimitPolicy = { name: "portal-interaction", limit: 30, windowMs: 60_000 };
export const WORKSPACE_STAFF_MUTATION_LIMIT: RateLimitPolicy = { name: "workspace-staff-mutation", limit: 30, windowMs: 60_000 };
export const WORKSPACE_DOCUMENT_READ_LIMIT: RateLimitPolicy = { name: "workspace-document-read", limit: 120, windowMs: 60_000 };
export const WORKSPACE_DOCUMENT_UPLOAD_LIMIT: RateLimitPolicy = { name: "workspace-document-upload", limit: 10, windowMs: 60_000 };
export const PARTNERSHIP_INQUIRY_LIMIT: RateLimitPolicy = { name: "partnership-inquiry", limit: 5, windowMs: 3_600_000 };
export const PARTNERSHIP_INQUIRY_GLOBAL_LIMIT: RateLimitPolicy = { name: "partnership-inquiry-global", limit: 200, windowMs: 3_600_000 };
export const PLATFORM_ADMIN_MUTATION_LIMIT: RateLimitPolicy = { name: "platform-admin-mutation", limit: 10, windowMs: 60_000 };

// Returns a 429 response when the subject has exhausted the policy, otherwise null.
export async function enforceRateLimit(
  policy: RateLimitPolicy,
  subject: string,
  now = Date.now(),
): Promise<NextResponse | null> {
  const { count, resetAt } = await store.hit(`${policy.name}:${subject}`, policy.windowMs, now);
  if (count <= policy.limit) return null;
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please retry later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
