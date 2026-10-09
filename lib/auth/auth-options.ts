import type { AuthOptions, Profile } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/db/prisma";

const issuer = process.env.OIDC_ISSUER?.replace(/\/$/, "");
const clientId = process.env.OIDC_CLIENT_ID;
const clientSecret = process.env.OIDC_CLIENT_SECRET;
const githubId = process.env.GITHUB_ID;
const githubSecret = process.env.GITHUB_SECRET;

const platformSuperadminEmails = new Set(
  (process.env.PLATFORM_SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export const oidcConfigured = Boolean(issuer && clientId && clientSecret);
export const githubConfigured = Boolean(githubId && githubSecret);
export const authConfigured = oidcConfigured || githubConfigured;
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET must be configured in production.");
}

export function isPlatformSuperadmin(email: string | null | undefined): boolean {
  return Boolean(email && platformSuperadminEmails.has(email.trim().toLowerCase()));
}

async function hasVerifiedPortalEmail(
  provider: string | undefined,
  accessToken: string | null | undefined,
  profile: Profile | undefined,
  emailVerified: Date | null | undefined,
  email: string,
) {
  if (provider === "oidc") {
    return Boolean(
      emailVerified instanceof Date ||
      (profile && "email_verified" in profile && profile.email_verified === true),
    );
  }

  if (provider !== "github" || !accessToken) return false;

  try {
    const response = await fetch("https://api.github.com/user/emails", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Unable to verify GitHub client portal email.", { status: response.status });
      return false;
    }

    const addresses: unknown = await response.json();
    return Array.isArray(addresses) && addresses.some((address) =>
      address &&
      typeof address === "object" &&
      "email" in address &&
      typeof address.email === "string" &&
      address.email.trim().toLowerCase() === email.trim().toLowerCase() &&
      "verified" in address &&
      address.verified === true,
    );
  } catch (error) {
    console.error("Unable to verify GitHub client portal email.", error);
    return false;
  }
}

function resolveAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("NEXTAUTH_SECRET must be set in production.");
  }
  return "dev-secret-change-me";
}

export const authOptions: AuthOptions = {
  secret: resolveAuthSecret(),
  session: { strategy: "jwt", maxAge: AUTH_SESSION_MAX_AGE_SECONDS },
  providers: [
    ...(githubConfigured
      ? [GitHubProvider({ clientId: githubId!, clientSecret: githubSecret! })]
      : []),
    ...(oidcConfigured
      ? [
          {
            id: "oidc",
            name: process.env.OIDC_PROVIDER_NAME ?? "Organization SSO",
            type: "oauth" as const,
            issuer,
            clientId,
            clientSecret,
            idToken: true,
            profile(profile: Profile & { email_verified?: boolean }) {
              return {
                id: String(profile.sub ?? profile.email),
                name: profile.name,
                email: profile.email,
                emailVerified: profile.email_verified === true ? new Date() : null,
              };
            },
          },
        ]
      : []),
  ],
  pages: { signIn: "/signin" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: user.email, mode: "insensitive" } },
        select: {
          memberships: { select: { id: true } },
          clientPortalGrants: {
            where: {
              revokedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: { id: true },
            take: 1,
          },
        },
      });

      if (existingUser?.memberships.length) return true;
      if (!existingUser?.clientPortalGrants.length) return false;
      const emailVerified = "emailVerified" in user && user.emailVerified instanceof Date
        ? user.emailVerified
        : null;
      return hasVerifiedPortalEmail(
        account?.provider,
        account?.access_token,
        profile,
        emailVerified,
        user.email,
      );
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const existingUser = await prisma.user.findFirst({
          where: { email: { equals: user.email, mode: "insensitive" } },
          select: { id: true },
        });
        if (existingUser) token.sub = existingUser.id;
        token.isSuperAdmin = isPlatformSuperadmin(user.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        session.user.isSuperAdmin = token.isSuperAdmin === true;
      }
      return session;
    },
  },
};