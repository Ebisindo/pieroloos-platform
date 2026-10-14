import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_SESSION_MAX_AGE_SECONDS, authOptions } from "@/lib/auth/auth-options";

const { userFindFirst } = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findFirst: userFindFirst } },
}));

describe("authentication session policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a bounded eight-hour JWT session", () => {
    expect(AUTH_SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);
    expect(authOptions.session).toEqual({ strategy: "jwt", maxAge: 8 * 60 * 60 });
  });

  it("admits a provisioned user with an active portal grant without organization membership", async () => {
    userFindFirst.mockResolvedValue({
      memberships: [],
      clientPortalGrants: [{ id: "grant-1" }],
    });
    const signIn = authOptions.callbacks?.signIn;
    if (!signIn) throw new Error("Sign-in callback is not configured.");
    const oidcProfile = { email: "client@example.test", email_verified: true };

    const allowed = await signIn({
      user: { id: "user-1", email: "client@example.test", name: "Client", image: null },
      account: { provider: "oidc", type: "oauth", providerAccountId: "client-subject" },
      profile: oidcProfile,
      email: undefined,
      credentials: undefined,
    });

    expect(allowed).toBe(true);
    expect(userFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: { equals: "client@example.test", mode: "insensitive" } },
      select: expect.objectContaining({
        clientPortalGrants: expect.objectContaining({
          where: expect.objectContaining({ revokedAt: null }),
        }),
      }),
    }));
  });

  it("does not admit a provisioned user without membership or an active client grant", async () => {
    userFindFirst.mockResolvedValue({ memberships: [], clientPortalGrants: [] });
    const signIn = authOptions.callbacks?.signIn;
    if (!signIn) throw new Error("Sign-in callback is not configured.");

    const allowed = await signIn({
      user: { id: "user-1", email: "client@example.test", name: "Client", image: null },
      account: null,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    });

    expect(allowed).toBe(false);
  });

  it("requires GitHub to confirm the exact client email is verified", async () => {
    userFindFirst.mockResolvedValue({
      memberships: [],
      clientPortalGrants: [{ id: "grant-1" }],
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      { email: "client@example.test", primary: true, verified: true },
      { email: "other@example.test", primary: false, verified: true },
    ]), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const signIn = authOptions.callbacks?.signIn;
    if (!signIn) throw new Error("Sign-in callback is not configured.");

    const allowed = await signIn({
      user: { id: "user-1", email: "client@example.test", name: "Client", image: null },
      account: {
        provider: "github",
        type: "oauth",
        providerAccountId: "github-user",
        access_token: "provider-access-token",
      },
      profile: { email: "client@example.test" },
      email: undefined,
      credentials: undefined,
    });

    expect(allowed).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/user/emails",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer provider-access-token" }),
        cache: "no-store",
      }),
    );
  });

  it("denies portal login when the identity provider does not confirm an email", async () => {
    userFindFirst.mockResolvedValue({
      memberships: [],
      clientPortalGrants: [{ id: "grant-1" }],
    });
    const signIn = authOptions.callbacks?.signIn;
    if (!signIn) throw new Error("Sign-in callback is not configured.");

    const allowed = await signIn({
      user: { id: "user-1", email: "client@example.test", name: "Client", image: null },
      account: { provider: "oidc", type: "oauth", providerAccountId: "client-subject" },
      profile: { email: "client@example.test" },
      email: undefined,
      credentials: undefined,
    });

    expect(allowed).toBe(false);
  });
});

describe("authentication configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load(env: Record<string, string>) {
    vi.resetModules();
    for (const key of [
      "NODE_ENV",
      "NEXTAUTH_SECRET",
      "NEXTAUTH_URL",
      "GITHUB_ID",
      "GITHUB_SECRET",
      "OIDC_ISSUER",
      "OIDC_CLIENT_ID",
      "OIDC_CLIENT_SECRET",
      "LOCAL_AUTH_ENABLED",
      "LOCAL_AUTH_EMAIL",
      "LOCAL_AUTH_PASSWORD",
    ]) {
      vi.stubEnv(key, env[key] ?? "");
    }
    return import("@/lib/auth/auth-options");
  }

  it("reports missing configuration by name without throwing", async () => {
    const mod = await load({});
    expect(mod.authConfigured).toBe(false);
    expect(mod.authOptions.providers).toHaveLength(0);
    expect(mod.getAuthConfigProblems().join(" ")).toContain("NEXTAUTH_SECRET");
  });

  it("is not configured when providers exist but the secret is missing", async () => {
    const mod = await load({ GITHUB_ID: "id", GITHUB_SECRET: "s" });
    expect(mod.authConfigured).toBe(false);
    expect(mod.authOptions.secret).toBeUndefined();
  });

  it("registers GitHub when secret and credentials are present", async () => {
    const mod = await load({ NEXTAUTH_SECRET: "x".repeat(32), GITHUB_ID: "id", GITHUB_SECRET: "s" });
    expect(mod.authConfigured).toBe(true);
    expect(mod.authOptions.providers.map((p) => p.id)).toEqual(["github"]);
    expect(mod.authOptions.pages?.signIn).toBe("/signin");
  });

  it("enables local credentials only in explicitly enabled development with a secret", async () => {
    const mod = await load({
      NODE_ENV: "development",
      NEXTAUTH_SECRET: "x".repeat(32),
      LOCAL_AUTH_ENABLED: "true",
      LOCAL_AUTH_EMAIL: "staff@example.test",
      LOCAL_AUTH_PASSWORD: "local-password",
    });
    expect(mod.authConfigured).toBe(true);
    expect(mod.localDevelopmentConfigured).toBe(true);
    expect(mod.authOptions.providers.map((provider) => provider.id)).toEqual(["credentials"]);

    const provider = mod.authOptions.providers.find((candidate) => candidate.id === "credentials");
    if (!provider || provider.type !== "credentials") throw new Error("Local credentials provider is not configured.");
    const authorize = provider.options?.authorize as typeof provider.authorize;
    const request = { body: {}, query: {}, headers: {}, method: "POST" };
    await expect(authorize({ email: "staff@example.test", password: "wrong" }, request)).resolves.toBeNull();
    await expect(authorize({ email: " STAFF@example.test ", password: "local-password" }, request))
      .resolves.toMatchObject({ email: "staff@example.test" });

    const signIn = mod.authOptions.callbacks?.signIn;
    if (!signIn) throw new Error("Sign-in callback is not configured.");
    userFindFirst.mockResolvedValueOnce({ memberships: [{ id: "membership-1" }], clientPortalGrants: [] });
    await expect(signIn({
      user: { id: "local-user", email: "staff@example.test", name: "Staff" },
      account: { provider: "credentials", type: "credentials", providerAccountId: "local-user" },
      profile: undefined,
      email: undefined,
      credentials: undefined,
    })).resolves.toBe(true);

    userFindFirst.mockResolvedValueOnce({ memberships: [], clientPortalGrants: [{ id: "grant-1" }] });
    await expect(signIn({
      user: { id: "local-client", email: "client@example.test", name: "Client" },
      account: { provider: "credentials", type: "credentials", providerAccountId: "local-client" },
      profile: undefined,
      email: undefined,
      credentials: undefined,
    })).resolves.toBe(false);
  });

  it("never enables local credentials outside development", async () => {
    const mod = await load({
      NODE_ENV: "production",
      NEXTAUTH_SECRET: "x".repeat(32),
      LOCAL_AUTH_ENABLED: "true",
      LOCAL_AUTH_EMAIL: "staff@example.test",
      LOCAL_AUTH_PASSWORD: "local-password",
    });
    expect(mod.localDevelopmentConfigured).toBe(false);
    expect(mod.authConfigured).toBe(false);
    expect(mod.authOptions.providers).toHaveLength(0);
  });

  it("maps the persisted user identifier into the session without carrying an authorization claim", async () => {
    const mod = await load({ NEXTAUTH_SECRET: "x".repeat(32), GITHUB_ID: "id", GITHUB_SECRET: "s" });
    const session = await mod.authOptions.callbacks!.session!({
      session: { user: { name: "a" }, expires: "" },
      token: { sub: "u1" },
    } as never);
    expect(session.user).toMatchObject({ id: "u1" });
    expect(session.user).not.toHaveProperty("isSuperAdmin");
  });

  it("route returns a generic 503 when unconfigured", async () => {
    await load({});
    vi.doMock("next-auth", () => ({ default: () => () => new Response("ok") }));
    const route = await import("@/app/api/auth/[...nextauth]/route");
    const res = await route.GET(new Request("http://x/api/auth/signin/github"), { params: Promise.resolve({ nextauth: ["signin", "github"] }) });
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toMatch(/NEXTAUTH|GITHUB/);
    vi.doUnmock("next-auth");
  });
});
