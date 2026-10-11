import Link from "next/link";
import { authConfigured, githubConfigured, oidcConfigured } from "@/lib/auth/auth-options";
import { WorkspaceAccessState } from "@/components/auth/WorkspaceAccessState";
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