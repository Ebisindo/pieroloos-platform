import "server-only";

import { createHmac } from "node:crypto";

/**
 * Binds a challenge to the current signed NextAuth session cookie(s).
 * Cookie values are never persisted or logged; only an HMAC fingerprint is stored.
 */
export function getSessionBinding(request: Request, userId: string): string | null {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  const cookieHeader = request.headers.get("cookie");
  if (!secret || !cookieHeader || !userId) return null;

  const entries = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .map((item) => {
      const separator = item.indexOf("=");
      return separator > 0
        ? { name: item.slice(0, separator).trim(), value: item.slice(separator + 1).trim() }
        : null;
    })
    .filter((item): item is { name: string; value: string } =>
      Boolean(
        item &&
        item.value &&
        /^(?:__Secure-|__Host-)?(?:next-auth|authjs)\.session-token(?:\.\d+)?$/.test(item.name),
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  if (entries.length === 0) return null;
  const serialized = entries.map(({ name, value }) => `${name}=${value}`).join("\n");
  return createHmac("sha256", secret).update(`${userId}\0${serialized}`, "utf8").digest("hex");
}
