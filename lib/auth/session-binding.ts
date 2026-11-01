import "server-only";

import { createHmac } from "node:crypto";

const COOKIE_BASE_NAMES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
] as const;

function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const piece of (header ?? "").split(";")) {
    const separator = piece.indexOf("=");
    if (separator <= 0) continue;
    const name = piece.slice(0, separator).trim();
    const value = piece.slice(separator + 1).trim();
    if (name && value && !cookies.has(name)) cookies.set(name, value);
  }
  return cookies;
}

/**
 * Return a keyed, user-bound fingerprint of the current NextAuth session cookie.
 * Raw session cookies are never persisted or returned. Missing session material
 * or a missing signing secret fails closed.
 */
export function getSessionBinding(request: Request, userId: string): string | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16 || !userId || userId.length > 256) return null;

  const cookies = parseCookies(request.headers.get("cookie"));
  for (const baseName of COOKIE_BASE_NAMES) {
    const direct = cookies.get(baseName);
    let sessionValue = direct ?? "";

    if (!sessionValue) {
      const chunks = [...cookies.entries()]
        .map(([name, value]) => {
          const match = name.match(new RegExp("^" + baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.(\\d+)$"));
          return match ? { index: Number(match[1]), value } : null;
        })
        .filter((chunk): chunk is { index: number; value: string } => chunk !== null)
        .sort((a, b) => a.index - b.index);
      if (chunks.length) {
        if (chunks.some((chunk, index) => chunk.index !== index)) continue;
        sessionValue = chunks.map((chunk) => chunk.value).join("");
      }
    }

    if (!sessionValue || sessionValue.length > 16_384) continue;
    return createHmac("sha256", secret)
      .update("pieroloos:session-binding:v1\0", "utf8")
      .update(userId, "utf8")
      .update("\0", "utf8")
      .update(baseName, "utf8")
      .update("\0", "utf8")
      .update(sessionValue, "utf8")
      .digest("hex");
  }

  return null;
}
