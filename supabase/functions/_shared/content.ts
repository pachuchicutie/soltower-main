export const economyConfig = {
  starterLockedGold: 50,
  marketMinimumGoldQuantity: 100,
  marketSellerTaxRate: 0.1,
  raidBaseGoldReward: 24,
  raidBaseXpReward: 80,
  blackjackProfitCapRate: 0.6,
  towerToken: {
    symbol: "$TOWER",
    temporaryMint: "FX1mwQ5CZHutv5jCAMJ4jxE7XYeYBpVuX2Qk5MuRpump",
    jupiterSwapUrl: "https://jup.ag/swap/SOL-FX1mwQ5CZHutv5jCAMJ4jxE7XYeYBpVuX2Qk5MuRpump"
  },
  tokenGate: {
    playMinimumTower: 1000,
    sellerMinimumTower: 10000,
    auctionSellerMinimumTower: 10000,
    sellerMinimumAccountLevel: 10
  },
  dailySellCapacityTiers: [
    { minLevel: 10, maxLevel: 19, capacity: 100 },
    { minLevel: 20, maxLevel: 29, capacity: 150 },
    { minLevel: 30, maxLevel: 39, capacity: 250 },
    { minLevel: 40, maxLevel: 49, capacity: 400 },
    { minLevel: 50, maxLevel: 59, capacity: 600 },
    { minLevel: 60, maxLevel: Number.POSITIVE_INFINITY, capacity: 1000 }
  ]
} as const;

export const equipmentDefinitions = [
  { id: "basic-bow", name: "Basic Bow", slot: "WEAPON", rarity: "COMMON", priceGold: 0 },
  { id: "basic-armor", name: "Basic Armor", slot: "ARMOR", rarity: "COMMON", priceGold: 0 },
  { id: "basic-charm", name: "Basic Charm", slot: "CHARM", rarity: "COMMON", priceGold: 0 },
  { id: "basic-relic", name: "Basic Relic", slot: "RELIC", rarity: "COMMON", priceGold: 0 },
  { id: "ember-bow", name: "Emberstring Bow", slot: "WEAPON", rarity: "UNCOMMON", priceGold: 80 },
  { id: "tide-mantle", name: "Tideglass Mantle", slot: "ARMOR", rarity: "RARE", priceGold: 140 },
  { id: "starlit-relic", name: "Starlit Relay", slot: "RELIC", rarity: "EPIC", priceGold: 220 }
] as const;

export const consumableDefinitions = [
  { id: "repair-kit", name: "Repair Kit", priceGold: 25 },
  { id: "mana-tonic", name: "Mana Tonic", priceGold: 35 },
  { id: "scout-flare", name: "Scout Flare", priceGold: 20 }
] as const;

export function getDailySellCapacity(accountLevel: number): number {
  const tier = economyConfig.dailySellCapacityTiers.find(
    (entry) => accountLevel >= entry.minLevel && accountLevel <= entry.maxLevel
  );
  return tier?.capacity ?? 0;
}

export function getBlackjackTableLimit(accountLevel: number): { minBet: number; maxBet: number } {
  if (accountLevel >= 60) return { minBet: 100, maxBet: 300 };
  if (accountLevel >= 50) return { minBet: 50, maxBet: 200 };
  if (accountLevel >= 40) return { minBet: 25, maxBet: 125 };
  if (accountLevel >= 30) return { minBet: 20, maxBet: 75 };
  if (accountLevel >= 20) return { minBet: 10, maxBet: 50 };
  if (accountLevel >= 10) return { minBet: 5, maxBet: 25 };
  return { minBet: 5, maxBet: 15 };
}

export function getBlackjackLimits(accountLevel: number, selectedBalance: number): {
  minBet: number;
  tableMaxBet: number;
  balanceMaxBet: number;
  actualMaxBet: number;
} {
  const table = getBlackjackTableLimit(accountLevel);
  const balanceMaxBet = Math.floor(selectedBalance * 0.2);
  return {
    minBet: table.minBet,
    tableMaxBet: table.maxBet,
    balanceMaxBet,
    actualMaxBet: Math.min(table.maxBet, balanceMaxBet)
  };
}

export function getBlackjackEarnedProfitCap(accountLevel: number): number {
  return Math.floor(getDailySellCapacity(accountLevel) * economyConfig.blackjackProfitCapRate);
}
