import Link from "next/link";
import { authConfigured, githubConfigured, oidcConfigured } from "@/lib/auth/auth-options";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl: requestedCallbackUrl } = await searchParams;
  const callbackUrl = typeof requestedCallbackUrl === "string" &&
    requestedCallbackUrl.startsWith("/") &&
    !requestedCallbackUrl.startsWith("//") &&
    !requestedCallbackUrl.includes("\\")
    ? requestedCallbackUrl
    : "/command-center";
  const encodedCallbackUrl = encodeURIComponent(callbackUrl);

  return authConfigured ? (
    <section className="glass-panel max-w-xl p-7">
      <p className="eyebrow">SECURE ACCESS</p>
      <h1 className="text-2xl font-semibold">Sign in to PieroloOS</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Workspace access requires organization membership. Client portal access requires an active, verified-email grant from your professional team.
      </p>
      {oidcConfigured && (
        <Link className="button button-primary mt-5" href={`/api/auth/signin/oidc?callbackUrl=${encodedCallbackUrl}`}>
          Continue with organization SSO
        </Link>
      )}
      {githubConfigured && (
        <Link className="button button-secondary mt-5" href={`/api/auth/signin/github?callbackUrl=${encodedCallbackUrl}`}>
          Continue with GitHub
        </Link>
      )}
    </section>
  ) : (
    <WorkspaceAccessState
      title="Identity provider not configured"
      description="Configure NEXTAUTH_SECRET and either GitHub OAuth credentials or an OIDC provider in the deployment environment before enabling sign-in."
      href="/"
      action="Return to workspace"
    />
  );
}