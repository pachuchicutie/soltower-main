export const blackjackConfig = {
  decks: 6,
  dealerHitsSoft17: true,
  blackjackPayoutNumerator: 6,
  blackjackPayoutDenominator: 5,
  maxBetBalanceRate: 0.2,
  tableLimits: [
    { minLevel: 1, maxLevel: 9, minBet: 5, maxBet: 15 },
    { minLevel: 10, maxLevel: 19, minBet: 5, maxBet: 25 },
    { minLevel: 20, maxLevel: 29, minBet: 10, maxBet: 50 },
    { minLevel: 30, maxLevel: 39, minBet: 20, maxBet: 75 },
    { minLevel: 40, maxLevel: 49, minBet: 25, maxBet: 125 },
    { minLevel: 50, maxLevel: 59, minBet: 50, maxBet: 200 },
    { minLevel: 60, maxLevel: Number.POSITIVE_INFINITY, minBet: 100, maxBet: 300 }
  ]
} as const;

export interface BlackjackLimits {
  minBet: number;
  tableMaxBet: number;
  balanceMaxBet: number;
  actualMaxBet: number;
}

export function getBlackjackTableLimit(accountLevel: number): { minBet: number; maxBet: number } {
  const tier = blackjackConfig.tableLimits.find(
    (entry) => accountLevel >= entry.minLevel && accountLevel <= entry.maxLevel
  );
  return tier ? { minBet: tier.minBet, maxBet: tier.maxBet } : { minBet: 5, maxBet: 15 };
}

export function getBlackjackLimits(accountLevel: number, selectedBalance: number): BlackjackLimits {
  const table = getBlackjackTableLimit(accountLevel);
  const balanceMaxBet = Math.floor(selectedBalance * blackjackConfig.maxBetBalanceRate);
  return {
    minBet: table.minBet,
    tableMaxBet: table.maxBet,
    balanceMaxBet,
    actualMaxBet: Math.min(table.maxBet, balanceMaxBet)
  };
}

export function validateBlackjackBet(accountLevel: number, selectedBalance: number, bet: number): void {
  const limits = getBlackjackLimits(accountLevel, selectedBalance);
  if (!Number.isInteger(bet)) {
    throw new Error("Bet must be a whole Gold amount");
  }
  if (bet < limits.minBet) {
    throw new Error(`Bet is below the table minimum of ${limits.minBet}`);
  }
  if (bet > limits.actualMaxBet) {
    throw new Error(`Bet exceeds the current maximum of ${limits.actualMaxBet}`);
  }
}
