"use client";

import { useState } from "react";

type Instructions = {
  accountHolder: string; bankName: string; accountType: string; accountNumber: string;
  achRouting: string; wireRouting: string; bankAddress: string; currency: string;
  supportedSendingRegion: string; achFee: string; wireFee: string; processingTime: string; swiftSupported: boolean;
};
type Order = {
  payment: { id: string; providerPaymentId: string; amountMinor: string; currency: string; status: string };
  invoice: { invoiceNumber: string | null; amountRemainingMinor: string; currency: string };
  instructions: Instructions;
};

function usd(minor: string) {
  const value = BigInt(minor);
  return `USD ${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, "0")}`;
}

export function BankTransferOrderButton({ invoiceId }: { invoiceId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function initiate() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/billing/bank-transfer", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "INITIATE", invoiceId }),
      });
      const body = await response.json() as { data?: Order; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error ?? "Bank-transfer instructions are unavailable.");
      setOrder(body.data); setSubmitted(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bank-transfer instructions are unavailable.");
    } finally { setBusy(false); }
  }

  async function submit() {
    if (!order) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/billing/bank-transfer", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT", paymentId: order.payment.id }),
      });
      const body = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "The transfer claim could not be submitted.");
      setSubmitted(true); setMessage(body.message ?? "Claim is pending verification.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The transfer claim could not be submitted.");
    } finally { setBusy(false); }
  }

  if (!order) return <div className="payment-action"><button type="button" className="button button-secondary" disabled={busy} onClick={initiate}>{busy ? "Preparing instructions…" : "Bank transfer instructions"}</button>{error ? <p role="alert" className="payment-error">{error}</p> : null}</div>;

  const bank = order.instructions;
  return (
    <div className="payment-action bank-transfer-order">
      <section className="glass-panel">
        <h3>Bank transfer instructions</h3>
        <p>Invoice: <strong>{order.invoice.invoiceNumber ?? invoiceId}</strong></p>
        <p>Transfer amount: <strong>{usd(order.payment.amountMinor)}</strong></p>
        <p>Payment reference (include this in the transfer): <strong><code>{order.payment.providerPaymentId}</code></strong></p>
        <dl className="bank-instructions">
          <div><dt>Account holder</dt><dd>{bank.accountHolder}</dd></div>
          <div><dt>Bank</dt><dd>{bank.bankName}</dd></div>
          <div><dt>Account type</dt><dd>{bank.accountType}</dd></div>
          <div><dt>Account number</dt><dd><code>{bank.accountNumber}</code></dd></div>
          <div><dt>ACH routing</dt><dd><code>{bank.achRouting}</code></dd></div>
          <div><dt>Wire routing</dt><dd><code>{bank.wireRouting}</code></dd></div>
          <div><dt>Bank address</dt><dd>{bank.bankAddress}</dd></div>
          <div><dt>Supported sending region</dt><dd>{bank.supportedSendingRegion}</dd></div>
          <div><dt>Reported ACH fee</dt><dd>{bank.achFee ? `USD ${bank.achFee}` : "Confirm with bank"}</dd></div>
          <div><dt>Reported wire fee</dt><dd>{bank.wireFee ? `USD ${bank.wireFee}` : "Confirm with bank"}</dd></div>
          <div><dt>Processing estimate</dt><dd>{bank.processingTime}</dd></div>
          <div><dt>SWIFT</dt><dd>{bank.swiftSupported ? "Supported" : "Not supported"}</dd></div>
        </dl>
        <p className="payment-warning">Verify the account holder, bank and payment reference before sending. Do not initiate an international/SWIFT transfer. Transfer fees may be charged by the originating institution.</p>
        <button type="button" className="button button-secondary" onClick={submit} disabled={busy || submitted}>{busy ? "Submitting…" : submitted ? "Claim submitted" : "I've Sent the Bank Transfer"}</button>
        {message ? <p role="status" className="payment-success">{message}</p> : null}
        {error ? <p role="alert" className="payment-error">{error}</p> : null}
      </section>
    </div>
  );
}
