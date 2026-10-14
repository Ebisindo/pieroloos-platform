"use client";

import { useEffect, useState } from "react";

type Claim = {
  claimType?: string;
  paymentReference?: string;
  submittedByUserId?: string;
  network?: string;
  asset?: string;
  transactionReference?: string;
  expectedTokenAmountBaseUnits?: string;
  tokenDecimals?: number;
  destinationAddress?: string;
  tokenIdentifier?: string;
  verificationMode?: string;
  latePayment?: boolean;
  expiresAt?: string;
};
type Payment = {
  id: string; organizationId: string; invoiceId: string | null; provider: string | null;
  providerPaymentId: string | null; currency: string; amountMinor: string; status?: string;
  createdAt: string; claim?: Claim | null; paymentReference?: string | null;
  submittedByUserId?: string | null; submittedAt?: string;
};
type ListResponse = { data?: { pending?: Payment[]; recent?: Payment[] }; error?: string };

export function PaymentReviewPanel() {
  const [pending, setPending] = useState<Payment[]>([]);
  const [recent, setRecent] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formValues, setFormValues] = useState<Record<string, { amount: string; currency: string; bankRef: string; tokenAmount: string; evidence: string; reason: string }>>({});

  async function refresh() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/payments", { cache: "no-store" });
      const body = await response.json() as ListResponse;
      if (!response.ok) throw new Error(body.error ?? "Could not load payment review queue.");
      setPending(body.data?.pending ?? []);
      setRecent(body.data?.recent ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payment review queue.");
    } finally { setLoading(false); }
  }
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/payments", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as ListResponse;
        if (!response.ok) throw new Error(body.error ?? "Could not load payment review queue.");
        if (!cancelled) {
          setPending(body.data?.pending ?? []);
          setRecent(body.data?.recent ?? []);
          setError("");
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load payment review queue.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function field(payment: Payment, key: "amount" | "currency" | "bankRef" | "tokenAmount" | "evidence" | "reason") {
    const existing = formValues[payment.id];
    if (existing) return existing[key];
    if (key === "amount") return payment.amountMinor;
    if (key === "currency") return payment.currency;
    if (key === "bankRef") return "";
    if (key === "tokenAmount") return payment.claim?.expectedTokenAmountBaseUnits ?? "";
    if (key === "evidence") return "";
    return "";
  }
  function change(payment: Payment, key: "amount" | "currency" | "bankRef" | "tokenAmount" | "evidence" | "reason", value: string) {
    setFormValues((prev) => ({
      ...prev,
      [payment.id]: {
        amount: prev[payment.id]?.amount ?? payment.amountMinor,
        currency: prev[payment.id]?.currency ?? payment.currency,
        bankRef: prev[payment.id]?.bankRef ?? "",
        tokenAmount: prev[payment.id]?.tokenAmount ?? payment.claim?.expectedTokenAmountBaseUnits ?? "",
        evidence: prev[payment.id]?.evidence ?? "",
        reason: prev[payment.id]?.reason ?? "",
        [key]: value,
      },
    }));
  }

  async function decide(payment: Payment, action: "APPROVE_BANK_TRANSFER" | "REJECT_BANK_TRANSFER" | "APPROVE_CRYPTO_PAYMENT" | "REJECT_CRYPTO_PAYMENT") {
    setBusyId(payment.id); setError(""); setMessage("");
    const claim = payment.claim;
    const values = formValues[payment.id] ?? {
      amount: payment.amountMinor, currency: payment.currency, bankRef: "", tokenAmount: claim?.expectedTokenAmountBaseUnits ?? "", evidence: "", reason: "",
    };
    if (!values.reason.trim() || values.reason.trim().length < 8 || values.evidence.trim().length < 8) {
      setError("Enter independent evidence and a reason of at least 8 characters."); setBusyId(""); return;
    }
    const body: Record<string, string> = {
      action, paymentId: payment.id, organizationId: payment.organizationId,
      evidenceReference: values.evidence.trim(), reason: values.reason.trim(),
    };
    if (action === "APPROVE_BANK_TRANSFER" || action === "REJECT_BANK_TRANSFER") {
      body.receivedAmountMinor = values.amount;
      body.receivedCurrency = values.currency;
      body.bankTransactionReference = values.bankRef.trim() || (action === "REJECT_BANK_TRANSFER" ? "not-found" : "");
      if (action === "APPROVE_BANK_TRANSFER" && !values.bankRef.trim()) {
        setError("Enter the independently matched bank transaction reference."); setBusyId(""); return;
      }
    } else if (action === "APPROVE_CRYPTO_PAYMENT") {
      body.receivedAmountBaseUnits = values.tokenAmount;
    }
    if (action.includes("CRYPTO")) {
      if (!claim?.transactionReference || !/^https:\/\//i.test(values.evidence.trim())) {
        setError("Crypto review requires an HTTPS explorer/evidence URL and the recorded transaction reference."); setBusyId(""); return;
      }
      const confirm = window.confirm(
        `Approve ${claim.asset ?? "crypto"} on ${claim.network ?? "the selected network"} only after the server has verified the transaction using the configured read-only RPC. Confirm the evidence URL points to the submitted transaction, no prior credit was recorded, and the review reason is accurate. If RPC verification is unavailable, manual approval is allowed only under the explicitly enabled RPC-outage override policy.`,
      );
      if (!confirm) { setBusyId(""); return; }
    }
    try {
      const response = await fetch("/api/admin/payments", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json() as { error?: string; data?: { status?: string }; notice?: string };
      if (!response.ok) throw new Error(result.error ?? "Reconciliation failed.");
      setMessage(`Payment ${payment.id} reviewed: ${result.data?.status ?? "updated"}. ${result.notice ?? ""}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconciliation failed.");
    } finally { setBusyId(""); }
  }

  return <section className="page-stack">
    <div className="section-header"><div><h2>Pending payment claims</h2><p>Review only after checking independent bank or chain evidence. Approvals update invoice balances transactionally.</p></div><button type="button" className="button button-secondary" onClick={() => void refresh()} disabled={loading}>Refresh</button></div>
    {loading ? <div className="glass-panel"><p>Loading payment records…</p></div> : null}
    {error ? <p role="alert" className="payment-error">{error}</p> : null}
    {message ? <p role="status" className="payment-success">{message}</p> : null}
    {!loading && pending.length === 0 ? <div className="glass-panel"><p>No submitted payment claims are pending review.</p></div> : null}
    {pending.map((payment) => {
      const claim = payment.claim;
      const crypto = payment.provider?.startsWith("crypto:");
      return <article className="glass-panel payment-review-card" key={payment.id}>
        <header><div><h3>{crypto ? `${claim?.asset ?? "Crypto"} — ${claim?.network ?? payment.provider}` : "Bank transfer"}</h3><p>Payment ID: <code>{payment.id}</code></p><p>Invoice: <code>{payment.invoiceId ?? "—"}</code></p></div><span className="status-badge status-warning">PENDING</span></header>
        <dl className="bank-instructions">
          <div><dt>Organization</dt><dd><code>{payment.organizationId}</code></dd></div>
          <div><dt>Amount due</dt><dd>{payment.currency} {(Number(payment.amountMinor) / 100).toFixed(2)}</dd></div>
          <div><dt>Internal reference</dt><dd><code>{payment.paymentReference ?? "—"}</code></dd></div>
          <div><dt>Submitted by</dt><dd><code>{payment.submittedByUserId ?? "Unknown"}</code></dd></div>
          {crypto ? <>
            <div><dt>Transaction hash</dt><dd><code>{claim?.transactionReference ?? payment.providerPaymentId}</code></dd></div>
            <div><dt>Token identifier</dt><dd><code>{claim?.tokenIdentifier ?? "Missing"}</code></dd></div>
            <div><dt>Destination</dt><dd><code>{claim?.destinationAddress ?? "Missing"}</code></dd></div>
            <div><dt>Expected token base units</dt><dd><code>{claim?.expectedTokenAmountBaseUnits ?? "Missing"}</code></dd></div>
          </> : null}
        </dl>
        {crypto && claim?.latePayment ? <p className="payment-warning">This transaction claim was submitted after the order expiry. Verify the actual transfer timestamp and order association carefully; it must not be approved solely because the transaction exists.</p> : null}
        {crypto && claim?.expiresAt ? <p className="muted">Payment order expiry: {new Date(claim.expiresAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC.</p> : null}
        <div className="payment-review-fields">
          {!crypto ? <>
            <label>Received amount in minor units (cents)<input className="input-field" inputMode="numeric" value={field(payment, "amount")} onChange={(e) => change(payment, "amount", e.target.value)} /></label>
            <label>Currency<input className="input-field" value={field(payment, "currency")} onChange={(e) => change(payment, "currency", e.target.value.toUpperCase())} maxLength={3} /></label>
            <label>Matched bank transaction reference<input className="input-field" value={field(payment, "bankRef")} onChange={(e) => change(payment, "bankRef", e.target.value)} maxLength={160} /></label>
          </> : <>
            <p className="payment-warning">The server will query the configured read-only RPC and validate the transaction, token, recipient, amount and finality. If the provider is unavailable, a Super Administrator may use the explicitly audited manual-review fallback only after independently inspecting the chain explorer. A pending, failed or mismatched RPC result blocks approval and remains pending for investigation.</p>
            <label>Observed token amount in base units<input className="input-field" inputMode="numeric" value={field(payment, "tokenAmount")} onChange={(e) => change(payment, "tokenAmount", e.target.value)} /></label>
          </>}
          <label>Independent evidence reference{crypto ? " (HTTPS explorer URL)" : " (bank record/reference)"}<input className="input-field" value={field(payment, "evidence")} onChange={(e) => change(payment, "evidence", e.target.value)} maxLength={500} /></label>
          <label>Reason / review notes<textarea className="input-field" value={field(payment, "reason")} onChange={(e) => change(payment, "reason", e.target.value)} minLength={8} maxLength={500} rows={3} /></label>
        </div>
        <div className="page-actions">
          <button type="button" className="button button-primary" disabled={busyId === payment.id} onClick={() => void decide(payment, crypto ? "APPROVE_CRYPTO_PAYMENT" : "APPROVE_BANK_TRANSFER")}>{busyId === payment.id ? "Saving…" : "Approve verified payment"}</button>
          <button type="button" className="button button-secondary" disabled={busyId === payment.id} onClick={() => void decide(payment, crypto ? "REJECT_CRYPTO_PAYMENT" : "REJECT_BANK_TRANSFER")}>Reject claim</button>
        </div>
      </article>;
    })}
    <div className="section-header"><div><h2>Recent payment records</h2><p>Latest 100 records.</p></div></div>
    <div className="glass-panel admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Payment</th><th scope="col">Provider</th><th scope="col">Currency</th><th scope="col">Amount (minor units)</th><th scope="col">Status</th></tr></thead><tbody>{recent.map((payment) => <tr key={payment.id}><td><code>{payment.id}</code></td><td>{payment.provider ?? "—"}</td><td>{payment.currency}</td><td>{payment.amountMinor}</td><td>{payment.status ?? "PENDING"}</td></tr>)}</tbody></table></div>
  </section>;
}
