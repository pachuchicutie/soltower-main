import type { ConsumableDefinition, EquipmentDefinition, PublicPlayer } from "./types";

export const rarityColors = {
  COMMON: "#9ca3af",
  UNCOMMON: "#22c55e",
  RARE: "#3b82f6",
  EPIC: "#a855f7",
  LEGENDARY: "#f97316",
  MYTHIC: "#facc15"
} as const;

export const seededPlayer: PublicPlayer = {
  id: "player-marky",
  displayName: "Marky",
  walletPublicKey: "DevMockMarky111111111111111111111111111111111",
  walletLinkedAt: "2026-06-29T00:00:00.000Z",
  accountLevel: 10,
  xp: 0,
  avatar: "M",
  power: 1280,
  status: "ACTIVE",
  marketFrozen: false,
  blackjackFrozen: false,
  unlockedMaps: ["tower-1-1", "tower-1-2", "tower-1-3"],
  balances: {
    EARNED_GOLD: 300,
    LOCKED_GOLD: 50,
    TEST_TOKEN: 250
  }
};

export const starterEquipment: EquipmentDefinition[] = [
  {
    id: "basic-bow",
    name: "Basic Bow",
    slot: "WEAPON",
    rarity: "COMMON",
    bound: true,
    priceGold: 0,
    stats: { damage: 18, range: 12, critChance: 2 }
  },
  {
    id: "basic-armor",
    name: "Basic Armor",
    slot: "ARMOR",
    rarity: "COMMON",
    bound: true,
    priceGold: 0,
    stats: { power: 50 }
  },
  {
    id: "basic-charm",
    name: "Basic Charm",
    slot: "CHARM",
    rarity: "COMMON",
    bound: true,
    priceGold: 0,
    stats: { luck: 3 }
  },
  {
    id: "basic-relic",
    name: "Basic Relic",
    slot: "RELIC",
    rarity: "COMMON",
    bound: true,
    priceGold: 0,
    stats: { bossDamage: 4 }
  }
];

export const shopEquipment: EquipmentDefinition[] = [
  {
    id: "ember-bow",
    name: "Emberstring Bow",
    slot: "WEAPON",
    rarity: "UNCOMMON",
    bound: true,
    priceGold: 80,
    stats: { damage: 32, critChance: 5, range: 14 }
  },
  {
    id: "tide-mantle",
    name: "Tideglass Mantle",
    slot: "ARMOR",
    rarity: "RARE",
    bound: true,
    priceGold: 140,
    stats: { power: 120, luck: 6 }
  },
  {
    id: "starlit-relic",
    name: "Starlit Relay",
    slot: "RELIC",
    rarity: "EPIC",
    bound: true,
    priceGold: 220,
    stats: { attackSpeed: 9, bossDamage: 11 }
  }
];

export const vaultEquipment: EquipmentDefinition[] = [
  {
    id: "worn-driftwood-bow",
    name: "Worn Driftwood Bow",
    slot: "WEAPON",
    rarity: "COMMON",
    bound: true,
    priceGold: 0,
    stats: { damage: 20, range: 12 }
  },
  {
    id: "reefguard-wand",
    name: "Reefguard Wand",
    slot: "WEAPON",
    rarity: "UNCOMMON",
    bound: true,
    priceGold: 0,
    stats: { damage: 24, attackSpeed: 3, range: 13 }
  },
  {
    id: "embershot-cannon",
    name: "Embershot Cannon",
    slot: "WEAPON",
    rarity: "RARE",
    bound: true,
    priceGold: 0,
    stats: { damage: 38, bossDamage: 6 }
  },
  {
    id: "tidecall-staff",
    name: "Tidecall Staff",
    slot: "WEAPON",
    rarity: "EPIC",
    bound: true,
    priceGold: 0,
    stats: { damage: 42, attackSpeed: 7, range: 15 }
  },
  {
    id: "stormpiercer-bow",
    name: "Stormpiercer Bow",
    slot: "WEAPON",
    rarity: "LEGENDARY",
    bound: true,
    priceGold: 0,
    stats: { damage: 55, critChance: 9, bossDamage: 14, range: 18 }
  },
  {
    id: "astral-tempest-relic-bow",
    name: "Astral Tempest Relic Bow",
    slot: "WEAPON",
    rarity: "MYTHIC",
    bound: true,
    priceGold: 0,
    stats: { damage: 68, critChance: 12, critDamage: 20, bossDamage: 18, range: 20 }
  },
  {
    id: "scout-leather-set",
    name: "Scout Leather Set",
    slot: "ARMOR",
    rarity: "COMMON",
    bound: true,
    priceGold: 0,
    stats: { power: 55, luck: 2 }
  },
  {
    id: "coralweave-vestments",
    name: "Coralweave Vestments",
    slot: "ARMOR",
    rarity: "UNCOMMON",
    bound: true,
    priceGold: 0,
    stats: { power: 82, luck: 4 }
  },
  {
    id: "forgebound-defender-mail",
    name: "Forgebound Defender Mail",
    slot: "ARMOR",
    rarity: "RARE",
    bound: true,
    priceGold: 0,
    stats: { power: 130, bossDamage: 4 }
  },
  {
    id: "moonlit-tide-robes",
    name: "Moonlit Tide Robes",
    slot: "ARMOR",
    rarity: "EPIC",
    bound: true,
    priceGold: 0,
    stats: { power: 154, attackSpeed: 5, luck: 8 }
  },
  {
    id: "stormwarden-battle-regalia",
    name: "Stormwarden Battle Regalia",
    slot: "ARMOR",
    rarity: "LEGENDARY",
    bound: true,
    priceGold: 0,
    stats: { power: 205, damage: 12, bossDamage: 10 }
  },
  {
    id: "celestial-aegis-armor",
    name: "Celestial Aegis Armor",
    slot: "ARMOR",
    rarity: "MYTHIC",
    bound: true,
    priceGold: 0,
    stats: { power: 255, damage: 16, luck: 12, bossDamage: 12 }
  },
  {
    id: "moss-thread-charm",
    name: "Moss Thread Charm",
    slot: "CHARM",
    rarity: "COMMON",
    bound: true,
    priceGold: 0,
    stats: { luck: 4 }
  },
  {
    id: "coral-seal",
    name: "Coral Seal",
    slot: "RELIC",
    rarity: "UNCOMMON",
    bound: true,
    priceGold: 0,
    stats: { power: 36, luck: 5 }
  },
  {
    id: "runeglass-totem",
    name: "Runeglass Totem",
    slot: "RELIC",
    rarity: "RARE",
    bound: true,
    priceGold: 0,
    stats: { bossDamage: 9, critChance: 4 }
  },
  {
    id: "starlit-focus-charm",
    name: "Starlit Focus Charm",
    slot: "CHARM",
    rarity: "EPIC",
    bound: true,
    priceGold: 0,
    stats: { attackSpeed: 7, luck: 9 }
  },
  {
    id: "solheart-relic",
    name: "Solheart Relic",
    slot: "RELIC",
    rarity: "LEGENDARY",
    bound: true,
    priceGold: 0,
    stats: { power: 80, bossDamage: 16, critDamage: 12 }
  },
  {
    id: "astral-tide-sigil",
    name: "Astral Tide Sigil",
    slot: "CHARM",
    rarity: "MYTHIC",
    bound: true,
    priceGold: 0,
    stats: { attackSpeed: 10, luck: 16, bossDamage: 14 }
  }
];

export const consumables: ConsumableDefinition[] = [
  {
    id: "repair-kit",
    name: "Repair Kit",
    description: "Restores 5% Core HP in a raid.",
    priceGold: 25,
    maxPerRun: 1
  },
  {
    id: "mana-tonic",
    name: "Mana Tonic",
    description: "Briefly reduces active skill cooldown by 15%.",
    priceGold: 35,
    maxPerRun: 1
  },
  {
    id: "scout-flare",
    name: "Scout Flare",
    description: "Reveals the next wave modifier.",
    priceGold: 20,
    maxPerRun: 1
  },
  {
    id: "revive-feather",
    name: "Revive Feather",
    description: "Grants one emergency revive chance.",
    priceGold: 75,
    maxPerRun: 1
  },
  {
    id: "treasure-compass",
    name: "Treasure Compass",
    description: "Small chance for an extra bound material chest.",
    priceGold: 60,
    maxPerRun: 1
  }
];

export const npcDefinitions = [
  {
    id: "raid-captain",
    name: "Captain Rook",
    role: "Raid Captain",
    dialogue: "Looking for a squad? The towers are waiting.",
    actions: ["Create Raid", "Find Public Raid", "Join Friend", "My Active Lobby"]
  },
  {
    id: "market-broker",
    name: "Mira the Broker",
    role: "Market Broker",
    dialogue: "Gold moves fast in SolBloom. Make your offer wisely.",
    actions: ["Buy Gold", "Sell Gold", "Buy Orders", "My Listings", "My Buy Orders", "Market History"]
  },
  {
    id: "blacksmith",
    name: "Emberforge",
    role: "Blacksmith",
    dialogue: "A blade is only as good as the hand that improves it.",
    actions: ["Equipment", "Upgrade Gear", "Bound Shop", "Potions and Consumables", "Reroll Station"]
  },
  {
    id: "quest-board",
    name: "Quest Board",
    role: "Quests",
    dialogue: "Every tower needs a guardian.",
    actions: ["Daily Quests", "Weekly Quests", "Achievements"]
  },
  {
    id: "blackjack",
    name: "Lady Vesper",
    role: "Blackjack Dealer",
    dialogue: "Fortune favors a steady hand. Shall we deal?",
    actions: ["Play Blackjack", "Casino Rules", "Leave"]
  },
  {
    id: "tavern",
    name: "Lanternroot Tavern",
    role: "Friends Area",
    dialogue: "A warm table is easier to find with friends nearby.",
    actions: ["Friends List", "Friend Requests", "Whispers", "Party Invites"]
  },
  {
    id: "event-board",
    name: "Event Board",
    role: "Events",
    dialogue: "Fresh notices shimmer beneath the village lanterns.",
    actions: ["Raid Leaderboard", "Season Rankings", "Guardian Records"]
  }
] as const;
