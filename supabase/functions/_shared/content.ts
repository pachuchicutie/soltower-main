export const economyConfig = {
  starterLockedGold: 0,
  marketMinimumGoldQuantity: 100,
  marketSellerTaxRate: 0.1,
  raidBaseGoldReward: 24,
  raidBaseXpReward: 80,
  blackjackProfitCapRate: 0.6,
  /** Matches packages/shared — pre-market BJ profit must stay on Earned Gold. */
  blackjackPreMarketEarnedProfitCap: 60,
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
  ]
} as const;

export const equipmentDefinitions = [
  { id: "basic-bow", name: "Basic Bow", slot: "WEAPON", rarity: "COMMON", priceGold: 0, stats: { damage: 18, range: 12, critChance: 2 } },
  { id: "basic-armor", name: "Basic Armor", slot: "ARMOR", rarity: "COMMON", priceGold: 0, stats: { power: 50 } },
  { id: "basic-charm", name: "Basic Charm", slot: "CHARM", rarity: "COMMON", priceGold: 0, stats: { luck: 3 } },
  { id: "basic-relic", name: "Basic Relic", slot: "RELIC", rarity: "COMMON", priceGold: 0, stats: { bossDamage: 4 } },
  { id: "ember-bow", name: "Emberstring Bow", slot: "WEAPON", rarity: "UNCOMMON", priceGold: 80, stats: { damage: 32, critChance: 5, range: 14 } },
  { id: "tide-mantle", name: "Tideglass Mantle", slot: "ARMOR", rarity: "RARE", priceGold: 140, stats: { power: 120, luck: 6 } },
  { id: "starlit-relic", name: "Starlit Relay", slot: "RELIC", rarity: "EPIC", priceGold: 220, stats: { attackSpeed: 9, bossDamage: 11 } },
  { id: "worn-driftwood-bow", name: "Worn Driftwood Bow", slot: "WEAPON", rarity: "COMMON", priceGold: 0, stats: { damage: 20, range: 12 } },
  { id: "reefguard-wand", name: "Reefguard Wand", slot: "WEAPON", rarity: "UNCOMMON", priceGold: 0, stats: { damage: 24, attackSpeed: 3, range: 13 } },
  { id: "embershot-cannon", name: "Embershot Cannon", slot: "WEAPON", rarity: "RARE", priceGold: 0, stats: { damage: 38, bossDamage: 6 } },
  { id: "voidpiercer-crossbow", name: "Voidpiercer Crossbow", slot: "WEAPON", rarity: "RARE", priceGold: 0, stats: { damage: 35, critChance: 12, range: 16 } },
  { id: "flameveil-dagger", name: "Flameveil Dagger", slot: "WEAPON", rarity: "RARE", priceGold: 0, stats: { damage: 29, attackSpeed: 14, critChance: 7 } },
  { id: "ironthorn-spear", name: "Ironthorn Spear", slot: "WEAPON", rarity: "RARE", priceGold: 0, stats: { damage: 41, bossDamage: 9, range: 14 } },
  { id: "shadowwhisper-blade", name: "Shadowwhisper Blade", slot: "WEAPON", rarity: "RARE", priceGold: 0, stats: { damage: 33, critChance: 10, luck: 5 } },
  { id: "stormcall-javelin", name: "Stormcall Javelin", slot: "WEAPON", rarity: "RARE", priceGold: 0, stats: { damage: 37, attackSpeed: 5, range: 17, bossDamage: 5 } },
  { id: "tidecall-staff", name: "Tidecall Staff", slot: "WEAPON", rarity: "EPIC", priceGold: 0, stats: { damage: 42, attackSpeed: 7, range: 15 } },
  { id: "stormpiercer-bow", name: "Stormpiercer Bow", slot: "WEAPON", rarity: "LEGENDARY", priceGold: 0, stats: { damage: 55, critChance: 9, bossDamage: 14, range: 18 } },
  { id: "astral-tempest-relic-bow", name: "Astral Tempest Relic Bow", slot: "WEAPON", rarity: "MYTHIC", priceGold: 0, stats: { damage: 68, critChance: 12, critDamage: 20, bossDamage: 18, range: 20 } },
  { id: "scout-leather-set", name: "Scout Leather Set", slot: "ARMOR", rarity: "COMMON", priceGold: 0, stats: { power: 55, luck: 2 } },
  { id: "coralweave-vestments", name: "Coralweave Vestments", slot: "ARMOR", rarity: "UNCOMMON", priceGold: 0, stats: { power: 82, luck: 4 } },
  { id: "forgebound-defender-mail", name: "Forgebound Defender Mail", slot: "ARMOR", rarity: "RARE", priceGold: 0, stats: { power: 130, bossDamage: 4 } },
  { id: "obsidian-warden-plate", name: "Obsidian Warden Plate", slot: "ARMOR", rarity: "RARE", priceGold: 0, stats: { power: 125, bossDamage: 7 } },
  { id: "emberweave-cloak", name: "Emberweave Cloak", slot: "ARMOR", rarity: "RARE", priceGold: 0, stats: { power: 110, luck: 8, critChance: 4 } },
  { id: "tideforged-cuirass", name: "Tideforged Cuirass", slot: "ARMOR", rarity: "RARE", priceGold: 0, stats: { power: 135, bossDamage: 5, luck: 3 } },
  { id: "shadowveil-mantle", name: "Shadowveil Mantle", slot: "ARMOR", rarity: "RARE", priceGold: 0, stats: { power: 118, critChance: 6, luck: 5 } },
  { id: "stormscale-vest", name: "Stormscale Vest", slot: "ARMOR", rarity: "RARE", priceGold: 0, stats: { power: 122, attackSpeed: 4, bossDamage: 4 } },
  { id: "moonlit-tide-robes", name: "Moonlit Tide Robes", slot: "ARMOR", rarity: "EPIC", priceGold: 0, stats: { power: 154, attackSpeed: 5, luck: 8 } },
  { id: "stormwarden-battle-regalia", name: "Stormwarden Battle Regalia", slot: "ARMOR", rarity: "LEGENDARY", priceGold: 0, stats: { power: 205, damage: 12, bossDamage: 10 } },
  { id: "celestial-aegis-armor", name: "Celestial Aegis Armor", slot: "ARMOR", rarity: "MYTHIC", priceGold: 0, stats: { power: 255, damage: 16, luck: 12, bossDamage: 12 } },
  { id: "moss-thread-charm", name: "Moss Thread Charm", slot: "CHARM", rarity: "COMMON", priceGold: 0, stats: { luck: 4 } },
  { id: "coral-seal", name: "Coral Seal", slot: "RELIC", rarity: "UNCOMMON", priceGold: 0, stats: { power: 36, luck: 5 } },
  { id: "runeglass-totem", name: "Runeglass Totem", slot: "RELIC", rarity: "RARE", priceGold: 0, stats: { bossDamage: 9, critChance: 4 } },
  { id: "starlit-focus-charm", name: "Starlit Focus Charm", slot: "CHARM", rarity: "EPIC", priceGold: 0, stats: { attackSpeed: 7, luck: 9 } },
  { id: "solheart-relic", name: "Solheart Relic", slot: "RELIC", rarity: "LEGENDARY", priceGold: 0, stats: { power: 80, bossDamage: 16, critDamage: 12 } },
  { id: "astral-tide-sigil", name: "Astral Tide Sigil", slot: "CHARM", rarity: "MYTHIC", priceGold: 0, stats: { attackSpeed: 10, luck: 16, bossDamage: 14 } }
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
  const sellLinked = Math.floor(getDailySellCapacity(accountLevel) * economyConfig.blackjackProfitCapRate);
  const preMarketFloor =
    accountLevel < 10 ? economyConfig.blackjackPreMarketEarnedProfitCap : 0;
  return Math.max(sellLinked, preMarketFloor);
}
