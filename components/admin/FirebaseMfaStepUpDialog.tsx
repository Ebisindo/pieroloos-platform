"use client";

import { useEffect, useRef, useState } from "react";
import {
  getMultiFactorResolver,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  type MultiFactorError,
  type MultiFactorResolver,
} from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase/client-auth";

type Props = {
  operationLabel: string;
  onVerified: (firebaseIdToken: string) => Promise<void> | void;
  onCancel: () => void;
};

export function FirebaseMfaStepUpDialog({ operationLabel, onVerified, onCancel }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [phase, setPhase] = useState<"credentials" | "sms">("credentials");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [factorLabel, setFactorLabel] = useState("");
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [verificationId, setVerificationId] = useState("");
  const recaptchaContainer = useRef<HTMLDivElement | null>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => () => {
    recaptchaVerifier.current?.clear();
    recaptchaVerifier.current = null;
  }, []);

  function close() {
    recaptchaVerifier.current?.clear();
    recaptchaVerifier.current = null;
    onCancel();
  }

  async function startAuthentication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const auth = getFirebaseClientAuth();
      try {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const tokenResult = await credential.user.getIdTokenResult(true);
        const firebaseClaims = tokenResult.claims.firebase as { sign_in_second_factor?: unknown } | undefined;
        if (typeof firebaseClaims?.sign_in_second_factor !== "string" || !firebaseClaims.sign_in_second_factor) {
          throw new Error("This Firebase sign-in did not complete a second factor. Enrol a supported MFA factor and ensure Firebase MFA is enforced for this account before retrying.");
        }
        await onVerified(await credential.user.getIdToken(true));
      } catch (cause) {
        const code = typeof cause === "object" && cause !== null && "code" in cause
          ? String((cause as { code?: unknown }).code)
          : "";
        if (code !== "auth/multi-factor-auth-required") throw cause;

        const multiFactorResolver = getMultiFactorResolver(auth, cause as MultiFactorError);
        const phoneHint = multiFactorResolver.hints.find(
          (hint) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID,
        );
        if (!phoneHint) {
          throw new Error("No enrolled SMS second factor is available for this Firebase account. Enrol a supported phone factor first.");
        }
        if (!recaptchaContainer.current) throw new Error("The reCAPTCHA verifier could not be initialized.");
        recaptchaVerifier.current?.clear();
        const verifier = new RecaptchaVerifier(auth, recaptchaContainer.current, { size: "invisible" });
        recaptchaVerifier.current = verifier;
        const id = await new PhoneAuthProvider(auth).verifyPhoneNumber({
          multiFactorHint: phoneHint,
          session: multiFactorResolver.session,
        }, verifier);
        setResolver(multiFactorResolver);
        setVerificationId(id);
        setFactorLabel(phoneHint.displayName || "enrolled phone");
        setPhase("sms");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Firebase MFA verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function completeSmsChallenge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resolver || !verificationId) {
      setError("The SMS challenge has expired. Restart authentication.");
      setPhase("credentials");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const credential = PhoneAuthProvider.credential(verificationId, smsCode.trim());
      const assertion = PhoneMultiFactorGenerator.assertion(credential);
      const result = await resolver.resolveSignIn(assertion);
      const tokenResult = await result.user.getIdTokenResult(true);
      const firebaseClaims = tokenResult.claims.firebase as { sign_in_second_factor?: unknown } | undefined;
      if (typeof firebaseClaims?.sign_in_second_factor !== "string" || !firebaseClaims.sign_in_second_factor) {
        throw new Error("Firebase did not issue an ID token containing completed second-factor evidence.");
      }
      await onVerified(await result.user.getIdToken(true));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The SMS verification code was rejected.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="firebase-stepup-title">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Firebase Authentication</p>
            <h2 id="firebase-stepup-title" className="mt-1 text-xl font-semibold">Verify with multi-factor authentication</h2>
          </div>
          <button type="button" onClick={close} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-1 text-sm disabled:opacity-50">Close</button>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          A fresh SMS MFA sign-in is required for: <strong>{operationLabel}</strong>. This does not approve an ownership or asset transfer.
        </p>

        {phase === "credentials" ? (
          <form className="space-y-4" onSubmit={(event) => void startAuthentication(event)}>
            <label className="block text-sm font-medium">Firebase account email
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="block text-sm font-medium">Firebase password
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <div ref={recaptchaContainer} aria-hidden="true" />
            <p className="text-xs text-slate-500">The email/password sign-in method and an enrolled SMS second factor must be enabled for this Firebase account. Tokens and passwords are not written to the application database or logs.</p>
            <button className="w-full rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Verifying…" : "Continue to MFA"}</button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void completeSmsChallenge(event)}>
            <p className="text-sm text-slate-600">Enter the verification code sent to your enrolled {factorLabel}.</p>
            <label className="block text-sm font-medium">SMS verification code
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 tracking-widest" inputMode="numeric" autoComplete="one-time-code" required minLength={4} maxLength={10} value={smsCode} onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, ""))} />
            </label>
            <button className="w-full rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Checking code…" : "Verify and continue"}</button>
            <button type="button" className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" disabled={busy} onClick={() => { recaptchaVerifier.current?.clear(); recaptchaVerifier.current = null; setResolver(null); setVerificationId(""); setSmsCode(""); setPhase("credentials"); }}>Restart authentication</button>
          </form>
        )}

        {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
      </section>
    </div>
  );
}
