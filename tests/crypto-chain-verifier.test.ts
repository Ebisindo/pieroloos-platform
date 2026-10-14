import { describe, expect, it, vi } from "vitest";
import { verifyCryptoTransfer } from "@/lib/services/crypto-chain-verifier";

const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const destination = "0x2222222222222222222222222222222222222222";
const token = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const txHash = `0x${"b".repeat(64)}`;
const topicAddress = (address: string) => `0x${address.replace(/^0x/, "").padStart(64, "0")}`;

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

function fetchSequence(values: unknown[]) {
  let index = 0;
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const value = values[index++];
    return response(value);
  }) as unknown as typeof fetch;
}

describe("crypto chain verifier", () => {
  it("fails closed when the RPC endpoint or mainnet verification is absent", async () => {
    const missing = await verifyCryptoTransfer({
      network: "ETHEREUM",
      transactionReference: txHash,
      destinationAddress: destination,
      tokenIdentifier: token,
      tokenDecimals: 6,
      expectedTokenAmountBaseUnits: "1000000",
    }, {});
    expect(missing.status).toBe("UNAVAILABLE");

    const unverifiedNetwork = await verifyCryptoTransfer({
      network: "ETHEREUM",
      transactionReference: txHash,
      destinationAddress: destination,
      tokenIdentifier: token,
      tokenDecimals: 6,
      expectedTokenAmountBaseUnits: "1000000",
    }, {
      CRYPTO_ETHEREUM_RPC_URL: "https://rpc.example.invalid",
      CRYPTO_ETHEREUM_MIN_CONFIRMATIONS: "12",
    });
    expect(unverifiedNetwork.status).toBe("UNAVAILABLE");
  });

  it("confirms an exact ERC-20 transfer only after the configured confirmation depth", async () => {
    const receipt = {
      transactionHash: txHash,
      status: "0x1",
      blockNumber: "0x10",
      logs: [{
        address: token,
        topics: [TRANSFER, topicAddress("0x1111111111111111111111111111111111111111"), topicAddress(destination)],
        data: "0xf4240",
      }],
    };
    const fetcher = fetchSequence([
      { jsonrpc: "2.0", id: 1, result: "0x1" },
      { jsonrpc: "2.0", id: 1, result: receipt },
      { jsonrpc: "2.0", id: 1, result: "0x1b" },
    ]);
    const result = await verifyCryptoTransfer({
      network: "ETHEREUM",
      transactionReference: txHash,
      destinationAddress: destination,
      tokenIdentifier: token,
      tokenDecimals: 6,
      expectedTokenAmountBaseUnits: "1000000",
    }, {
      CRYPTO_ETHEREUM_RPC_URL: "https://rpc.example.invalid",
      CRYPTO_ETHEREUM_MAINNET_VERIFIED: "true",
      CRYPTO_ETHEREUM_MIN_CONFIRMATIONS: "12",
    }, fetcher);

    expect(result).toEqual({
      status: "CONFIRMED",
      receivedAmountBaseUnits: "1000000",
      confirmations: 12,
      blockReference: "16",
      provider: "evm-json-rpc",
    });
  });

  it("rejects an RPC connected to the wrong EVM chain", async () => {
    const fetcher = fetchSequence([{ jsonrpc: "2.0", id: 1, result: "0x38" }]);
    const result = await verifyCryptoTransfer({
      network: "ETHEREUM",
      transactionReference: txHash,
      destinationAddress: destination,
      tokenIdentifier: token,
      tokenDecimals: 6,
      expectedTokenAmountBaseUnits: "1000000",
    }, {
      CRYPTO_ETHEREUM_RPC_URL: "https://rpc.example.invalid",
      CRYPTO_ETHEREUM_MAINNET_VERIFIED: "true",
      CRYPTO_ETHEREUM_MIN_CONFIRMATIONS: "12",
    }, fetcher);
    expect(result.status).toBe("MISMATCH");
  });

  it("rejects a matching token transfer with the wrong amount or destination", async () => {
    const receipt = {
      transactionHash: txHash,
      status: "0x1",
      blockNumber: "0x10",
      logs: [{
        address: token,
        topics: [TRANSFER, topicAddress("0x1111111111111111111111111111111111111111"), topicAddress("0x3333333333333333333333333333333333333333")],
        data: "0xf4240",
      }],
    };
    const fetcher = fetchSequence([
      { jsonrpc: "2.0", id: 1, result: "0x1" },
      { jsonrpc: "2.0", id: 1, result: receipt },
      { jsonrpc: "2.0", id: 1, result: "0x20" },
    ]);
    const result = await verifyCryptoTransfer({
      network: "ETHEREUM",
      transactionReference: txHash,
      destinationAddress: destination,
      tokenIdentifier: token,
      tokenDecimals: 6,
      expectedTokenAmountBaseUnits: "1000000",
    }, {
      CRYPTO_ETHEREUM_RPC_URL: "https://rpc.example.invalid",
      CRYPTO_ETHEREUM_MAINNET_VERIFIED: "true",
      CRYPTO_ETHEREUM_MIN_CONFIRMATIONS: "12",
    }, fetcher);
    expect(result.status).toBe("MISMATCH");
  });

  it("uses the finalized Solana owner's token-balance delta for the configured mint", async () => {
    const owner = "SolanaWalletOwnerExample";
    const mint = "VerifiedMintExample";
    const txSignature = "5".repeat(64);
    const tokenBalance = (amount: string) => ({
      accountIndex: 4,
      owner,
      mint,
      uiTokenAmount: { amount, decimals: 6 },
    });
    const fetcher = fetchSequence([
      {
        jsonrpc: "2.0", id: 1, result: {
          slot: 100, meta: { err: null, preTokenBalances: [tokenBalance("0")], postTokenBalances: [tokenBalance("2500000")] },
        },
      },
      { jsonrpc: "2.0", id: 1, result: 200 },
    ]);
    const result = await verifyCryptoTransfer({
      network: "SOLANA",
      transactionReference: txSignature,
      destinationAddress: owner,
      tokenIdentifier: mint,
      tokenDecimals: 6,
      expectedTokenAmountBaseUnits: "2500000",
    }, {
      CRYPTO_SOLANA_RPC_URL: "https://rpc.example.invalid",
      CRYPTO_SOLANA_MAINNET_VERIFIED: "true",
      CRYPTO_SOLANA_MIN_CONFIRMATIONS: "32",
    }, fetcher);
    expect(result).toEqual({
      status: "CONFIRMED",
      receivedAmountBaseUnits: "2500000",
      confirmations: 101,
      blockReference: "100",
      provider: "solana-rpc-finalized",
    });
  });
});
