import { heroIds, type EquipmentSlot, type HeroId } from "./types";

export const starlightRarities = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHICAL"] as const;
export type StarlightRarity = (typeof starlightRarities)[number];

export const starlightAssetStatuses = ["pending_manual_art", "partial", "ready", "disabled"] as const;
export type StarlightAssetStatus = (typeof starlightAssetStatuses)[number];

export const starlightRewardTypes = ["FULL_COSTUME", "WEAPON", "ARMOR", "RELIC", "CHARM"] as const;
export type StarlightRewardType = (typeof starlightRewardTypes)[number];

export const starlightBannerIds = [
  "featured-starlight-selection",
  "active-hero-weapon",
  "active-hero-armor",
  "active-hero-relics-charms",
  "global-costume-collection-i"
] as const;
export type StarlightBannerId = (typeof starlightBannerIds)[number];

export const starlightPaymentTypes = ["LOCKED_GOLD", "EARNED_GOLD"] as const;
export type StarlightPaymentType = (typeof starlightPaymentTypes)[number];

export const starlightVaultTownAsset = {
  id: "starlight-vault",
  name: "Starlight Vault",
  assetPath: "/assets/soltower/environment/structures/starlight-vault.png",
  interactionLabel: "Enter Starlight Vault",
  interactionAction: "open_starlight_vault",
  assetStatus: "ready",
  enabledForPlayerUse: true
} as const;

export const starlightVaultTabs = ["Featured", "Weapons", "Armor", "Relics & Charms", "Costumes"] as const;
export type StarlightVaultTab = (typeof starlightVaultTabs)[number];

export const starlightVaultUtilityTabs = ["Collection", "Pull History", "Vault Odds"] as const;
export type StarlightVaultUtilityTab = (typeof starlightVaultUtilityTabs)[number];

export const starlightDrawCosts = {
  one: { drawCount: 1, gold: 50 },
  ten: { drawCount: 10, gold: 450 }
} as const;

export const starlightRates = [
  { rarity: "COMMON", label: "Common", percent: 74.99, basisPoints: 7499 },
  { rarity: "UNCOMMON", label: "Uncommon", percent: 18.5, basisPoints: 1850 },
  { rarity: "RARE", label: "Rare", percent: 5.4, basisPoints: 540 },
  { rarity: "EPIC", label: "Epic", percent: 1, basisPoints: 100 },
  { rarity: "LEGENDARY", label: "Legendary", percent: 0.1, basisPoints: 10 },
  { rarity: "MYTHICAL", label: "Mythical", percent: 0.01, basisPoints: 1 }
] as const satisfies ReadonlyArray<{
  rarity: StarlightRarity;
  label: string;
  percent: number;
  basisPoints: number;
}>;

export const starlightPityRules = {
  rare: { label: "Rare or higher", threshold: 10, minRarity: "RARE" },
  epic: { label: "Epic or higher", threshold: 75, minRarity: "EPIC" },
  legendary: { label: "Legendary", threshold: 300, minRarity: "LEGENDARY" },
  mythical: { label: "Mythical", threshold: 600, minRarity: "MYTHICAL" }
} as const;

export const starlightCostumeDuplicateThreads: Record<StarlightRarity, number> = {
  COMMON: 10,
  UNCOMMON: 25,
  RARE: 60,
  EPIC: 160,
  LEGENDARY: 500,
  MYTHICAL: 1200
};

export const starlightEquipmentDuplicateShards: Record<StarlightRarity, number> = {
  COMMON: 8,
  UNCOMMON: 20,
  RARE: 50,
  EPIC: 140,
  LEGENDARY: 420,
  MYTHICAL: 1000
};

export const starlightMaterialDefinitions = [
  {
    id: "wardrobe-threads",
    name: "Wardrobe Threads",
    source: "starlight_vault",
    bound: true,
    tradeable: false,
    description: "Bound material from duplicate Full Costumes."
  },
  {
    id: "starlight-shards",
    name: "Starlight Shards",
    source: "starlight_vault",
    bound: true,
    tradeable: false,
    description: "Bound material from duplicate Starlight Vault equipment."
  }
] as const;

export const fullCostumeDefinitions = [
  {
    id: "village-initiate",
    name: "Village Initiate",
    rarity: "COMMON",
    theme: "A warm starter village outfit with simple SolBloom guardian details."
  },
  {
    id: "banana-guardian",
    name: "Banana Guardian",
    rarity: "UNCOMMON",
    theme: "Funny premium banana-inspired costume with yellow and gold accents."
  },
  {
    id: "capybara-vacation",
    name: "Capybara Vacation",
    rarity: "RARE",
    theme: "Relaxed travel costume with a cozy tropical vacation feel."
  },
  {
    id: "galactic-sigma",
    name: "Galactic Sigma",
    rarity: "EPIC",
    theme: "Dark navy, black, and gold fashion with subtle cosmic accents."
  },
  {
    id: "midnight-drum-runner",
    name: "Midnight Drum Runner",
    rarity: "LEGENDARY",
    theme: "Original midnight-blue and gold ceremonial costume with enchanted rhythm details."
  },
  {
    id: "celestial-star-sovereign",
    name: "Celestial Star Sovereign",
    rarity: "MYTHICAL",
    theme: "A radiant astral regalia set with moonlit gold and star crystal details."
  }
] as const satisfies ReadonlyArray<{
  id: string;
  name: string;
  rarity: StarlightRarity;
  theme: string;
}>;

const vaultRoot = "/assets/vault";

export const starlightRarityAssets: Record<StarlightRarity, string> = {
  COMMON: `${vaultRoot}/rarity/common-frame.png`,
  UNCOMMON: `${vaultRoot}/rarity/uncommon-frame.png`,
  RARE: `${vaultRoot}/rarity/rare-frame.png`,
  EPIC: `${vaultRoot}/rarity/epic-frame.png`,
  LEGENDARY: `${vaultRoot}/rarity/legendary-frame.png`,
  MYTHICAL: `${vaultRoot}/rarity/mythical-frame.png`
};

export const starlightVaultIconAssets = {
  earnedGold: `${vaultRoot}/icons/earned-gold.png`,
  lockedGold: `${vaultRoot}/icons/locked-gold.png`,
  pity: `${vaultRoot}/icons/pity.png`,
  rateUp: `${vaultRoot}/icons/rate-up.png`,
  featured: `${vaultRoot}/icons/featured.png`
} as const;

export interface StarlightRewardDefinition {
  id: string;
  name: string;
  rarity: StarlightRarity;
  category: StarlightVaultTab;
  rewardType: StarlightRewardType;
  displayType: string;
  assetPath: string;
  framePath: string;
  bannerIds: readonly StarlightBannerId[];
  itemTags: readonly string[];
  flavor: string;
  rateUp: boolean;
  limited: boolean;
  heroExclusive: boolean;
}

function rewardPath(category: "weapons" | "armor" | "relics" | "costumes", id: string): string {
  return `${vaultRoot}/rewards/${category}/${id}.png`;
}

function reward(
  id: string,
  name: string,
  rarity: StarlightRarity,
  category: StarlightVaultTab,
  rewardType: StarlightRewardType,
  assetCategory: "weapons" | "armor" | "relics" | "costumes",
  bannerIds: readonly StarlightBannerId[],
  flavor: string,
  itemTags: readonly string[] = []
): StarlightRewardDefinition {
  return {
    id,
    name,
    rarity,
    category,
    rewardType,
    displayType: rewardType === "FULL_COSTUME" ? "Costume" : rewardType[0] + rewardType.slice(1).toLowerCase(),
    assetPath: rewardPath(assetCategory, id),
    framePath: starlightRarityAssets[rarity],
    bannerIds,
    itemTags,
    flavor,
    rateUp: bannerIds.includes("featured-starlight-selection") || rarity === "LEGENDARY" || rarity === "MYTHICAL",
    limited: rarity === "MYTHICAL",
    heroExclusive: rewardType !== "FULL_COSTUME"
  };
}

export const starlightRewardDefinitions = [
  reward("worn-driftwood-bow", "Worn Driftwood Bow", "COMMON", "Weapons", "WEAPON", "weapons", ["active-hero-weapon"], "A humble bow reinforced with village twine.", ["bow"]),
  reward("reefguard-wand", "Reefguard Wand", "UNCOMMON", "Weapons", "WEAPON", "weapons", ["active-hero-weapon"], "A compact focus wand carrying calm tide magic.", ["staff", "orb", "water-catalyst"]),
  reward("embershot-cannon", "Embershot Cannon", "RARE", "Weapons", "WEAPON", "weapons", ["active-hero-weapon"], "A small forge cannon tuned for guarded volleys.", ["launcher", "bomb-kit"]),
  reward("tidecall-staff", "Tidecall Staff", "EPIC", "Weapons", "WEAPON", "weapons", ["active-hero-weapon"], "A flowing staff built for precise waterlight casting.", ["staff", "orb"]),
  reward("stormpiercer-bow", "Stormpiercer Bow", "LEGENDARY", "Weapons", "WEAPON", "weapons", ["featured-starlight-selection", "active-hero-weapon"], "A lightning-carved bow for priority boss damage.", ["bow"]),
  reward("astral-tempest-relic-bow", "Astral Tempest Relic Bow", "MYTHICAL", "Weapons", "WEAPON", "weapons", ["featured-starlight-selection", "active-hero-weapon"], "A celestial bow said to bend stormlight around the string.", ["bow", "star-focus"]),

  reward("scout-leather-set", "Scout Leather Set", "COMMON", "Armor", "ARMOR", "armor", ["active-hero-armor"], "Light armor for early village patrols.", ["light-armor"]),
  reward("coralweave-vestments", "Coralweave Vestments", "UNCOMMON", "Armor", "ARMOR", "armor", ["active-hero-armor"], "Soft robes woven with reefguard thread.", ["tide-mage-armor"]),
  reward("forgebound-defender-mail", "Forgebound Defender Mail", "RARE", "Armor", "ARMOR", "armor", ["active-hero-armor"], "Hardened mail with warm ember seams.", ["bombardier-armor"]),
  reward("moonlit-tide-robes", "Moonlit Tide Robes", "EPIC", "Armor", "ARMOR", "armor", ["featured-starlight-selection", "active-hero-armor"], "Formal robes that shimmer with moonlit water.", ["tide-mage-armor"]),
  reward("stormwarden-battle-regalia", "Stormwarden Battle Regalia", "LEGENDARY", "Armor", "ARMOR", "armor", ["active-hero-armor"], "Battle regalia balanced for storm-channeling guardians.", ["storm-archer-armor"]),
  reward("celestial-aegis-armor", "Celestial Aegis Armor", "MYTHICAL", "Armor", "ARMOR", "armor", ["featured-starlight-selection", "active-hero-armor"], "A star-forged armor set with luminous ward plates.", ["starcaller-armor", "storm-archer-armor"]),

  reward("moss-thread-charm", "Moss Thread Charm", "COMMON", "Relics & Charms", "CHARM", "relics", ["active-hero-relics-charms"], "A small charm used by new guardians for steady luck.", ["charm"]),
  reward("coral-seal", "Coral Seal", "UNCOMMON", "Relics & Charms", "RELIC", "relics", ["active-hero-relics-charms"], "A reef-marked seal that calms hostile tides.", ["relic"]),
  reward("runeglass-totem", "Runeglass Totem", "RARE", "Relics & Charms", "RELIC", "relics", ["active-hero-relics-charms"], "A tiny totem cut from old tower glass.", ["relic"]),
  reward("starlit-focus-charm", "Starlit Focus Charm", "EPIC", "Relics & Charms", "CHARM", "relics", ["active-hero-relics-charms"], "A focus charm that brightens skill timing.", ["charm", "star-focus"]),
  reward("solheart-relic", "Solheart Relic", "LEGENDARY", "Relics & Charms", "RELIC", "relics", ["featured-starlight-selection", "active-hero-relics-charms"], "A radiant relic carrying the first tower ward.", ["relic"]),
  reward("astral-tide-sigil", "Astral Tide Sigil", "MYTHICAL", "Relics & Charms", "CHARM", "relics", ["featured-starlight-selection", "active-hero-relics-charms"], "A rare sigil where astral light and tide magic meet.", ["charm", "water-catalyst"]),

  reward("village-initiate", "Village Initiate", "COMMON", "Costumes", "FULL_COSTUME", "costumes", ["global-costume-collection-i"], "A cozy first-guardian costume for SolBloom Village.", ["full-costume"]),
  reward("banana-guardian", "Banana Guardian", "UNCOMMON", "Costumes", "FULL_COSTUME", "costumes", ["global-costume-collection-i"], "A playful yellow costume with gold village charm.", ["full-costume"]),
  reward("capybara-vacation", "Capybara Vacation", "RARE", "Costumes", "FULL_COSTUME", "costumes", ["global-costume-collection-i"], "A relaxed summer costume with travel-ready softness.", ["full-costume"]),
  reward("galactic-sigma", "Galactic Sigma", "EPIC", "Costumes", "FULL_COSTUME", "costumes", ["global-costume-collection-i"], "A dark cosmic fashion set with controlled star accents.", ["full-costume"]),
  reward("midnight-drum-runner", "Midnight Drum Runner", "LEGENDARY", "Costumes", "FULL_COSTUME", "costumes", ["global-costume-collection-i"], "A ceremonial midnight costume with enchanted rhythm details.", ["full-costume"]),
  reward("celestial-star-sovereign", "Celestial Star Sovereign", "MYTHICAL", "Costumes", "FULL_COSTUME", "costumes", ["featured-starlight-selection", "global-costume-collection-i"], "The Vault's rarest astral costume, trimmed in moonlit gold.", ["full-costume"])
] as const satisfies readonly StarlightRewardDefinition[];

export interface StarlightBannerDefinition {
  id: StarlightBannerId;
  name: string;
  tab: StarlightVaultTab;
  headline: string;
  subhead: string;
  imagePath: string;
  rewardTypes: readonly StarlightRewardType[];
  requiresActiveHero: boolean;
  featuredRewardIds: readonly string[];
}

export const starlightBanners = [
  {
    id: "featured-starlight-selection",
    name: "Featured Starlight Selection",
    tab: "Featured",
    headline: "Featured Starlight Selection",
    subhead: "Rate-up gear and costumes with the brightest Vault aura.",
    imagePath: `${vaultRoot}/banners/featured-starlight-selection.png`,
    rewardTypes: ["WEAPON", "ARMOR", "RELIC", "CHARM", "FULL_COSTUME"],
    requiresActiveHero: true,
    featuredRewardIds: ["stormpiercer-bow", "moonlit-tide-robes", "solheart-relic", "celestial-star-sovereign"]
  },
  {
    id: "active-hero-weapon",
    name: "Active Hero Weapon Banner",
    tab: "Weapons",
    headline: "Active Hero Weapons",
    subhead: "Weapon pulls tuned for your selected guardian.",
    imagePath: `${vaultRoot}/banners/weapons-active-hero-banner.png`,
    rewardTypes: ["WEAPON"],
    requiresActiveHero: true,
    featuredRewardIds: ["stormpiercer-bow", "astral-tempest-relic-bow"]
  },
  {
    id: "active-hero-armor",
    name: "Active Hero Armor Banner",
    tab: "Armor",
    headline: "Active Hero Armor",
    subhead: "Protective gear, robes, and battle regalia.",
    imagePath: `${vaultRoot}/banners/armor-active-hero-banner.png`,
    rewardTypes: ["ARMOR"],
    requiresActiveHero: true,
    featuredRewardIds: ["moonlit-tide-robes", "celestial-aegis-armor"]
  },
  {
    id: "active-hero-relics-charms",
    name: "Active Hero Relics & Charms Banner",
    tab: "Relics & Charms",
    headline: "Relics & Charms",
    subhead: "Small treasures that shift a guardian's role.",
    imagePath: `${vaultRoot}/banners/relics-charms-active-hero-banner.png`,
    rewardTypes: ["RELIC", "CHARM"],
    requiresActiveHero: true,
    featuredRewardIds: ["solheart-relic", "astral-tide-sigil"]
  },
  {
    id: "global-costume-collection-i",
    name: "Global Costume Collection I",
    tab: "Costumes",
    headline: "Global Costume Collection I",
    subhead: "Full costumes usable across the guardian collection.",
    imagePath: `${vaultRoot}/banners/costumes-global-collection-1.png`,
    rewardTypes: ["FULL_COSTUME"],
    requiresActiveHero: false,
    featuredRewardIds: ["midnight-drum-runner", "celestial-star-sovereign"]
  }
] as const satisfies readonly StarlightBannerDefinition[];

export const starlightWeaponCompatibility: Record<HeroId, readonly string[]> = {
  "storm-archer": ["bow"],
  "tide-mage": ["staff", "orb", "water-catalyst"],
  bombardier: ["launcher", "bomb-kit", "mechanic-tool"],
  "coral-alchemist": ["flask", "alchemy-focus", "catalyst"],
  starcaller: ["celestial-staff", "star-focus", "charm-weapon"]
};

export const starlightArmorCompatibility: Record<HeroId, readonly string[]> = {
  "storm-archer": ["storm-archer-armor", "light-armor"],
  "tide-mage": ["tide-mage-armor"],
  bombardier: ["bombardier-armor"],
  "coral-alchemist": ["coral-alchemist-armor"],
  starcaller: ["starcaller-armor"]
};

export const costumeDirections = [
  "top-left",
  "left",
  "bottom-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom"
] as const;
export type CostumeDirection = (typeof costumeDirections)[number];

export interface CostumeHeroAssetEntry {
  costumeId: string;
  heroId: HeroId;
  rarity: StarlightRarity;
  previewPath: string;
  idleAssetPaths: Record<CostumeDirection, string>;
  walkAssetPaths: Record<CostumeDirection, string>;
  sourceDimensions: { width: number; height: number } | null;
  intendedRenderScale: number;
  assetStatus: StarlightAssetStatus;
  enabledForPlayerUse: boolean;
  missingAssets: string[];
}

export interface StarlightPoolEntry {
  id: string;
  bannerId: StarlightBannerId;
  rewardId: string;
  rewardType: StarlightRewardType;
  name: string;
  rarity: StarlightRarity;
  weight: number;
  heroCompatibility: readonly HeroId[] | "ACTIVE_HERO" | "GLOBAL";
  itemTags: readonly string[];
  assetPath: string;
  assetStatus: StarlightAssetStatus;
  enabledForPlayerUse: boolean;
  duplicateConversionValue: number;
  boundMetadata: {
    source: "starlight_vault";
    isBound: true;
    isTradeable: false;
    isAuctionable: false;
    isGiftable: false;
    isSellable: false;
    isConvertible: false;
  };
}

export const costumeAssetManifest: CostumeHeroAssetEntry[] = fullCostumeDefinitions.flatMap((costume) =>
  heroIds.map((heroId) => {
    const root = `/assets/costumes/${costume.id}/${heroId}`;
    const idleAssetPaths = Object.fromEntries(
      costumeDirections.map((direction) => [direction, `${root}/idle-${direction}.png`])
    ) as Record<CostumeDirection, string>;
    const walkAssetPaths = Object.fromEntries(
      costumeDirections.map((direction) => [direction, `${root}/walk-${direction}.png`])
    ) as Record<CostumeDirection, string>;
    const previewPath = `${root}/preview.png`;
    return {
      costumeId: costume.id,
      heroId,
      rarity: costume.rarity,
      previewPath,
      idleAssetPaths,
      walkAssetPaths,
      sourceDimensions: null,
      intendedRenderScale: 1,
      assetStatus: "pending_manual_art",
      enabledForPlayerUse: false,
      missingAssets: [previewPath, ...Object.values(idleAssetPaths)]
    };
  })
);

const boundMetadata: StarlightPoolEntry["boundMetadata"] = {
  source: "starlight_vault",
  isBound: true,
  isTradeable: false,
  isAuctionable: false,
  isGiftable: false,
  isSellable: false,
  isConvertible: false
};

export const starlightPoolEntries: StarlightPoolEntry[] = starlightRewardDefinitions.flatMap((rewardDefinition) =>
  rewardDefinition.bannerIds.map((bannerId) => ({
    id: `pool-${bannerId}-${rewardDefinition.id}`,
    bannerId,
    rewardId: rewardDefinition.id,
    rewardType: rewardDefinition.rewardType,
    name: rewardDefinition.name,
    rarity: rewardDefinition.rarity,
    weight: rateForRarity(rewardDefinition.rarity).basisPoints,
    heroCompatibility: rewardDefinition.heroExclusive ? "ACTIVE_HERO" : "GLOBAL",
    itemTags: rewardDefinition.itemTags,
    assetPath: rewardDefinition.assetPath,
    assetStatus: "ready" as const,
    enabledForPlayerUse: true,
    duplicateConversionValue:
      rewardDefinition.rewardType === "FULL_COSTUME"
        ? starlightCostumeDuplicateThreads[rewardDefinition.rarity]
        : starlightEquipmentDuplicateShards[rewardDefinition.rarity],
    boundMetadata
  }))
);

export interface StarlightPityCounters {
  rare: number;
  epic: number;
  legendary: number;
  mythical?: number;
}

export interface PityResolution {
  finalRarity: StarlightRarity;
  triggeredGuarantee: "rare" | "epic" | "legendary" | "mythical" | null;
  countersAfter: Required<StarlightPityCounters>;
}

const rarityRank: Record<StarlightRarity, number> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5,
  MYTHICAL: 6
};

export function rateForRarity(rarity: StarlightRarity) {
  return starlightRates.find((rate) => rate.rarity === rarity) ?? starlightRates[0];
}

export function starlightRatesTotalBasisPoints(): number {
  return starlightRates.reduce((sum, rate) => sum + rate.basisPoints, 0);
}

export function isRarityAtLeast(rarity: StarlightRarity, minimum: StarlightRarity): boolean {
  return rarityRank[rarity] >= rarityRank[minimum];
}

export function applyStarlightPity(baseRarity: StarlightRarity, counters: StarlightPityCounters): PityResolution {
  const nextCounters = {
    rare: counters.rare + 1,
    epic: counters.epic + 1,
    legendary: counters.legendary + 1,
    mythical: (counters.mythical ?? 0) + 1
  };
  let finalRarity = baseRarity;
  let triggeredGuarantee: PityResolution["triggeredGuarantee"] = null;

  if (nextCounters.mythical >= starlightPityRules.mythical.threshold) {
    finalRarity = "MYTHICAL";
    triggeredGuarantee = "mythical";
  } else if (nextCounters.legendary >= starlightPityRules.legendary.threshold) {
    finalRarity = "LEGENDARY";
    triggeredGuarantee = "legendary";
  } else if (nextCounters.epic >= starlightPityRules.epic.threshold && !isRarityAtLeast(finalRarity, "EPIC")) {
    finalRarity = "EPIC";
    triggeredGuarantee = "epic";
  } else if (nextCounters.rare >= starlightPityRules.rare.threshold && !isRarityAtLeast(finalRarity, "RARE")) {
    finalRarity = "RARE";
    triggeredGuarantee = "rare";
  }

  return {
    finalRarity,
    triggeredGuarantee,
    countersAfter: {
      rare: isRarityAtLeast(finalRarity, "RARE") ? 0 : nextCounters.rare,
      epic: isRarityAtLeast(finalRarity, "EPIC") ? 0 : nextCounters.epic,
      legendary: isRarityAtLeast(finalRarity, "LEGENDARY") ? 0 : nextCounters.legendary,
      mythical: finalRarity === "MYTHICAL" ? 0 : nextCounters.mythical
    }
  };
}

export function processSequentialStarlightPulls(
  baseRarities: readonly StarlightRarity[],
  startingCounters: StarlightPityCounters = { rare: 0, epic: 0, legendary: 0, mythical: 0 }
): PityResolution[] {
  const results: PityResolution[] = [];
  let counters: StarlightPityCounters = startingCounters;
  for (const rarity of baseRarities) {
    const result = applyStarlightPity(rarity, counters);
    results.push(result);
    counters = result.countersAfter;
  }
  return results;
}

export function isStarlightPoolEntryLiveEligible(entry: Pick<StarlightPoolEntry, "assetStatus" | "enabledForPlayerUse">): boolean {
  return entry.assetStatus === "ready" && entry.enabledForPlayerUse === true;
}

export function isRewardCompatibleWithHero(entry: StarlightPoolEntry, heroId: HeroId): boolean {
  if (entry.heroCompatibility === "GLOBAL" || entry.heroCompatibility === "ACTIVE_HERO") {
    return true;
  }
  return entry.heroCompatibility.includes(heroId);
}

export function isWeaponTagCompatibleWithHero(heroId: HeroId, tag: string): boolean {
  return starlightWeaponCompatibility[heroId].includes(tag);
}

export function isArmorTagCompatibleWithHero(heroId: HeroId, tag: string): boolean {
  return starlightArmorCompatibility[heroId].includes(tag);
}

export function isCoreEquipmentSlotUnaffectedByCostume(slot: EquipmentSlot | "FULL_COSTUME"): boolean {
  return slot === "WEAPON" || slot === "ARMOR" || slot === "RELIC" || slot === "CHARM";
}

export function missingManualAssetCount(): number {
  return costumeAssetManifest.reduce((count, entry) => count + entry.missingAssets.length, 0);
}
