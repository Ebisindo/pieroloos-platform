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

export const authOptions: AuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me",
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
            profile(profile: Profile) {
              return {
                id: String(profile.sub ?? profile.email),
                name: profile.name,
                email: profile.email,
              };
            },
          },
        ]
      : []),
  ],
  pages: { signIn: "/signin" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { memberships: { select: { id: true } } },
      });

      return Boolean(existingUser?.memberships.length);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
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