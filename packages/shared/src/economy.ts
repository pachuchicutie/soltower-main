export const economyConfig = {
  starterLockedGold: 50,
  marketMinimumGoldQuantity: 100,
  marketSellerTaxRate: 0.1,
  blackjackProfitCapRate: 0.6,
  treasuryPlayerId: "treasury",
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
  return Math.floor(getDailySellCapacity(accountLevel) * economyConfig.blackjackProfitCapRate);
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
