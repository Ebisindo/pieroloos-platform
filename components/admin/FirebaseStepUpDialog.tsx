"use client";

import { useRef, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signOut,
  type MultiFactorError,
  type MultiFactorResolver,
} from "firebase/auth";

export type FirebaseStepUpOperation =
  | "continuity:create-successor"
  | "continuity:owner-alive"
  | "continuity:simulate"
  | "continuity:revoke"
  | "continuity:create-asset"
  | "continuity:save-runbook";

function getStepUpAuth() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
  if (!apiKey || !authDomain || !projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) || !appId) {
    throw new Error("Firebase step-up client configuration is incomplete.");
  }
  const name = "pieroloos-continuity-step-up";
  const app = getApps().some((item) => item.name === name)
    ? getApp(name)
    : initializeApp({ apiKey, authDomain, projectId, appId }, name);
  return getAuth(app);
}

export function FirebaseStepUpDialog({
  operation,
  onAuthorized,
  onClose,
}: {
  operation: FirebaseStepUpOperation;
  onAuthorized: (handle: string) => Promise<void>;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [challengeNonce, setChallengeNonce] = useState("");
  const [mode, setMode] = useState<"credentials" | "sms">("credentials");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const resolverRef = useRef<MultiFactorResolver | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  function disposeVerifier() {
    verifierRef.current?.clear();
    verifierRef.current = null;
    resolverRef.current = null;
  }

  function close() {
    disposeVerifier();
    setPassword("");
    setSmsCode("");
    setChallengeNonce("");
    onClose();
  }

  async function startChallenge() {
    const response = await fetch("/api/auth/firebase-step-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ operation }),
    });
    const result = await response.json() as { data?: { challengeNonce?: string }; error?: string };
    if (!response.ok || !result.data?.challengeNonce) throw new Error(result.error || "Unable to begin step-up authentication.");
    setChallengeNonce(result.data.challengeNonce);
    return result.data.challengeNonce;
  }

  async function issueStepUp(idToken: string, nonce: string) {
    const auth = getStepUpAuth();
    let handle: string;
    try {
      const response = await fetch("/api/auth/firebase-step-up/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ operation, challengeNonce: nonce, firebaseIdToken: idToken }),
      });
      const result = await response.json() as { data?: { handle?: string }; error?: string };
      if (!response.ok || !result.data?.handle) {
        throw new Error(result.error || "Firebase MFA step-up was rejected.");
      }
      handle = result.data.handle;
    } finally {
      // The Firebase account is a one-operation proof source, not a second
      // persistent application session. Clear it even when the server rejects proof.
      await signOut(auth).catch(() => undefined);
    }

    disposeVerifier();
    setPassword("");
    setSmsCode("");
    setChallengeNonce("");
    await onAuthorized(handle);
  }

  async function beginAuthentication() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const nonce = await startChallenge();
      const auth = getStepUpAuth();
      let credential: Awaited<ReturnType<typeof signInWithEmailAndPassword>>;
      try {
        credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      } catch (cause) {
        const multiFactorError = cause as Partial<MultiFactorError>;
        if (multiFactorError.code !== "auth/multi-factor-auth-required") throw cause;
        const resolver = getMultiFactorResolver(auth, cause as MultiFactorError);
        const phoneHint = resolver.hints.find((hint) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID);
        if (!phoneHint) {
          throw new Error("This initial step-up flow requires an enrolled SMS phone factor. Configure a supported factor for this staging account.", { cause });
        }
        const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current!, { size: "invisible" });
        verifierRef.current = verifier;
        resolverRef.current = resolver;
        const id = await new PhoneAuthProvider(auth).verifyPhoneNumber({
          multiFactorHint: phoneHint,
          session: resolver.session,
        }, verifier);
        setVerificationId(id);
        setMode("sms");
        setNotice("A verification code was requested for the enrolled phone factor.");
        return;
      }
      const idToken = await credential.user.getIdToken(true);
      await issueStepUp(idToken, nonce);
    } catch (cause) {
      // Any partially successful Firebase sign-in is disposable proof, not an
      // application session. Clear it on every early error path as well.
      try { await signOut(getStepUpAuth()); } catch { /* Client config may itself be unavailable. */ }
      setPassword("");
      setError(cause instanceof Error ? cause.message : "Firebase step-up could not be started.");
    } finally {
      setBusy(false);
    }
  }

  async function verifySmsCode() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const resolver = resolverRef.current;
      if (!resolver || !verificationId || !challengeNonce) throw new Error("The SMS challenge expired. Start the authentication step again.");
      const phoneCredential = PhoneAuthProvider.credential(verificationId, smsCode.trim());
      const assertion = PhoneMultiFactorGenerator.assertion(phoneCredential);
      const signedIn = await resolver.resolveSignIn(assertion);
      const idToken = await signedIn.user.getIdToken(true);
      await issueStepUp(idToken, challengeNonce);
    } catch (cause) {
      // Failed MFA resolution or token acquisition must not leave a Firebase
      // user signed into the browser after the protected action was rejected.
      try { await signOut(getStepUpAuth()); } catch { /* Ignore cleanup-only failures. */ }
      setPassword("");
      setError(cause instanceof Error ? cause.message : "The verification code was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  const operationLabel = operation.replace("continuity:", "").replaceAll("-", " ");

  return (
    <div className="continuity-modal-backdrop" role="presentation">
      <section className="continuity-modal" role="dialog" aria-modal="true" aria-labelledby="firebase-step-up-title">
        <div className="continuity-modal-header">
          <div className="continuity-modal-symbol" aria-hidden="true">2FA</div>
          <button type="button" className="continuity-icon-button" aria-label="Cancel step-up authentication" onClick={close} disabled={busy}>×</button>
        </div>
        <h2 id="firebase-step-up-title">Verify this sensitive action</h2>
        <p>Firebase Authentication must verify a fresh sign-in with an enrolled second factor for <strong>{operationLabel}</strong>. A successful check authorizes one matching operation only; it does not transfer ownership or grant persistent access.</p>
        {mode === "credentials" ? (
          <form className="continuity-runbook-form" onSubmit={(event) => { event.preventDefault(); void beginAuthentication(); }}>
            <label>Firebase staff account email
              <input type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>Firebase password
              <input type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <p className="continuity-help">These are the dedicated Firebase Authentication credentials for the UID already linked to your PieroloOS staff account. Do not reuse the password in runbooks or notes.</p>
            <button type="submit" className="continuity-primary-button" disabled={busy}>{busy ? "Verifying…" : "Authenticate and request MFA"}</button>
          </form>
        ) : (
          <form className="continuity-runbook-form" onSubmit={(event) => { event.preventDefault(); void verifySmsCode(); }}>
            <label>SMS verification code
              <input inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={10} value={smsCode} onChange={(event) => setSmsCode(event.target.value.replace(/\s/g, ""))} />
            </label>
            <button type="submit" className="continuity-primary-button" disabled={busy || smsCode.trim().length < 6}>{busy ? "Verifying…" : "Verify code and authorize this action"}</button>
            <button type="button" className="continuity-secondary-button" disabled={busy} onClick={() => { disposeVerifier(); setMode("credentials"); setVerificationId(""); setSmsCode(""); setChallengeNonce(""); setNotice(""); }}>Start again</button>
          </form>
        )}
        <div ref={recaptchaContainerRef} aria-hidden="true" />
        {error ? <div className="continuity-message continuity-error" role="alert">{error}</div> : null}
        {notice ? <div className="continuity-message continuity-notice" role="status">{notice}</div> : null}
        <p className="continuity-help">Canceling leaves the protected action unexecuted. Verification handles are short-lived and single-use.</p>
      </section>
    </div>
  );
}
