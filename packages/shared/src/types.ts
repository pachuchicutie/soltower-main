export const balanceTypes = ["EARNED_GOLD", "LOCKED_GOLD", "TEST_TOKEN"] as const;
export type BalanceType = (typeof balanceTypes)[number];

export const ledgerDirections = ["CREDIT", "DEBIT"] as const;
export type LedgerDirection = (typeof ledgerDirections)[number];

export const goldSourceTypes = [
  "STARTER_LOCKED_GOLD",
  "RAID_REWARD",
  "QUEST_REWARD",
  "BLACKJACK_WIN",
  "BLACKJACK_WAGER",
  "BLACKJACK_PUSH",
  "TOKEN_PURCHASE",
  "MARKET_PURCHASE",
  "MARKET_SALE",
  "EQUIPMENT_PURCHASE",
  "STARLIGHT_VAULT_DRAW",
  "POTION_PURCHASE",
  "ADMIN_DEV_GRANT",
  "ADMIN_ADJUSTMENT",
  "MARKET_TAX",
  "BUY_ORDER_ESCROW",
  "BUY_ORDER_RELEASE",
  "REFUND"
] as const;
export type GoldSourceType = (typeof goldSourceTypes)[number];

export const itemRarities = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"] as const;
export type ItemRarity = (typeof itemRarities)[number];

export const equipmentSlots = ["WEAPON", "ARMOR", "RELIC", "CHARM"] as const;
export type EquipmentSlot = (typeof equipmentSlots)[number];

export const heroIds = [
  "storm-archer",
  "tide-mage",
  "bombardier",
  "coral-alchemist",
  "starcaller"
] as const;
export type HeroId = (typeof heroIds)[number];

export const adminRoles = [
  "OWNER",
  "ADMIN",
  "ECONOMY_MANAGER",
  "GAME_DESIGNER",
  "MODERATOR",
  "SUPPORT"
] as const;
export type AdminRole = (typeof adminRoles)[number];

export const accountStatuses = ["ACTIVE", "MUTED", "SUSPENDED", "BANNED"] as const;
export type AccountStatus = (typeof accountStatuses)[number];

export const marketListingStatuses = ["ACTIVE", "SOLD", "CANCELLED", "REVOKED"] as const;
export type MarketListingStatus = (typeof marketListingStatuses)[number];

export const buyOrderStatuses = ["OPEN", "FILLED", "CANCELLED", "EXPIRED", "REVOKED"] as const;
export type BuyOrderStatus = (typeof buyOrderStatuses)[number];

export const blackjackActions = ["HIT", "STAND", "DOUBLE_DOWN"] as const;
export type BlackjackAction = (typeof blackjackActions)[number];

export const lobbyTypes = ["PUBLIC", "PRIVATE", "FRIENDS_ONLY"] as const;
export type LobbyType = (typeof lobbyTypes)[number];

export const chatChannels = ["TOWN", "PARTY", "WHISPER", "SYSTEM"] as const;
export type ChatChannel = (typeof chatChannels)[number];

export const townServerIds = [
  "solbloom-1",
  "solbloom-2",
  "solbloom-3",
  "solbloom-4",
  "solbloom-5"
] as const;
export type TownServerId = (typeof townServerIds)[number];
export const TOWN_SERVER_CAPACITY = 40;
export const TOWN_PRESENCE_STALE_AFTER_SECONDS = 20;

export interface BalanceSnapshot {
  EARNED_GOLD: number;
  LOCKED_GOLD: number;
  TEST_TOKEN: number;
}

export interface PublicPlayer {
  id: string;
  displayName: string;
  walletPublicKey: string | null;
  walletLinkedAt: string | null;
  accountLevel: number;
  xp: number;
  avatar: string;
  power: number;
  status: AccountStatus;
  marketFrozen: boolean;
  blackjackFrozen: boolean;
  unlockedMaps: string[];
  balances: BalanceSnapshot;
}

export interface PlayerProfileSummary {
  fullWalletAddress: string | null;
  shortenedWalletAddress: string | null;
  accountLevel: number;
  xp: number;
  selectedHero: string;
  power: number;
  balances: BalanceSnapshot;
  unlockedMaps: string[];
  marketSellCapacityToday: number;
  blackjackTableTier: {
    minBet: number;
    maxBet: number;
  };
}

export interface PlayerBootstrapData {
  player: PublicPlayer;
  profile: PlayerProfileSummary;
  selectedHeroId: string;
  unlockedMapCount: number;
  townPosition?: TownPosition;
}

export interface TownPosition {
  x: number;
  y: number;
  facingX: number;
  facingY: number;
}

export interface HeroDefinition {
  id: HeroId;
  name: string;
  className: string;
  role: string;
  attackType: string;
  tagline: string;
  description: string;
  ultimate: string;
  accent: string;
  stats: {
    power: number;
    damage: number;
    attackSpeed: number;
    critChance: number;
    critDamage: number;
    bossDamage: number;
    luck: number;
    range: number;
  };
  onboardingStats: {
    power: number;
    damage: number;
    attackSpeed: number;
    range: number;
    survivability: number;
    utility: number;
    difficulty: number;
  };
  strengths: string[];
  weaknesses: string[];
  bestFor: string;
  starterGearSummary: string;
  tags: string[];
}

export interface EquipmentDefinition {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  bound: boolean;
  priceGold: number;
  stats: Partial<HeroDefinition["stats"]>;
}

export interface ConsumableDefinition {
  id: string;
  name: string;
  description: string;
  priceGold: number;
  maxPerRun: number;
}

export interface LedgerEntry {
  id: string;
  playerId: string;
  balanceType: BalanceType;
  sourceType: GoldSourceType;
  amount: number;
  direction: LedgerDirection;
  beforeBalance: number;
  afterBalance: number;
  reason: string;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  createdByAdminId: string | null;
  referenceEntityType: string | null;
  referenceEntityId: string | null;
}
