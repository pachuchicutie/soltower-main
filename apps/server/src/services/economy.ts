import {
  assertPositiveInteger,
  economyConfig,
  getDailySellCapacity,
  getBlackjackTableLimit,
  type BalanceType,
  type GoldSourceType,
  type LedgerDirection,
  type LedgerEntry,
  type PlayerProfileSummary,
  type PublicPlayer
} from "@soltower/shared";
import { cloneBalances, type DevStore, makeId, nowIso, type PlayerRecord } from "../data/store";

export interface LedgerMutationInput {
  playerId: string;
  balanceType: BalanceType;
  sourceType: GoldSourceType;
  amount: number;
  direction: LedgerDirection;
  reason: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  createdByAdminId?: string | null;
  referenceEntityType?: string | null;
  referenceEntityId?: string | null;
}

export function getPlayerOrThrow(store: DevStore, playerId: string): PlayerRecord {
  const player = store.players.get(playerId);
  if (!player) {
    throw new Error("Player not found");
  }
  return player;
}

export function getPublicPlayer(store: DevStore, playerId: string): PublicPlayer {
  const player = getPlayerOrThrow(store, playerId);
  return {
    id: player.id,
    displayName: player.displayName,
    walletPublicKey: player.walletPublicKey,
    walletLinkedAt: player.walletLinkedAt,
    accountLevel: player.accountLevel,
    xp: player.xp,
    avatar: player.avatar,
    power: player.power,
    status: player.status,
    marketFrozen: player.marketFrozen,
    blackjackFrozen: player.blackjackFrozen,
    unlockedMaps: [...player.unlockedMaps],
    balances: cloneBalances(player.balances)
  };
}

export function shortenWallet(publicKey: string | null): string | null {
  if (!publicKey) {
    return null;
  }
  return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
}

export function getPlayerProfileSummary(store: DevStore, playerId: string): PlayerProfileSummary {
  const player = getPlayerOrThrow(store, playerId);
  return {
    fullWalletAddress: player.walletPublicKey,
    shortenedWalletAddress: shortenWallet(player.walletPublicKey),
    accountLevel: player.accountLevel,
    xp: player.xp,
    selectedHero: player.selectedHeroId,
    power: player.power,
    balances: cloneBalances(player.balances),
    unlockedMaps: [...player.unlockedMaps],
    marketSellCapacityToday: getDailySellCapacity(player.accountLevel),
    blackjackTableTier: getBlackjackTableLimit(player.accountLevel)
  };
}

export function getBalance(store: DevStore, playerId: string, balanceType: BalanceType): number {
  return getPlayerOrThrow(store, playerId).balances[balanceType];
}

export function applyLedgerMutation(store: DevStore, input: LedgerMutationInput): LedgerEntry {
  assertPositiveInteger(input.amount, "Ledger amount");
  const existingReference = store.idempotency.get(input.idempotencyKey);
  if (existingReference?.type === "ledger") {
    const existing = store.ledger.find((entry) => entry.id === existingReference.id);
    if (!existing) {
      throw new Error("Idempotency reference is corrupt");
    }
    return existing;
  }
  if (existingReference) {
    throw new Error("Idempotency key already used for another operation");
  }

  const player = getPlayerOrThrow(store, input.playerId);
  const beforeBalance = player.balances[input.balanceType];
  const afterBalance =
    input.direction === "CREDIT" ? beforeBalance + input.amount : beforeBalance - input.amount;

  if (afterBalance < 0) {
    throw new Error(`Insufficient ${input.balanceType}`);
  }

  player.balances[input.balanceType] = afterBalance;
  const entry: LedgerEntry = {
    id: makeId("ledger"),
    playerId: input.playerId,
    balanceType: input.balanceType,
    sourceType: input.sourceType,
    amount: input.amount,
    direction: input.direction,
    beforeBalance,
    afterBalance,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata ?? {},
    createdAt: nowIso(),
    createdByAdminId: input.createdByAdminId ?? null,
    referenceEntityType: input.referenceEntityType ?? null,
    referenceEntityId: input.referenceEntityId ?? null
  };
  store.ledger.push(entry);
  store.idempotency.set(input.idempotencyKey, { type: "ledger", id: entry.id });
  return entry;
}

export function createDevPlayer(store: DevStore, displayName: string): PublicPlayer {
  const existing = Array.from(store.players.values()).find(
    (player) => player.displayName.toLowerCase() === displayName.toLowerCase()
  );
  if (existing) {
    return getPublicPlayer(store, existing.id);
  }
  const player: PlayerRecord = {
    id: makeId("player"),
    displayName,
    walletPublicKey: null,
    walletLinkedAt: null,
    accountLevel: 1,
    avatar: displayName.slice(0, 1).toUpperCase(),
    power: 360,
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
    walletAuthHistory: [],
    sessionStatus: "OFFLINE",
    presenceStatus: "OFFLINE",
    walletRiskFlag: null
  };
  store.players.set(player.id, player);
  applyLedgerMutation(store, {
    playerId: player.id,
    balanceType: "LOCKED_GOLD",
    sourceType: "STARTER_LOCKED_GOLD",
    amount: economyConfig.starterLockedGold,
    direction: "CREDIT",
    reason: "Starter Locked Gold",
    idempotencyKey: `starter:${player.id}`,
    metadata: { devMode: true }
  });
  return getPublicPlayer(store, player.id);
}

export function getLedgerForPlayer(store: DevStore, playerId: string): LedgerEntry[] {
  return store.ledger.filter((entry) => entry.playerId === playerId);
}

export function getDailySellUsed(store: DevStore, playerId: string, day: string): number {
  return store.marketTrades
    .filter(
      (trade) =>
        trade.sellerPlayerId === playerId && trade.createdAt.slice(0, 10) === day && trade.goldAmount > 0
    )
    .reduce((sum, trade) => sum + trade.goldAmount, 0);
}

export function assertCanSellEarnedGold(
  store: DevStore,
  playerId: string,
  goldAmount: number,
  day: string
): void {
  const player = getPlayerOrThrow(store, playerId);
  if (player.marketFrozen) {
    throw new Error("Market access is frozen");
  }
  if (player.accountLevel < 10) {
    throw new Error("Market selling unlocks at level 10");
  }
  const capacity = getDailySellCapacity(player.accountLevel);
  if (capacity <= 0) {
    throw new Error("No daily sell capacity available");
  }
  const used = getDailySellUsed(store, playerId, day);
  if (used + goldAmount > capacity) {
    throw new Error(`Daily sell capacity exceeded: ${used}/${capacity}`);
  }
  if (player.balances.EARNED_GOLD < goldAmount) {
    throw new Error("Only available Earned Gold can be sold");
  }
}

export function summarizeEconomy(store: DevStore): {
  earnedGold: number;
  lockedGold: number;
  testToken: number;
  ledgerEntries: number;
} {
  return Array.from(store.players.values()).reduce(
    (summary, player) => ({
      earnedGold: summary.earnedGold + player.balances.EARNED_GOLD,
      lockedGold: summary.lockedGold + player.balances.LOCKED_GOLD,
      testToken: summary.testToken + player.balances.TEST_TOKEN,
      ledgerEntries: store.ledger.length
    }),
    { earnedGold: 0, lockedGold: 0, testToken: 0, ledgerEntries: store.ledger.length }
  );
}
