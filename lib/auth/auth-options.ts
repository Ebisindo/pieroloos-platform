import type { AuthOptions, Profile } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/db/prisma";

const issuer = process.env.OIDC_ISSUER?.replace(/\/$/, "");
const clientId = process.env.OIDC_CLIENT_ID;
const clientSecret = process.env.OIDC_CLIENT_SECRET;
const githubId = process.env.GITHUB_ID;
const githubSecret = process.env.GITHUB_SECRET;
const localAuthEmail = process.env.LOCAL_AUTH_EMAIL?.trim();
const localAuthPassword = process.env.LOCAL_AUTH_PASSWORD;
const e2eAuthSecret = process.env.PIEROLO_E2E_AUTH_SECRET;
const e2eTestEmail = process.env.PIEROLO_E2E_TEST_EMAIL?.trim().toLowerCase();

function isLoopbackHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

function isDisposableCiDatabase(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    return ["postgres:", "postgresql:"].includes(url.protocol) &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      /_(ci|test)$/i.test(databaseName);
  } catch {
    return false;
  }
}

export const e2eTestAuthConfigured = Boolean(
  process.env.CI === "true" &&
  process.env.PIEROLO_E2E_AUTH_ENABLED === "true" &&
  process.env.DATABASE_ENV === "ci" &&
  e2eAuthSecret && e2eAuthSecret.length >= 32 &&
  e2eTestEmail?.endsWith("@integration.invalid") &&
  isLoopbackHttpUrl(process.env.NEXTAUTH_URL) &&
  isDisposableCiDatabase(process.env.DATABASE_URL),
);

export const oidcConfigured = Boolean(issuer && clientId && clientSecret);
export const githubConfigured = Boolean(githubId && githubSecret);
export const localDevelopmentConfigured = Boolean(
  process.env.NODE_ENV === "development" &&
  process.env.LOCAL_AUTH_ENABLED === "true" &&
  localAuthEmail &&
  localAuthPassword,
);
export const authSecretConfigured = Boolean(process.env.NEXTAUTH_SECRET?.trim());
export const authConfigured = authSecretConfigured && (
  oidcConfigured ||
  githubConfigured ||
  localDevelopmentConfigured ||
  e2eTestAuthConfigured
);
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

// Names only; never includes values.
export function getAuthConfigProblems(): string[] {
  const problems: string[] = [];
  if (!authSecretConfigured) problems.push("NEXTAUTH_SECRET is not set.");
  if (!oidcConfigured && !githubConfigured && !localDevelopmentConfigured) {
    const localOption = process.env.NODE_ENV === "development"
      ? ", or set LOCAL_AUTH_ENABLED=true, LOCAL_AUTH_EMAIL and LOCAL_AUTH_PASSWORD for local development"
      : "";
    problems.push(`No identity provider: set GITHUB_ID and GITHUB_SECRET, or OIDC_ISSUER, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET${localOption}.`);
  }
  if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_URL) {
    problems.push("NEXTAUTH_URL is not set.");
  }
  return problems;
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

export const authOptions: AuthOptions = {
  secret: process.env.NEXTAUTH_SECRET?.trim() || undefined,
  session: { strategy: "jwt", maxAge: AUTH_SESSION_MAX_AGE_SECONDS },
  providers: [
    ...(localDevelopmentConfigured
      ? [
          CredentialsProvider({
            name: "Local development",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              if (
                !credentials?.email ||
                credentials.email.trim().toLowerCase() !== localAuthEmail?.toLowerCase() ||
                credentials.password !== localAuthPassword
              ) {
                return null;
              }
              return {
                id: `local:${localAuthEmail!.toLowerCase()}`,
                email: localAuthEmail!,
                name: localAuthEmail!,
              };
            },
          }),
        ]
      : []),
    ...(e2eTestAuthConfigured
      ? [
          CredentialsProvider({
            id: "pierolo-e2e-ci",
            name: "Isolated CI test identity",
            credentials: {
              email: { label: "CI test account email", type: "email" },
              password: { label: "Ephemeral CI test secret", type: "password" },
            },
            async authorize(credentials) {
              const email = credentials?.email?.trim().toLowerCase();
              if (!email || email !== e2eTestEmail || credentials?.password !== e2eAuthSecret) {
                return null;
              }
              const testUser = await prisma.user.findUnique({
                where: { email },
                select: { id: true, email: true, name: true, memberships: { select: { id: true }, take: 1 } },
              });
              if (!testUser || testUser.memberships.length === 0) return null;
              return { id: testUser.id, email: testUser.email, name: testUser.name };
            },
          }),
        ]
      : []),
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
      }
      return session;
    },
  },
};