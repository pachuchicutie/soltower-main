import { hashSync } from "bcryptjs";
import {
  type AdminRole,
  type BalanceSnapshot,
  type BalanceType,
  type BuyOrderStatus,
  type ChatChannel,
  type EquipmentDefinition,
  type HeroId,
  type LedgerEntry,
  type LobbyType,
  type MarketListingStatus,
  type PublicPlayer,
  consumables,
  economyConfig,
  seededPlayer,
  shopEquipment,
  starterEquipment
} from "@soltower/shared";
import { heroDefinitions, mapDefinitions, type RaidContributionInput } from "@soltower/game-engine";

export interface AdminUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  displayName: string;
  active: boolean;
}

export interface PlayerRecord extends PublicPlayer {
  email?: string;
  xp: number;
  selectedHeroId: HeroId;
  walletAuthHistory: WalletAuthHistoryRecord[];
  sessionStatus: "OFFLINE" | "ONLINE" | "SPECTATING";
  presenceStatus: "OFFLINE" | "IN_TOWN" | "IN_LOBBY" | "IN_RAID";
  walletRiskFlag: string | null;
}

export interface WalletNonceRecord {
  publicKey: string;
  nonce: string;
  message: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  ipPlaceholder: string;
}

export interface WalletAuthHistoryRecord {
  publicKey: string;
  walletName: string;
  authenticatedAt: string;
  ipPlaceholder: string;
}

export interface PlayerEquipmentRecord {
  id: string;
  playerId: string;
  definitionId: string;
  equippedSlot: EquipmentDefinition["slot"] | null;
  bound: boolean;
  level: number;
}

export interface PlayerConsumableRecord {
  id: string;
  playerId: string;
  definitionId: string;
  quantity: number;
  equipped: boolean;
}

export interface MarketListingRecord {
  id: string;
  sellerPlayerId: string;
  goldAmount: number;
  pricePerGold: number;
  totalPrice: number;
  status: MarketListingStatus;
  createdAt: string;
  soldToPlayerId: string | null;
}

export interface MarketTradeRecord {
  id: string;
  listingId: string | null;
  buyOrderId: string | null;
  buyerPlayerId: string;
  sellerPlayerId: string;
  goldAmount: number;
  grossTestToken: number;
  taxTestToken: number;
  sellerNet: number;
  createdAt: string;
}

export interface BuyOrderRecord {
  id: string;
  buyerPlayerId: string;
  goldAmount: number;
  openGoldAmount: number;
  pricePerGold: number;
  escrowRemaining: number;
  status: BuyOrderStatus;
  createdAt: string;
  expiresAt: string | null;
}

export interface BuyOrderFillRecord {
  id: string;
  buyOrderId: string;
  sellerPlayerId: string;
  goldAmount: number;
  grossTestToken: number;
  taxTestToken: number;
  sellerNet: number;
  createdAt: string;
}

export interface EscrowRecord {
  id: string;
  buyOrderId: string;
  playerId: string;
  balanceType: BalanceType;
  amountLocked: number;
  amountOpen: number;
  status: "OPEN" | "RELEASED" | "FILLED";
}

export interface Card {
  rank: "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
  suit: "♠" | "♥" | "♦" | "♣";
}

export interface BlackjackHandRecord {
  id: string;
  playerId: string;
  balanceType: Extract<BalanceType, "EARNED_GOLD" | "LOCKED_GOLD">;
  bet: number;
  totalWager: number;
  status: "ACTIVE" | "PLAYER_WIN" | "DEALER_WIN" | "PUSH" | "BLACKJACK" | "BUST";
  playerCards: Card[];
  dealerCards: Card[];
  shoe: Card[];
  shoeSeedHash: string;
  shuffleSeed: string;
  doubled: boolean;
  createdAt: string;
  resolvedAt: string | null;
  resultMetadata: Record<string, unknown>;
}

export interface BlackjackDailyCounterRecord {
  playerId: string;
  day: string;
  earnedProfit: number;
  handsPlayed: number;
}

export interface FriendRecord {
  id: string;
  playerId: string;
  friendPlayerId: string;
  status: "ONLINE" | "OFFLINE" | "IN_TOWN" | "IN_LOBBY" | "IN_RAID";
}

export interface ChatMessageRecord {
  id: string;
  channel: ChatChannel;
  fromPlayerId: string | null;
  targetPlayerId: string | null;
  message: string;
  moderationState: "VISIBLE" | "HIDDEN";
  createdAt: string;
}

export interface RaidLobbyMemberRecord {
  playerId: string;
  displayName: string;
  heroId: HeroId;
  accountLevel: number;
  power: number;
  ready: boolean;
  host: boolean;
}

export interface RaidLobbyRecord {
  id: string;
  hostPlayerId: string;
  lobbyType: LobbyType;
  mapId: string;
  recommendedPower: number;
  status: "OPEN" | "STARTED" | "COMPLETED" | "CANCELLED";
  members: RaidLobbyMemberRecord[];
  createdAt: string;
}

export interface RaidRunRecord {
  id: string;
  lobbyId: string | null;
  mapId: string;
  success: boolean;
  durationSeconds: number;
  contributions: RaidContributionInput[];
  rewards: Array<{ playerId: string; earnedGold: number; xp: number; active: boolean }>;
  createdAt: string;
}

export interface AdminAuditRecord {
  id: string;
  actorAdminId: string | null;
  actorRole: AdminRole | null;
  actionType: string;
  targetEntityType: string;
  targetEntityId: string;
  targetPlayerId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string;
  ipPlaceholder: string;
  correlationId: string;
  module: string;
  createdAt: string;
}

export type OperationReference =
  | { type: "ledger"; id: string }
  | { type: "listing"; id: string }
  | { type: "trade"; id: string }
  | { type: "buy-order"; id: string }
  | { type: "buy-order-fill"; id: string }
  | { type: "blackjack-hand"; id: string }
  | { type: "raid-run"; id: string }
  | { type: "wallet-player"; id: string };

export interface DevStore {
  players: Map<string, PlayerRecord>;
  walletToPlayer: Map<string, string>;
  walletNonces: Map<string, WalletNonceRecord>;
  admins: Map<string, AdminUserRecord>;
  playerSessions: Map<string, string>;
  adminSessions: Map<string, string>;
  equipmentDefinitions: Map<string, EquipmentDefinition>;
  playerEquipment: Map<string, PlayerEquipmentRecord>;
  playerConsumables: Map<string, PlayerConsumableRecord>;
  ledger: LedgerEntry[];
  idempotency: Map<string, OperationReference>;
  marketListings: Map<string, MarketListingRecord>;
  marketTrades: MarketTradeRecord[];
  buyOrders: Map<string, BuyOrderRecord>;
  buyOrderFills: BuyOrderFillRecord[];
  escrows: Map<string, EscrowRecord>;
  blackjackHands: Map<string, BlackjackHandRecord>;
  blackjackCounters: Map<string, BlackjackDailyCounterRecord>;
  friends: FriendRecord[];
  chat: ChatMessageRecord[];
  lobbies: Map<string, RaidLobbyRecord>;
  raids: RaidRunRecord[];
  audits: AdminAuditRecord[];
  spectatorCount: number;
  devMode: boolean;
}

let idCounter = 0;

export function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function createDevStore(options?: { devMode?: boolean }): DevStore {
  const players = new Map<string, PlayerRecord>();
  const marky: PlayerRecord = {
    ...seededPlayer,
    balances: cloneBalances(seededPlayer.balances),
    unlockedMaps: [...seededPlayer.unlockedMaps],
    xp: 1200,
    selectedHeroId: "storm-archer",
    walletAuthHistory: [],
    sessionStatus: "OFFLINE",
    presenceStatus: "OFFLINE",
    walletRiskFlag: null
  };
  players.set(marky.id, marky);
  players.set(economyConfig.treasuryPlayerId, {
    id: economyConfig.treasuryPlayerId,
    displayName: "DEV Treasury",
    accountLevel: 99,
    avatar: "T",
    power: 0,
    status: "ACTIVE",
    marketFrozen: false,
    blackjackFrozen: false,
    unlockedMaps: [],
    balances: { EARNED_GOLD: 0, LOCKED_GOLD: 0, TEST_TOKEN: 0 },
    xp: 0,
    selectedHeroId: "starcaller",
    walletPublicKey: null,
    walletLinkedAt: null,
    walletAuthHistory: [],
    sessionStatus: "OFFLINE",
    presenceStatus: "OFFLINE",
    walletRiskFlag: null
  });

  const demoPlayers: PlayerRecord[] = [
    {
      id: "player-nyla",
      displayName: "Nyla",
      walletPublicKey: "DevMockNyla111111111111111111111111111111111",
      walletLinkedAt: nowIso(),
      accountLevel: 18,
      avatar: "N",
      power: 1120,
      status: "ACTIVE",
      marketFrozen: false,
      blackjackFrozen: false,
      unlockedMaps: ["tower-1-1", "tower-1-2"],
      balances: { EARNED_GOLD: 520, LOCKED_GOLD: 90, TEST_TOKEN: 900 },
      xp: 2100,
      selectedHeroId: "tide-mage",
      walletAuthHistory: [],
      sessionStatus: "OFFLINE",
      presenceStatus: "IN_TOWN",
      walletRiskFlag: null
    },
    {
      id: "player-orren",
      displayName: "Orren",
      walletPublicKey: "DevMockOrren11111111111111111111111111111111",
      walletLinkedAt: nowIso(),
      accountLevel: 24,
      avatar: "O",
      power: 1540,
      status: "ACTIVE",
      marketFrozen: false,
      blackjackFrozen: false,
      unlockedMaps: ["tower-1-1", "tower-1-2", "tower-1-3"],
      balances: { EARNED_GOLD: 780, LOCKED_GOLD: 120, TEST_TOKEN: 420 },
      xp: 4400,
      selectedHeroId: "bombardier",
      walletAuthHistory: [],
      sessionStatus: "OFFLINE",
      presenceStatus: "IN_LOBBY",
      walletRiskFlag: null
    },
    {
      id: "player-safi",
      displayName: "Safi",
      walletPublicKey: "DevMockSafi111111111111111111111111111111111",
      walletLinkedAt: nowIso(),
      accountLevel: 9,
      avatar: "S",
      power: 720,
      status: "ACTIVE",
      marketFrozen: false,
      blackjackFrozen: false,
      unlockedMaps: ["tower-1-1"],
      balances: { EARNED_GOLD: 95, LOCKED_GOLD: 50, TEST_TOKEN: 180 },
      xp: 620,
      selectedHeroId: "starcaller",
      walletAuthHistory: [],
      sessionStatus: "OFFLINE",
      presenceStatus: "IN_TOWN",
      walletRiskFlag: null
    }
  ];
  demoPlayers.forEach((player) => players.set(player.id, player));

  const equipmentDefinitions = new Map<string, EquipmentDefinition>();
  [...starterEquipment, ...shopEquipment].forEach((item) => equipmentDefinitions.set(item.id, item));

  const playerEquipment = new Map<string, PlayerEquipmentRecord>();
  starterEquipment.forEach((item) => {
    const id = makeId("equip");
    playerEquipment.set(id, {
      id,
      playerId: marky.id,
      definitionId: item.id,
      equippedSlot: item.slot,
      bound: true,
      level: 1
    });
  });

  const playerConsumables = new Map<string, PlayerConsumableRecord>();
  consumables.forEach((item) => {
    const id = makeId("consumable");
    playerConsumables.set(id, {
      id,
      playerId: marky.id,
      definitionId: item.id,
      quantity: item.id === "repair-kit" ? 1 : 0,
      equipped: item.id === "repair-kit"
    });
  });

  const admins = new Map<string, AdminUserRecord>();
  const passwordHash = hashSync("ChangeMe123!", 12);
  [
    { id: "admin-owner", email: "owner@soltower.local", role: "OWNER" as const, displayName: "Owner" },
    { id: "admin-admin", email: "admin@soltower.local", role: "ADMIN" as const, displayName: "Admin" },
    {
      id: "admin-moderator",
      email: "moderator@soltower.local",
      role: "MODERATOR" as const,
      displayName: "Moderator"
    },
    {
      id: "admin-support",
      email: "support@soltower.local",
      role: "SUPPORT" as const,
      displayName: "Support"
    },
    {
      id: "admin-economy",
      email: "economy@soltower.local",
      role: "ECONOMY_MANAGER" as const,
      displayName: "Economy"
    }
  ].forEach((admin) => admins.set(admin.id, { ...admin, passwordHash, active: true }));

  const marketListings = new Map<string, MarketListingRecord>();
  const listingA: MarketListingRecord = {
    id: "listing-demo-1",
    sellerPlayerId: "player-nyla",
    goldAmount: 120,
    pricePerGold: 2,
    totalPrice: 240,
    status: "ACTIVE",
    createdAt: nowIso(),
    soldToPlayerId: null
  };
  const listingB: MarketListingRecord = {
    id: "listing-demo-2",
    sellerPlayerId: "player-orren",
    goldAmount: 180,
    pricePerGold: 3,
    totalPrice: 540,
    status: "ACTIVE",
    createdAt: nowIso(),
    soldToPlayerId: null
  };
  marketListings.set(listingA.id, listingA);
  marketListings.set(listingB.id, listingB);

  const buyOrders = new Map<string, BuyOrderRecord>();
  buyOrders.set("buy-order-demo-1", {
    id: "buy-order-demo-1",
    buyerPlayerId: "player-orren",
    goldAmount: 150,
    openGoldAmount: 150,
    pricePerGold: 2,
    escrowRemaining: 300,
    status: "OPEN",
    createdAt: nowIso(),
    expiresAt: null
  });

  return {
    players,
    walletToPlayer: new Map(
      Array.from(players.values())
        .filter((player) => player.walletPublicKey)
        .map((player) => [player.walletPublicKey as string, player.id])
    ),
    walletNonces: new Map(),
    admins,
    playerSessions: new Map(),
    adminSessions: new Map(),
    equipmentDefinitions,
    playerEquipment,
    playerConsumables,
    ledger: [],
    idempotency: new Map(),
    marketListings,
    marketTrades: [],
    buyOrders,
    buyOrderFills: [],
    escrows: new Map(),
    blackjackHands: new Map(),
    blackjackCounters: new Map(),
    friends: [
      { id: "friend-1", playerId: marky.id, friendPlayerId: "player-nyla", status: "IN_TOWN" },
      { id: "friend-2", playerId: marky.id, friendPlayerId: "player-orren", status: "IN_LOBBY" }
    ],
    chat: [
      {
        id: "chat-1",
        channel: "TOWN",
        fromPlayerId: "player-nyla",
        targetPlayerId: null,
        message: "Ready for Tower 1-2?",
        moderationState: "VISIBLE",
        createdAt: nowIso()
      },
      {
        id: "chat-2",
        channel: "SYSTEM",
        fromPlayerId: null,
        targetPlayerId: null,
        message: "DEV_MODE: Test Token is mock-only and has no on-chain value.",
        moderationState: "VISIBLE",
        createdAt: nowIso()
      }
    ],
    lobbies: new Map(),
    raids: [],
    audits: [],
    spectatorCount: 0,
    devMode: options?.devMode ?? process.env.DEV_MODE !== "false"
  };
}

export function cloneBalances(balances: BalanceSnapshot): BalanceSnapshot {
  return {
    EARNED_GOLD: balances.EARNED_GOLD,
    LOCKED_GOLD: balances.LOCKED_GOLD,
    TEST_TOKEN: balances.TEST_TOKEN
  };
}

export const publicContent = {
  heroDefinitions,
  mapDefinitions,
  consumables,
  starterEquipment,
  shopEquipment
};
