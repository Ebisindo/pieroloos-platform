import { createHash } from "node:crypto";

export type CryptoRailNetwork = "TRON" | "BNB_SMART_CHAIN" | "ETHEREUM" | "SOLANA";

export type CryptoVerificationInput = {
  network: CryptoRailNetwork;
  transactionReference: string;
  destinationAddress: string;
  tokenIdentifier: string;
  tokenDecimals: number;
  expectedTokenAmountBaseUnits: string;
};

export type CryptoVerificationResult =
  | { status: "CONFIRMED"; receivedAmountBaseUnits: string; confirmations: number; blockReference: string; blockTimestamp: string; provider: string }
  | { status: "PENDING"; reason: string; confirmations?: number }
  | { status: "FAILED"; reason: string }
  | { status: "MISMATCH"; reason: string; confirmations?: number }
  | { status: "UNAVAILABLE"; reason: string };

type JsonRecord = Record<string, unknown>;
type Fetcher = typeof fetch;

const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asSafeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function positiveInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function hexNumber(value: unknown): number | null {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) return null;
  const parsed = Number.parseInt(value.slice(2), 16);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function safeBigInt(value: string): bigint | null {
  try {
    if (!/^\d+$/.test(value)) return null;
    return BigInt(value);
  } catch {
    return null;
  }
}

function normalizedEvmAddress(value: string): string | null {
  const match = value.trim().match(/^(?:0x)?([0-9a-f]{40})$/i);
  return match ? match[1].toLowerCase() : null;
}

function normalizedTronAddress(value: string): string | null {
  const input = value.trim();
  const hex = input.replace(/^0x/i, "");
  if (/^(?:41)?[0-9a-f]{40}$/i.test(hex)) {
    return (hex.length === 42 ? hex.slice(2) : hex).toLowerCase();
  }
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = BigInt(0);
  for (const char of input) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) return null;
    number = number * BigInt(58) + BigInt(digit);
  }
  let hexValue = number.toString(16);
  if (hexValue.length % 2) hexValue = "0" + hexValue;
  let decoded: number[] = [];
  for (let index = 0; index < hexValue.length; index += 2) decoded.push(Number.parseInt(hexValue.slice(index, index + 2), 16));
  for (const char of input) {
    if (char !== "1") break;
    decoded.unshift(0);
  }
  if (decoded.length < 5) return null;
  const bytes = Uint8Array.from(decoded);
  const payload = bytes.slice(0, -4);
  const checksum = bytes.slice(-4);
  const first = createHash("sha256").update(payload).digest();
  const expectedChecksum = createHash("sha256").update(first).digest().subarray(0, 4);
  if (checksum.length !== expectedChecksum.length || !checksum.every((byte, i) => byte === expectedChecksum[i])) return null;
  if (payload.length !== 21 || payload[0] !== 0x41) return null;
  return Buffer.from(payload.subarray(1)).toString("hex");
}

async function fetchJson(
  url: string,
  init: RequestInit,
  fetcher: Fetcher,
): Promise<unknown> {
  const response = await fetcher(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return await response.json() as unknown;
}

async function rpc(
  url: string,
  method: string,
  params: unknown[],
  fetcher: Fetcher,
): Promise<unknown> {
  const response = record(await fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }, fetcher));
  if (!response) throw new Error("Malformed JSON-RPC response");
  if (response.error) throw new Error("RPC returned an error");
  return response.result;
}

function urlForRpc(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return url;
  } catch {
    return null;
  }
}

function unavailable(reason: string): CryptoVerificationResult {
  return { status: "UNAVAILABLE", reason };
}

export async function verifyCryptoTransfer(
  input: CryptoVerificationInput,
  env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch,
): Promise<CryptoVerificationResult> {
  const prefix = `CRYPTO_${input.network}`;
  const rpcUrlValue = env[`${prefix}_RPC_URL`];
  const rpcUrl = rpcUrlValue ? urlForRpc(rpcUrlValue) : null;
  const minConfirmations = positiveInteger(env[`${prefix}_MIN_CONFIRMATIONS`]);
  const expectedAmount = safeBigInt(input.expectedTokenAmountBaseUnits);
  if (!rpcUrl) return unavailable(`No valid secure RPC endpoint is configured for ${input.network}.`);
  if (env[`${prefix}_MAINNET_VERIFIED`] !== "true") return unavailable(`The configured ${input.network} endpoint has not passed the mainnet verification gate.`);
  if (!minConfirmations) return unavailable(`A positive confirmation threshold is required for ${input.network}.`);
  if (!expectedAmount || expectedAmount <= BigInt(0)) return { status: "MISMATCH", reason: "Expected token amount is invalid." };
  if (!Number.isSafeInteger(input.tokenDecimals) || input.tokenDecimals < 2 || input.tokenDecimals > 18) return { status: "MISMATCH", reason: "Token decimal configuration is invalid." };

  if (input.network === "ETHEREUM" || input.network === "BNB_SMART_CHAIN") {
    const expectedChainId = input.network === "ETHEREUM" ? "0x1" : "0x38";
    const destination = normalizedEvmAddress(input.destinationAddress);
    const token = normalizedEvmAddress(input.tokenIdentifier);
    const transactionHash = input.transactionReference.toLowerCase();
    if (!destination || !token || !/^0x[0-9a-f]{64}$/.test(transactionHash)) {
      return { status: "MISMATCH", reason: "Transaction hash, token contract, or destination address has an invalid format." };
    }
    try {
      const chainId = asString(await rpc(rpcUrl.toString(), "eth_chainId", [], fetcher));
      if (!chainId || chainId.toLowerCase() !== expectedChainId) return { status: "MISMATCH", reason: "The RPC endpoint is not connected to the intended mainnet." };
      const receipt = record(await rpc(rpcUrl.toString(), "eth_getTransactionReceipt", [transactionHash], fetcher));
      if (!receipt) return { status: "PENDING", reason: "The transaction receipt is not yet available." };
      if (asString(receipt.transactionHash)?.toLowerCase() !== transactionHash) return { status: "MISMATCH", reason: "RPC returned a receipt for a different transaction." };
      if (asString(receipt.status)?.toLowerCase() !== "0x1") return { status: "FAILED", reason: "The blockchain receipt does not indicate a successful transaction." };
      const transactionBlock = hexNumber(receipt.blockNumber);
      if (transactionBlock === null) return { status: "PENDING", reason: "Transaction block information is not yet available." };
      const [latestBlock, blockValue] = await Promise.all([
        rpc(rpcUrl.toString(), "eth_blockNumber", [], fetcher),
        rpc(rpcUrl.toString(), "eth_getBlockByNumber", [asString(receipt.blockNumber), false], fetcher),
      ]);
      const latestHeight = hexNumber(latestBlock);
      const block = record(blockValue);
      const blockTimeSeconds = hexNumber(block?.timestamp);
      if (latestHeight === null || latestHeight < transactionBlock || blockTimeSeconds === null) {
        return { status: "PENDING", reason: "Latest block height or transaction block timestamp is unavailable." };
      }
      const confirmations = latestHeight - transactionBlock + 1;
      if (confirmations < minConfirmations) return { status: "PENDING", reason: "The transaction has not reached the configured confirmation threshold.", confirmations };
      const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
      let received = BigInt(0);
      for (const rawLog of logs) {
        const log = record(rawLog);
        if (!log || normalizedEvmAddress(asString(log.address) ?? "") !== token) continue;
        if (!Array.isArray(log.topics) || log.topics.length < 3) continue;
        if (asString(log.topics[0])?.toLowerCase() !== TRANSFER_EVENT_TOPIC) continue;
        const recipientTopic = asString(log.topics[2])?.toLowerCase();
        if (!recipientTopic || recipientTopic.replace(/^0x/, "").slice(-40) !== destination) continue;
        const data = asString(log.data);
        if (!data || !/^0x[0-9a-f]+$/i.test(data)) continue;
        received += BigInt(data);
      }
      if (received !== expectedAmount) return { status: "MISMATCH", reason: received === BigInt(0) ? "No matching successful token transfer to the configured destination was found." : "The received token amount does not exactly match the order.", confirmations };
      return { status: "CONFIRMED", receivedAmountBaseUnits: received.toString(), confirmations, blockReference: String(transactionBlock), blockTimestamp: new Date(blockTimeSeconds * 1000).toISOString(), provider: "evm-json-rpc" };
    } catch {
      return unavailable("The EVM RPC provider could not verify the transaction. Keep it pending for manual review.");
    }
  }

  if (input.network === "TRON") {
    const destination = normalizedTronAddress(input.destinationAddress);
    const token = normalizedTronAddress(input.tokenIdentifier);
    const transactionHash = input.transactionReference.toLowerCase();
    if (!destination || !token || !/^[0-9a-f]{64}$/.test(transactionHash)) {
      return { status: "MISMATCH", reason: "TRON transaction ID, token contract, or destination address has an invalid format." };
    }
    try {
      const base = rpcUrl.toString().replace(/\/+$/, "") + "/";
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (env.CRYPTO_TRON_RPC_API_KEY) headers["TRON-PRO-API-KEY"] = env.CRYPTO_TRON_RPC_API_KEY;
      const [infoValue, currentBlockValue] = await Promise.all([
        fetchJson(new URL("wallet/gettransactioninfobyid", base).toString(), { method: "POST", headers, body: JSON.stringify({ value: transactionHash }) }, fetcher),
        fetchJson(new URL("wallet/getnowblock", base).toString(), { method: "POST", headers, body: "{}" }, fetcher),
      ]);
      const info = record(infoValue);
      const block = record(record(currentBlockValue)?.block_header);
      const currentRawData = record(block?.raw_data);
      const currentHeight = asSafeInteger(currentRawData?.number);
      if (!info || !Object.keys(info).length) return { status: "PENDING", reason: "The TRON transaction is not yet indexed." };
      if (asString(info.id)?.toLowerCase() && asString(info.id)?.toLowerCase() !== transactionHash) return { status: "MISMATCH", reason: "RPC returned transaction information for a different transaction." };
      const receipt = record(info.receipt);
      if (asString(receipt?.result) !== "SUCCESS") {
        if (!receipt?.result) return { status: "PENDING", reason: "TRON execution result is not yet available." };
        return { status: "FAILED", reason: "TRON execution did not succeed." };
      }
      const transactionBlock = asSafeInteger(info.blockNumber);
      const blockTimeMilliseconds = asSafeInteger(info.blockTimeStamp);
      if (transactionBlock === null || currentHeight === null || currentHeight < transactionBlock ||
          blockTimeMilliseconds === null || blockTimeMilliseconds <= 0) return { status: "PENDING", reason: "TRON block confirmation or timestamp information is unavailable." };
      const confirmations = currentHeight - transactionBlock + 1;
      if (confirmations < minConfirmations) return { status: "PENDING", reason: "The TRON transaction has not reached the configured confirmation threshold.", confirmations };
      const logs = Array.isArray(info.log) ? info.log : [];
      let received = BigInt(0);
      for (const rawLog of logs) {
        const log = record(rawLog);
        if (!log) continue;
        const contract = asString(log.address)?.replace(/^41/i, "").toLowerCase();
        if (contract !== token || !Array.isArray(log.topics) || log.topics.length < 3) continue;
        if (asString(log.topics[0])?.toLowerCase() !== TRANSFER_EVENT_TOPIC.replace(/^0x/, "")) continue;
        const recipient = asString(log.topics[2])?.toLowerCase().slice(-40);
        if (recipient !== destination) continue;
        const data = asString(log.data);
        if (!data || !/^[0-9a-f]+$/i.test(data)) continue;
        received += BigInt("0x" + data);
      }
      if (received !== expectedAmount) return { status: "MISMATCH", reason: received === BigInt(0) ? "No matching successful TRC-20 transfer to the configured destination was found." : "The received token amount does not exactly match the order.", confirmations };
      return { status: "CONFIRMED", receivedAmountBaseUnits: received.toString(), confirmations, blockReference: String(transactionBlock), blockTimestamp: new Date(blockTimeMilliseconds).toISOString(), provider: "tron-full-node-api" };
    } catch {
      return unavailable("The TRON RPC provider could not verify the transaction. Keep it pending for manual review.");
    }
  }

  // Solana: require a finalized getTransaction response and independently verify the
  // positive token-balance delta for the configured owner and mint.
  const transactionSignature = input.transactionReference;
  try {
    const txValue = record(await rpc(rpcUrl.toString(), "getTransaction", [
      transactionSignature,
      { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 0 },
    ], fetcher));
    if (!txValue) return { status: "PENDING", reason: "The finalized Solana transaction is not yet available." };
    const meta = record(txValue.meta);
    if (!meta) return { status: "PENDING", reason: "Solana transaction metadata is not yet available." };
    if (meta.err !== null) return { status: "FAILED", reason: "Solana transaction execution failed." };
    const slot = asSafeInteger(txValue.slot);
    const blockTimeSeconds = asSafeInteger(txValue.blockTime);
    if (slot === null || blockTimeSeconds === null || blockTimeSeconds <= 0) return { status: "PENDING", reason: "Solana finalized slot or transaction timestamp is unavailable." };
    const currentSlot = asSafeInteger(await rpc(rpcUrl.toString(), "getSlot", [{ commitment: "finalized" }], fetcher));
    if (currentSlot === null || currentSlot < slot) return { status: "PENDING", reason: "Solana confirmation depth is unavailable." };
    const confirmations = currentSlot - slot + 1;
    if (confirmations < minConfirmations) return { status: "PENDING", reason: "The finalized Solana slot has not reached the configured depth.", confirmations };

    const pre = Array.isArray(meta.preTokenBalances) ? meta.preTokenBalances : [];
    const post = Array.isArray(meta.postTokenBalances) ? meta.postTokenBalances : [];
    const balanceKey = (raw: unknown) => {
      const balance = record(raw);
      if (!balance) return null;
      const owner = asString(balance.owner);
      const mint = asString(balance.mint);
      const accountIndex = asSafeInteger(balance.accountIndex);
      const tokenAmount = record(balance.uiTokenAmount);
      const amount = asString(tokenAmount?.amount);
      const decimals = asSafeInteger(tokenAmount?.decimals);
      if (!owner || !mint || accountIndex === null || !amount || decimals === null) return null;
      return { key: `${accountIndex}:${owner}:${mint}`, owner, mint, amount: safeBigInt(amount), decimals };
    };
    const preBalances = new Map<string, bigint>();
    for (const raw of pre) {
      const balance = balanceKey(raw);
      if (balance?.amount !== null && balance?.amount !== undefined) preBalances.set(balance.key, balance.amount);
    }
    let received = BigInt(0);
    let matched = false;
    for (const raw of post) {
      const balance = balanceKey(raw);
      if (!balance || balance.owner !== input.destinationAddress || balance.mint !== input.tokenIdentifier) continue;
      if (balance.amount === null || balance.decimals !== input.tokenDecimals) return { status: "MISMATCH", reason: "Solana token balance decimals do not match the verified token configuration." };
      const prior = preBalances.get(balance.key) ?? BigInt(0);
      received += balance.amount - prior;
      matched = true;
    }
    if (!matched || received !== expectedAmount) return { status: "MISMATCH", reason: "The Solana transaction does not contain the exact net token balance increase for the configured owner and mint.", confirmations };
    return { status: "CONFIRMED", receivedAmountBaseUnits: received.toString(), confirmations, blockReference: String(slot), blockTimestamp: new Date(blockTimeSeconds * 1000).toISOString(), provider: "solana-rpc-finalized" };
  } catch {
    return unavailable("The Solana RPC provider could not verify the transaction. Keep it pending for manual review.");
  }
}
