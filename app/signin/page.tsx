import Link from "next/link";
import {
  authConfigured,
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
      <p className="mt-3 text-sm leading-6 text-slate-400">
        By signing in, you acknowledge that use of the platform is subject to applicable terms. Review the{" "}
        <Link className="underline underline-offset-4" href="/terms">Terms and Conditions</Link> and{" "}
        <Link className="underline underline-offset-4" href="/policies">Policies &amp; Legal</Link>.
        The Terms remain a draft pending legal review; this notice is not an acceptance record.
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