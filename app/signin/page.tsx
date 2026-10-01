import Link from "next/link";
import { authConfigured, githubConfigured, oidcConfigured } from "@/lib/auth/auth-options";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";

export default function SignInPage() {
  return authConfigured ? (
    <section className="glass-panel max-w-xl p-7">
      <p className="eyebrow">SECURE ACCESS</p>
      <h1 className="text-2xl font-semibold">Sign in to PieroloOS</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Access is granted to accounts with an existing organization membership.
      </p>
      {oidcConfigured && (
        <Link className="button button-primary mt-5" href="/api/auth/signin/oidc?callbackUrl=/command-center">
          Continue with organization SSO
        </Link>
      )}
      {githubConfigured && (
        <Link className="button button-secondary mt-5" href="/api/auth/signin/github?callbackUrl=/command-center">
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