"use client";

import { useState } from "react";

type ClaimMethod = "BANK_TRANSFER" | "CRYPTO";

export function StripeCheckoutButton({ invoiceId }: { invoiceId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/billing/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const body = await response.json() as { data?: { checkoutUrl?: string }; error?: string };
      if (!response.ok || !body.data?.checkoutUrl) throw new Error(body.error ?? "Checkout could not be started.");
      window.location.assign(body.data.checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout could not be started.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="payment-action"><button className="button button-primary" type="button" disabled={busy} onClick={start}>{busy ? "Starting…" : "Pay with Stripe"}</button>{error ? <p role="alert" className="payment-error">{error}</p> : null}</div>;
}

export function ManualPaymentClaimButton({ invoiceId, method }: { invoiceId: string; method: ClaimMethod }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/billing/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceId, method }),
      });
      const body = await response.json() as { data?: { id: string }; message?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Payment claim could not be submitted.");
      setMessage(body.message ?? "Payment claim pending verification.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment claim could not be submitted.");
    } finally {
      setBusy(false);
    }
  }
  const label = method === "BANK_TRANSFER" ? "I've Sent the Bank Transfer" : "I've Made the Payment";
  return <div className="payment-action"><button className="button button-secondary" type="button" disabled={busy} onClick={submit}>{busy ? "Submitting…" : label}</button>{message ? <p role="status" className="payment-success">{message}</p> : null}{error ? <p role="alert" className="payment-error">{error}</p> : null}</div>;
}
