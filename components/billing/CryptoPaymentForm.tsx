"use client";

import { useState } from "react";

type Rail = { asset: "USDT" | "USDC"; network: "TRON" | "BNB_SMART_CHAIN" | "ETHEREUM" | "SOLANA"; address: string; tokenIdentifier: string; tokenDecimals: number };
type Invoice = { id: string; invoiceNumber: string | null; currency: "USD"; amountRemainingMinor: string; expectedTokenAmountBaseUnits: string; expectedTokenAmount: string };

export function CryptoPaymentForm({ invoice, rails }: { invoice: Invoice; rails: Rail[] }) {
  const [selected, setSelected] = useState(rails[0] ? `${rails[0].asset}:${rails[0].network}` : "");
  const [transactionReference, setTransactionReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const rail = rails.find((item) => `${item.asset}:${item.network}` === selected);

  async function copyAddress() {
    if (!rail) return;
    try {
      await navigator.clipboard.writeText(rail.address);
      setStatus("Destination address copied.");
      setError("");
    } catch {
      setError("Clipboard access was denied. Select and copy the address manually.");
    }
  }

  async function submitClaim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rail) return;
    setBusy(true); setStatus(""); setError("");
    try {
      const response = await fetch("/api/billing/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          method: "CRYPTO",
          asset: rail.asset,
          network: rail.network,
          transactionReference: transactionReference.trim(),
        }),
      });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error ?? "The payment claim could not be submitted.");
      setStatus(body.message ?? "Claim recorded. Finance review is pending.");
      setTransactionReference("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The payment claim could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  if (!rails.length) return <section className="glass-panel"><h2>Cryptocurrency is unavailable</h2><p>There are no network configurations that have passed the current destination, token, quote-policy and manual-review gates. No wallet details are being displayed.</p></section>;

  return (
    <section className="page-stack">
      <div className="glass-panel">
        <h2>Payment order</h2>
        <p>Invoice: <strong>{invoice.invoiceNumber ?? invoice.id}</strong></p>
        <p>USD amount due: <strong>${invoice.expectedTokenAmount}</strong></p>
        <p>Required token amount: <strong>{invoice.expectedTokenAmount} {rail?.asset ?? ""}</strong></p>
        <p className="muted">The configured policy treats approved USD stablecoin payments at a 1:1 quote for this order. Stablecoins may depeg; use this only after the finance owner has approved and verified this quote policy.</p>
      </div>
      <div className="glass-panel">
        <label htmlFor="crypto-rail">Asset and network</label>
        <select id="crypto-rail" value={selected} onChange={(event) => { setSelected(event.target.value); setStatus(""); setError(""); }} className="input-field">
          {rails.map((item) => <option key={`${item.asset}:${item.network}`} value={`${item.asset}:${item.network}`}>{item.asset} — {item.network.replaceAll("_", " ")}</option>)}
        </select>
        {rail ? <>
          <p className="field-label">Verified destination address</p>
          <p className="payment-address"><code>{rail.address}</code></p>
          <button className="button button-secondary" type="button" onClick={copyAddress}>Copy address</button>
          <p className="field-label">Token identifier (confirm on explorer)</p>
          <code className="token-identifier">{rail.tokenIdentifier}</code>
          <p role="note" className="payment-warning">Send only {rail.asset} on {rail.network.replaceAll("_", " ")}. Sending another asset or using another network can permanently lose your funds. Confirm the address and token identifier before sending.</p>
        </> : null}
      </div>
      <form className="glass-panel page-stack" onSubmit={submitClaim}>
        <h2>Submit your transaction for verification</h2>
        <label htmlFor="crypto-tx-reference">Transaction hash / signature</label>
        <input id="crypto-tx-reference" className="input-field" value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} minLength={32} maxLength={160} required autoComplete="off" spellCheck={false} />
        <p className="muted">Click this only after you have sent the exact amount. Submission records a claim; it does not verify blockchain receipt or activate access. A finance reviewer must independently inspect the relevant token transfer and evidence before approving it.</p>
        <button className="button button-primary" type="submit" disabled={busy || !rail}>{busy ? "Submitting…" : "I've Made the Payment"}</button>
        {status ? <p role="status" className="payment-success">{status}</p> : null}
        {error ? <p role="alert" className="payment-error">{error}</p> : null}
      </form>
    </section>
  );
}
