export const economyConfig = {
  starterLockedGold: 0,
  marketMinimumGoldQuantity: 100,
  marketSellerTaxRate: 0.1,
  blackjackProfitCapRate: 0.6,
  /**
   * Pre-market accounts (level &lt; 10) have 0 daily sell capacity. Without a floor,
   * every Earned Gold blackjack profit would dump into Locked Gold.
   */
  blackjackPreMarketEarnedProfitCap: 60,
  treasuryPlayerId: "treasury",
  towerToken: {
    symbol: "$TOWER",
    mint: "93HefHtbz4ghJUpfv7nXCuJiaHYnxcgahbJFNXvfpump",
    jupiterSwapUrl: "https://jup.ag/swap/SOL-93HefHtbz4ghJUpfv7nXCuJiaHYnxcgahbJFNXvfpump"
  },
  tokenGate: {
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
  ],
  raidBaseGoldReward: 24,
  raidBaseXpReward: 80
} as const;

export function getDailySellCapacity(accountLevel: number): number {
  const tier = economyConfig.dailySellCapacityTiers.find(
    (entry) => accountLevel >= entry.minLevel && accountLevel <= entry.maxLevel
  );
  return tier?.capacity ?? 0;
}

export function getBlackjackEarnedProfitCap(accountLevel: number): number {
  const sellLinked = Math.floor(getDailySellCapacity(accountLevel) * economyConfig.blackjackProfitCapRate);
  // Levels without market sell capacity still need fair Earned profit room at the table.
  const preMarketFloor =
    accountLevel < 10 ? economyConfig.blackjackPreMarketEarnedProfitCap : 0;
  return Math.max(sellLinked, preMarketFloor);
}

export function calculateMarketTax(grossTestToken: number): {
  tax: number;
  sellerReceives: number;
} {
  const tax = Math.floor(grossTestToken * economyConfig.marketSellerTaxRate);
  return {
    tax,
    sellerReceives: grossTestToken - tax
  };
}

export function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}
