export type IntegrityResult = {
  algorithm: "sha256";
  hash: string;
  verified: boolean;
};

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array
    ? new Uint8Array(data)
    : new Uint8Array(data);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as unknown as BufferSource,
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifySha256(
  data: ArrayBuffer | Uint8Array,
  expectedHash: string,
): Promise<IntegrityResult> {
  const hash = await sha256Hex(data);

  return {
    algorithm: "sha256",
    hash,
    verified: hash.toLowerCase() === expectedHash.toLowerCase(),
  };
}
