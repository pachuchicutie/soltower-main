import { describe, expect, it } from "vitest";
import {
  applyStarlightPity,
  costumeAssetManifest,
  fullCostumeDefinitions,
  isArmorTagCompatibleWithHero,
  isCoreEquipmentSlotUnaffectedByCostume,
  isRewardCompatibleWithHero,
  isStarlightPoolEntryLiveEligible,
  isWeaponTagCompatibleWithHero,
  missingManualAssetCount,
  processSequentialStarlightPulls,
  starlightArmorCompatibility,
  starlightBanners,
  starlightCostumeDuplicateThreads,
  starlightDrawCosts,
  starlightEquipmentDuplicateShards,
  starlightPaymentTypes,
  starlightPoolEntries,
  starlightRates,
  starlightRatesTotalBasisPoints,
  starlightRewardDefinitions,
  starlightRarityAssets,
  starlightVaultIconAssets,
  starlightVaultTabs,
  starlightVaultUtilityTabs,
  starlightWeaponCompatibility
} from "./starlightVault";
import { equipmentSlots, heroIds } from "./types";

describe("Starlight Vault shared rules", () => {
  it("uses the exact public pull rates for every banner", () => {
    expect(starlightRatesTotalBasisPoints()).toBe(10000);
    expect(starlightRates.map((rate) => [rate.rarity, rate.percent])).toEqual([
      ["COMMON", 74.99],
      ["UNCOMMON", 18.5],
      ["RARE", 5.4],
      ["EPIC", 1],
      ["LEGENDARY", 0.1],
      ["MYTHICAL", 0.01]
    ]);
  });

  it("defines exact draw costs and payment sources without Test Token", () => {
    expect(starlightDrawCosts.one).toEqual({ drawCount: 1, gold: 50 });
    expect(starlightDrawCosts.ten).toEqual({ drawCount: 10, gold: 450 });
    expect(starlightPaymentTypes).toEqual(["LOCKED_GOLD", "EARNED_GOLD"]);
  });

  it("keeps pull categories distinct from utility panels", () => {
    expect(starlightVaultTabs).toEqual([
      "Featured",
      "Weapons",
      "Armor",
      "Relics & Charms",
      "Costumes"
    ]);
    expect(starlightVaultUtilityTabs).toEqual([
      "Collection",
      "Pull History",
      "Vault Odds"
    ]);
  });

  it("applies rare, epic, and legendary pity at the required thresholds", () => {
    expect(applyStarlightPity("COMMON", { rare: 9, epic: 0, legendary: 0 })).toMatchObject({
      finalRarity: "RARE",
      triggeredGuarantee: "rare",
      countersAfter: { rare: 0, epic: 1, legendary: 1 }
    });
    expect(applyStarlightPity("RARE", { rare: 0, epic: 74, legendary: 0 })).toMatchObject({
      finalRarity: "EPIC",
      triggeredGuarantee: "epic",
      countersAfter: { rare: 0, epic: 0, legendary: 1 }
    });
    expect(applyStarlightPity("EPIC", { rare: 0, epic: 0, legendary: 299 })).toMatchObject({
      finalRarity: "LEGENDARY",
      triggeredGuarantee: "legendary",
      countersAfter: { rare: 0, epic: 0, legendary: 0, mythical: 1 }
    });
    expect(applyStarlightPity("LEGENDARY", { rare: 0, epic: 0, legendary: 0, mythical: 599 })).toMatchObject({
      finalRarity: "MYTHICAL",
      triggeredGuarantee: "mythical",
      countersAfter: { rare: 0, epic: 0, legendary: 0, mythical: 0 }
    });
  });

  it("processes ten-pulls as individual sequential pity events", () => {
    const results = processSequentialStarlightPulls(
      ["COMMON", "COMMON", "COMMON", "COMMON", "COMMON", "COMMON", "COMMON", "COMMON", "COMMON", "COMMON"],
      { rare: 0, epic: 0, legendary: 0 }
    );
    expect(results).toHaveLength(10);
    expect(results[8].finalRarity).toBe("COMMON");
    expect(results[9]).toMatchObject({ finalRarity: "RARE", triggeredGuarantee: "rare" });
  });

  it("keeps weapon and armor compatibility server-readable by active Hero", () => {
    expect(isWeaponTagCompatibleWithHero("storm-archer", "bow")).toBe(true);
    expect(isWeaponTagCompatibleWithHero("storm-archer", "staff")).toBe(false);
    expect(isWeaponTagCompatibleWithHero("tide-mage", "staff")).toBe(true);
    expect(isWeaponTagCompatibleWithHero("tide-mage", "bow")).toBe(false);
    expect(isArmorTagCompatibleWithHero("storm-archer", "storm-archer-armor")).toBe(true);
    expect(isArmorTagCompatibleWithHero("storm-archer", "tide-mage-armor")).toBe(false);
    expect(starlightWeaponCompatibility.bombardier).toContain("launcher");
    expect(starlightArmorCompatibility.starcaller).toEqual(["starcaller-armor"]);
  });

  it("registers production Vault banners and reward assets while tracking costume sprite assets separately", () => {
    expect(fullCostumeDefinitions.map((costume) => costume.id)).toEqual([
      "village-initiate",
      "banana-guardian",
      "capybara-vacation",
      "galactic-sigma",
      "midnight-drum-runner",
      "celestial-star-sovereign"
    ]);
    expect(starlightBanners.map((banner) => banner.imagePath)).toEqual(
      expect.arrayContaining([
        "/assets/vault/banners/featured-starlight-selection.png",
        "/assets/vault/banners/weapons-active-hero-banner.png",
        "/assets/vault/banners/armor-active-hero-banner.png",
        "/assets/vault/banners/relics-charms-active-hero-banner.png",
        "/assets/vault/banners/costumes-global-collection-1.png"
      ])
    );
    expect(starlightRewardDefinitions).toHaveLength(24);
    expect(starlightRewardDefinitions.map((reward) => reward.name)).toEqual(
      expect.arrayContaining([
        "Worn Driftwood Bow",
        "Stormpiercer Bow",
        "Scout Leather Set",
        "Solheart Relic",
        "Celestial Star Sovereign"
      ])
    );
    expect(starlightPoolEntries.every((entry) => entry.assetStatus === "ready")).toBe(true);
    expect(starlightPoolEntries.every((entry) => isStarlightPoolEntryLiveEligible(entry))).toBe(true);
    expect(starlightRarityAssets.MYTHICAL).toBe("/assets/vault/rarity/mythical-frame.png");
    expect(starlightVaultIconAssets.featured).toBe("/assets/vault/icons/featured.png");
    expect(costumeAssetManifest).toHaveLength(fullCostumeDefinitions.length * heroIds.length);
    expect(missingManualAssetCount()).toBeGreaterThan(0);
    expect(costumeAssetManifest[0].missingAssets).toContain("/assets/costumes/village-initiate/storm-archer/preview.png");
  });

  it("keeps Full Costume separate from core equipment and combat stats", () => {
    expect(equipmentSlots).toEqual(["WEAPON", "ARMOR", "RELIC", "CHARM"]);
    for (const slot of equipmentSlots) {
      expect(isCoreEquipmentSlotUnaffectedByCostume(slot)).toBe(true);
    }
    expect(isCoreEquipmentSlotUnaffectedByCostume("FULL_COSTUME")).toBe(false);
  });

  it("uses bound duplicate conversion materials with no Gold refund path", () => {
    expect(starlightCostumeDuplicateThreads).toMatchObject({
      COMMON: 10,
      UNCOMMON: 25,
      RARE: 60,
      EPIC: 160,
      LEGENDARY: 500,
      MYTHICAL: 1200
    });
    expect(starlightEquipmentDuplicateShards.LEGENDARY).toBeGreaterThan(starlightEquipmentDuplicateShards.EPIC);
    expect(starlightEquipmentDuplicateShards.MYTHICAL).toBeGreaterThan(starlightEquipmentDuplicateShards.LEGENDARY);
  });

  it("keeps active-Hero reward pools server-readable without tying the browser to final reward ownership", () => {
    const archerWeapon = starlightPoolEntries.find((entry) => entry.rewardId === "stormpiercer-bow");
    const tideWeapon = starlightPoolEntries.find((entry) => entry.rewardId === "tidecall-staff");
    expect(archerWeapon && isRewardCompatibleWithHero(archerWeapon, "storm-archer")).toBe(true);
    expect(archerWeapon && isRewardCompatibleWithHero(archerWeapon, "tide-mage")).toBe(true);
    expect(tideWeapon && isRewardCompatibleWithHero(tideWeapon, "tide-mage")).toBe(true);
    expect(tideWeapon && isRewardCompatibleWithHero(tideWeapon, "storm-archer")).toBe(true);
  });
});
