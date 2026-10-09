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
