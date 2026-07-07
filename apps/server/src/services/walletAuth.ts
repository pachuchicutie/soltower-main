import { createHash, randomBytes } from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { starterEquipment } from "@soltower/shared";
import type { DevStore, PlayerRecord, WalletNonceRecord } from "../data/store";
import { makeId, nowIso } from "../data/store";
import { applyLedgerMutation, getPublicPlayer } from "./economy";

const nonceTtlMs = 5 * 60 * 1000;

export function buildWalletLoginMessage(publicKey: string, nonce: string, expiresAt: string): string {
  return [
    "SolTower wallet login",
    "",
    "This signature verifies ownership of your wallet.",
    "It does not move funds or approve any transaction.",
    "",
    `Wallet: ${publicKey}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`
  ].join("\n");
}

export function createWalletNonce(store: DevStore, publicKey: string): WalletNonceRecord {
  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + nonceTtlMs).toISOString();
  const record: WalletNonceRecord = {
    publicKey,
    nonce,
    message: buildWalletLoginMessage(publicKey, nonce, expiresAt),
    expiresAt,
    usedAt: null,
    createdAt: nowIso(),
    ipPlaceholder: "local-dev"
  };
  store.walletNonces.set(nonce, record);
  return record;
}

export function assertValidWalletSignature(input: {
  publicKey: string;
  message: string;
  signature: string;
  allowDevMock: boolean;
}): void {
  if (input.allowDevMock && input.signature === "DEV_MOCK_SIGNATURE") {
    return;
  }

  let publicKeyBytes: Uint8Array;
  let signatureBytes: Uint8Array;
  try {
    publicKeyBytes = bs58.decode(input.publicKey);
    signatureBytes = bs58.decode(input.signature);
  } catch {
    throw new Error("Invalid base58 wallet signature payload");
  }
  if (publicKeyBytes.length !== 32 || signatureBytes.length !== 64) {
    throw new Error("Invalid wallet signature length");
  }
  const messageBytes = new TextEncoder().encode(input.message);
  if (!nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)) {
    throw new Error("Invalid wallet signature");
  }
}

export function isDisplayNameAvailable(store: DevStore, displayName: string): boolean {
  return !Array.from(store.players.values()).some(
    (player) => player.displayName.toLowerCase() === displayName.toLowerCase()
  );
}

export function authenticateWallet(
  store: DevStore,
  input: {
    publicKey: string;
    nonce: string;
    message: string;
    signature: string;
    displayName?: string;
    walletName?: string;
  }
): { playerId: string; isNewPlayer: boolean } {
  const nonce = store.walletNonces.get(input.nonce);
  if (!nonce || nonce.publicKey !== input.publicKey || nonce.message !== input.message) {
    throw new Error("Wallet nonce is invalid");
  }
  if (nonce.usedAt) {
    throw new Error("Wallet nonce has already been used");
  }
  if (Date.parse(nonce.expiresAt) <= Date.now()) {
    throw new Error("Wallet nonce has expired");
  }

  assertValidWalletSignature({
    publicKey: input.publicKey,
    message: input.message,
    signature: input.signature,
    allowDevMock: store.devMode && input.signature === "DEV_MOCK_SIGNATURE"
  });
  nonce.usedAt = nowIso();

  const existingPlayerId = store.walletToPlayer.get(input.publicKey);
  if (existingPlayerId) {
    const player = store.players.get(existingPlayerId);
    if (!player) {
      throw new Error("Wallet mapping is corrupt");
    }
    player.walletAuthHistory.push({
      publicKey: input.publicKey,
      walletName: input.walletName ?? "Detected Wallet",
      authenticatedAt: nowIso(),
      ipPlaceholder: "local-dev"
    });
    player.sessionStatus = "ONLINE";
    player.presenceStatus = "IN_TOWN";
    return { playerId: existingPlayerId, isNewPlayer: false };
  }

  if (!input.displayName) {
    throw new Error("Display name is required for first-time wallet setup");
  }
  if (!isDisplayNameAvailable(store, input.displayName)) {
    throw new Error("Display name is already taken");
  }

  const playerId = makeStablePlayerId(input.publicKey);
  const player: PlayerRecord = {
    id: playerId,
    displayName: input.displayName,
    walletPublicKey: input.publicKey,
    walletLinkedAt: nowIso(),
    accountLevel: 1,
    avatar: input.displayName.slice(0, 1).toUpperCase(),
    power: 420,
    status: "ACTIVE",
    marketFrozen: false,
    blackjackFrozen: false,
    unlockedMaps: ["tower-1-1"],
    balances: {
      EARNED_GOLD: 0,
      LOCKED_GOLD: 0,
      TEST_TOKEN: 0
    },
    xp: 0,
    selectedHeroId: "storm-archer",
    walletAuthHistory: [
      {
        publicKey: input.publicKey,
        walletName: input.walletName ?? "Detected Wallet",
        authenticatedAt: nowIso(),
        ipPlaceholder: "local-dev"
      }
    ],
    sessionStatus: "ONLINE",
    presenceStatus: "IN_TOWN",
    walletRiskFlag: null
  };
  store.players.set(player.id, player);
  store.walletToPlayer.set(input.publicKey, player.id);

  applyLedgerMutation(store, {
    playerId: player.id,
    balanceType: "LOCKED_GOLD",
    sourceType: "STARTER_LOCKED_GOLD",
    amount: 50,
    direction: "CREDIT",
    reason: "Starter Locked Gold for first wallet profile",
    idempotencyKey: `wallet-starter:${player.id}`,
    metadata: { walletPublicKey: input.publicKey }
  });

  starterEquipment.forEach((item) => {
    const id = makeId("equip");
    store.playerEquipment.set(id, {
      id,
      playerId: player.id,
      definitionId: item.id,
      equippedSlot: item.slot,
      bound: true,
      level: 1
    });
  });

  return { playerId: player.id, isNewPlayer: true };
}

export function makeWalletAuthResponse(store: DevStore, playerId: string, isNewPlayer: boolean) {
  const player = store.players.get(playerId);
  if (!player) {
    throw new Error("Player not found");
  }
  return {
    player: getPublicPlayer(store, playerId),
    isNewPlayer,
    intro: isNewPlayer ? "Welcome to SolBloom Village." : null,
    selectedHeroId: player.selectedHeroId,
    unlockedMapCount: player.unlockedMaps.length
  };
}

function makeStablePlayerId(publicKey: string): string {
  const digest = createHash("sha256").update(publicKey).digest("hex").slice(0, 16);
  return `wallet_${digest}`;
}
