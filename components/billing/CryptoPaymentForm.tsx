"use client";

import { useState } from "react";

type Rail = { asset: "USDT" | "USDC"; network: "TRON" | "BNB_SMART_CHAIN" | "ETHEREUM" | "SOLANA"; address: string; tokenIdentifier: string; tokenDecimals: number };
type Invoice = { id: string; invoiceNumber: string | null; currency: "USD"; amountRemainingMinor: string; expectedTokenAmountBaseUnits: string; expectedTokenAmount: string };
type PaymentOrder = {
  payment: { id: string; providerPaymentId: string; status: string; amountMinor: string };
  invoice: { id: string; invoiceNumber: string | null; currency: "USD"; amountRemainingMinor: string };
  order: {
    paymentReference: string; asset: "USDT" | "USDC"; network: string; destinationAddress: string;
    tokenIdentifier: string; tokenDecimals: number; expectedTokenAmountBaseUnits: string;
    expectedTokenAmount: string; expiresAt: string;
  };
};

export function CryptoPaymentForm({ invoice, rails }: { invoice: Invoice; rails: Rail[] }) {
  const [selected, setSelected] = useState(rails[0] ? `${rails[0].asset}:${rails[0].network}` : "");
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [transactionReference, setTransactionReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const rail = rails.find((item) => `${item.asset}:${item.network}` === selected);

  async function copyAddress() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.order.destinationAddress);
      setStatus("Destination address copied.");
      setError("");
    } catch {
      setError("Clipboard access was denied. Select and copy the address manually.");
    }
  }

  async function createOrder() {
    if (!rail) return;
    setBusy(true); setStatus(""); setError("");
    try {
      const response = await fetch("/api/billing/crypto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "INITIATE", invoiceId: invoice.id, asset: rail.asset, network: rail.network }),
      });
      const body = await response.json() as { data?: PaymentOrder; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error ?? "A crypto payment order could not be created.");
      setOrder(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "A crypto payment order could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function submitClaim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;
    setBusy(true); setStatus(""); setError("");
    try {
      const response = await fetch("/api/billing/crypto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT",
          paymentId: order.payment.id,
          transactionReference: transactionReference.trim(),
        }),
      });
      const body = await response.json() as { error?: string; message?: string; data?: { latePayment?: boolean } };
      if (!response.ok) throw new Error(body.error ?? "The payment claim could not be submitted.");
      setStatus(`${body.message ?? "Claim recorded. Finance review is pending."}${body.data?.latePayment ? " This claim was submitted after the order expiry and requires manual review." : ""}`);
      setTransactionReference("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The payment claim could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  if (!rails.length) return <section className="glass-panel"><h2>Cryptocurrency is unavailable</h2><p>No network configuration has passed the destination, token identity, quote-policy and manual-review gates. No wallet details are being displayed.</p></section>;

  return (
    <section className="page-stack">
      <div className="glass-panel">
        <h2>Invoice amount</h2>
        <p>Invoice: <strong>{invoice.invoiceNumber ?? invoice.id}</strong></p>
        <p>Outstanding USD amount: <strong>${invoice.expectedTokenAmount}</strong></p>
        <p className="muted">The order uses the explicitly configured USD-parity quote policy. Stablecoins can depeg and token transfers may be irreversible. Review the asset, network, destination and amount before sending.</p>
      </div>
      <div className="glass-panel">
        <label htmlFor="crypto-rail">Asset and network</label>
        <select id="crypto-rail" value={selected} disabled={Boolean(order) || busy} onChange={(event) => { setSelected(event.target.value); setStatus(""); setError(""); }} className="input-field">
          {rails.map((item) => <option key={`${item.asset}:${item.network}`} value={`${item.asset}:${item.network}`}>{item.asset} — {item.network.replaceAll("_", " ")}</option>)}
        </select>
        {!order ? <div className="page-actions" style={{ marginTop: 16 }}>
          <button className="button button-primary" type="button" disabled={busy || !rail} onClick={createOrder}>{busy ? "Creating order…" : "Create payment order"}</button>
        </div> : null}
      </div>

      {order ? <>
        <div className="glass-panel">
          <h2>Payment order</h2>
          <p>Order reference: <strong><code>{order.order.paymentReference}</code></strong></p>
          <p>Required amount: <strong>{order.order.expectedTokenAmount} {order.order.asset}</strong></p>
          <p>Network: <strong>{order.order.network.replaceAll("_", " ")}</strong></p>
          <p>Expires: <strong>{new Date(order.order.expiresAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</strong></p>
          <p className="field-label">Destination address</p>
          <p className="payment-address"><code>{order.order.destinationAddress}</code></p>
          <button className="button button-secondary" type="button" onClick={copyAddress}>Copy address</button>
          <p className="field-label">Verified token identifier</p>
          <code className="token-identifier">{order.order.tokenIdentifier}</code>
          <p role="note" className="payment-warning">Send only {order.order.asset} on {order.order.network.replaceAll("_", " ")} to this address and include the exact order amount. Do not use another token or network. If the order expires, the payment may require manual review even if funds arrive.</p>
        </div>
        <form className="glass-panel page-stack" onSubmit={submitClaim}>
          <h2>Submit transaction for verification</h2>
          <label htmlFor="crypto-tx-reference">Transaction hash / signature</label>
          <input id="crypto-tx-reference" className="input-field" value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} minLength={32} maxLength={160} required autoComplete="off" spellCheck={false} />
          <p className="muted">Click after sending the displayed amount. This records a pending claim only. It does not confirm blockchain receipt or activate paid access. An authorized reviewer must independently verify the correct network, token, destination, successful token transfer, amount, confirmation policy, and absence of a prior credit.</p>
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Submitting…" : "I've Made the Payment"}</button>
        </form>
      </> : null}
      {status ? <p role="status" className="payment-success">{status}</p> : null}
      {error ? <p role="alert" className="payment-error">{error}</p> : null}
    </section>
  );
}
