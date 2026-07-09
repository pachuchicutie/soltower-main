import { economyConfig } from "@soltower/shared";
import { WalletAuthError } from "./api";

const DEFAULT_SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

export async function assertClientTowerTokenGate(walletPublicKey: string): Promise<void> {
  const balance = await loadClientTowerBalance(walletPublicKey);
  if (balance < economyConfig.tokenGate.playMinimumTower) {
    throw new WalletAuthError(
      "tower_token_gate",
      `Sorry, entering SolBloom Village requires at least ${economyConfig.tokenGate.playMinimumTower.toLocaleString()} ${economyConfig.towerToken.symbol}`
    );
  }
}

async function loadClientTowerBalance(walletPublicKey: string): Promise<number> {
  let response: Response;
  try {
    response = await fetch((import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ?? DEFAULT_SOLANA_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "soltower-client-token-gate",
        method: "getTokenAccountsByOwner",
        params: [
          walletPublicKey,
          { mint: economyConfig.towerToken.mint },
          { encoding: "jsonParsed" }
        ]
      })
    });
  } catch {
    throw unavailableGateError();
  }
  if (!response.ok) {
    throw unavailableGateError();
  }
  const payload = await response.json() as unknown;
  if (!isRecord(payload) || isRecord(payload.error)) {
    throw unavailableGateError();
  }
  const result = isRecord(payload.result) ? payload.result : {};
  const accounts = Array.isArray(result.value) ? result.value : [];
  return accounts.reduce((total, account) => total + tokenAccountUiAmount(account), 0);
}

function unavailableGateError(): WalletAuthError {
  return new WalletAuthError(
    "tower_token_check_unavailable",
    `${economyConfig.towerToken.symbol} wallet check is temporarily unavailable`
  );
}

function tokenAccountUiAmount(account: unknown): number {
  const parsedAccount = isRecord(account) ? account : {};
  const accountData = isRecord(parsedAccount.account) ? parsedAccount.account : {};
  const data = isRecord(accountData.data) ? accountData.data : {};
  const parsed = isRecord(data.parsed) ? data.parsed : {};
  const info = isRecord(parsed.info) ? parsed.info : {};
  const tokenAmount = isRecord(info.tokenAmount) ? info.tokenAmount : {};
  const uiAmount = tokenAmount.uiAmount;
  if (typeof uiAmount === "number" && Number.isFinite(uiAmount)) {
    return uiAmount;
  }
  if (typeof tokenAmount.uiAmountString === "string") {
    const parsedUiAmount = Number(tokenAmount.uiAmountString);
    if (Number.isFinite(parsedUiAmount)) {
      return parsedUiAmount;
    }
  }
  try {
    const rawAmount = BigInt(typeof tokenAmount.amount === "string" ? tokenAmount.amount : "0");
    const decimals = typeof tokenAmount.decimals === "number" ? tokenAmount.decimals : 0;
    return Number(rawAmount) / 10 ** decimals;
  } catch {
    return 0;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
