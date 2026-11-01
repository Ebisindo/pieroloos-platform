import Link from "next/link";
import {
  authConfigured,
  e2eTestAuthConfigured,
  githubConfigured,
  localDevelopmentConfigured,
  oidcConfigured,
} from "@/lib/auth/auth-options";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
import { LocalDevelopmentSignIn } from "@/components/auth/LocalDevelopmentSignIn";
import { getRequestTranslator } from "@/lib/i18n/request";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const t = await getRequestTranslator();
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
      <p className="eyebrow">{t("signin.eyebrow")}</p>
      <h1 className="text-2xl font-semibold">{t("signin.title")}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {t("signin.description")}
      </p>
      {oidcConfigured && (
        <Link className="button button-primary mt-5" href={`/api/auth/signin/oidc?callbackUrl=${encodedCallbackUrl}`}>
          {t("signin.oidc")}
        </Link>
      )}
      {githubConfigured && (
        <Link className="button button-secondary mt-5" href={`/api/auth/signin/github?callbackUrl=${encodedCallbackUrl}`}>
          {t("signin.github")}
        </Link>
      )}
      {localDevelopmentConfigured && (
        <LocalDevelopmentSignIn
          callbackUrl={callbackUrl}
          emailLabel={t("signin.local.email")}
          passwordLabel={t("signin.local.password")}
          submitLabel={t("signin.local.submit")}
          errorMessage={t("signin.local.error")}
        />
      )}
      {e2eTestAuthConfigured && (
        <LocalDevelopmentSignIn
          providerId="pierolo-e2e-ci"
          callbackUrl={callbackUrl}
          emailLabel={t("signin.e2e.email")}
          passwordLabel={t("signin.e2e.password")}
          submitLabel={t("signin.e2e.submit")}
          errorMessage={t("signin.e2e.error")}
        />
      )}
    </section>
  ) : (
    <WorkspaceAccessState
      title={t("signin.unconfigured.title")}
      description={t("signin.unconfigured.description")}
      href="/"
      action={t("signin.return")}
    />
  );
}