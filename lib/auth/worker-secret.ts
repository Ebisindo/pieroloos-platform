import { timingSafeEqual } from "node:crypto";

export function hasValidWorkerSecret(request: Request, secretName: string) {
  const expected = process.env[secretName];
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization?.startsWith("Bearer ")) return false;

  const providedBuffer = Buffer.from(authorization.slice("Bearer ".length));
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}
