import { afterEach, describe, expect, it, vi } from "vitest";

const envKeys = [
  "CI",
  "DATABASE_ENV",
  "DATABASE_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "PIEROLO_E2E_AUTH_ENABLED",
  "PIEROLO_E2E_AUTH_SECRET",
  "PIEROLO_E2E_TEST_EMAIL",
  "GITHUB_ID",
  "GITHUB_SECRET",
  "OIDC_ISSUER",
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "LOCAL_AUTH_ENABLED",
  "LOCAL_AUTH_EMAIL",
  "LOCAL_AUTH_PASSWORD",
];

async function loadAuthOptions(overrides: Record<string, string>) {
  vi.resetModules();
  for (const key of envKeys) {
    if (!(key in overrides)) vi.stubEnv(key, "");
  }
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
  return import("@/lib/auth/auth-options");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("isolated E2E authentication safety guard", () => {
  const safeEnvironment = {
    CI: "true",
    NODE_ENV: "production",
    DATABASE_ENV: "ci",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/pieroloos_e2e_ci?schema=public",
    NEXTAUTH_URL: "http://127.0.0.1:3100",
    NEXTAUTH_SECRET: "ci-only-session-secret",
    PIEROLO_E2E_AUTH_ENABLED: "true",
    PIEROLO_E2E_AUTH_SECRET: "e".repeat(64),
    PIEROLO_E2E_TEST_EMAIL: "pieroloos-e2e-owner@integration.invalid",
  };

  it("enables the test credentials provider only with the guarded CI settings", async () => {
    const auth = await loadAuthOptions(safeEnvironment);
    expect(auth.e2eTestAuthConfigured).toBe(true);
    expect(auth.authOptions.providers.some((provider) => provider.id === "pierolo-e2e-ci")).toBe(true);
  });

  it("refuses test credentials when the CI marker is absent", async () => {
    const auth = await loadAuthOptions({ ...safeEnvironment, CI: "" });
    expect(auth.e2eTestAuthConfigured).toBe(false);
    expect(auth.authOptions.providers.some((provider) => provider.id === "pierolo-e2e-ci")).toBe(false);
  });

  it("refuses a non-loopback database even if the other E2E flags are supplied", async () => {
    const auth = await loadAuthOptions({
      ...safeEnvironment,
      DATABASE_URL: "postgresql://test:secret@db.example.invalid:5432/pieroloos_e2e_ci?schema=public",
    });
    expect(auth.e2eTestAuthConfigured).toBe(false);
    expect(auth.authOptions.providers.some((provider) => provider.id === "pierolo-e2e-ci")).toBe(false);
  });

  it("refuses URLs with a public HTTPS origin", async () => {
    const auth = await loadAuthOptions({ ...safeEnvironment, NEXTAUTH_URL: "https://preview.example.invalid" });
    expect(auth.e2eTestAuthConfigured).toBe(false);
  });
});
