"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

type LocalDevelopmentSignInProps = {
  callbackUrl: string;
  emailLabel: string;
  passwordLabel: string;
  submitLabel: string;
  errorMessage: string;
};

export function LocalDevelopmentSignIn({
  callbackUrl,
  emailLabel,
  passwordLabel,
  submitLabel,
  errorMessage,
}: LocalDevelopmentSignInProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(false);

    const formData = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        callbackUrl,
        redirect: false,
      });

      if (result?.ok && result.url) {
        window.location.assign(result.url);
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
      <label className="block text-sm text-slate-300">
        {emailLabel}
        <input
          autoComplete="username"
          className="form-input mt-1"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block text-sm text-slate-300">
        {passwordLabel}
        <input
          autoComplete="current-password"
          className="form-input mt-1"
          name="password"
          required
          type="password"
        />
      </label>
      <button className="button button-secondary" disabled={pending} type="submit">
        {pending ? `${submitLabel}…` : submitLabel}
      </button>
      {error && <p aria-live="polite" className="text-sm text-rose-300">{errorMessage}</p>}
    </form>
  );
}
