export interface RaidVisualAsset {
  label: string;
  assetPath: string;
}

export const raidAssetRoot = "/assets/raids";

export type RaidEnemyKey =
  | "sproutling"
  | "ember-mite"
  | "briar-crawler"
  | "glass-beetle"
  | "mist-wisp"
  | "ash-hound"
  | "rune-warden"
  | "shard-golem"
  | "storm-sentinel"
  | "solheart-sentinel";

export type RaidRewardKey =
  | "earned-gold"
  | "xp"
  | "tower-shard"
  | "moss-thread"
  | "ember-core"
  | "tidal-pearl"
  | "starlit-dust"
  | "gear-chest"
  | "rare-chest-reward"
  | "boss-chest-reward";

export const raidEnemyAssets: Record<RaidEnemyKey, RaidVisualAsset> = {
  sproutling: { label: "Sproutling", assetPath: `${raidAssetRoot}/enemies/sproutling.png` },
  "ember-mite": { label: "Ember Mite", assetPath: `${raidAssetRoot}/enemies/ember-mite.png` },
  "briar-crawler": { label: "Briar Crawler", assetPath: `${raidAssetRoot}/enemies/briar-crawler.png` },
  "glass-beetle": { label: "Glass Beetle", assetPath: `${raidAssetRoot}/enemies/glass-beetle.png` },
  "mist-wisp": { label: "Mist Wisp", assetPath: `${raidAssetRoot}/enemies/mist-wisp.png` },
  "ash-hound": { label: "Ash Hound", assetPath: `${raidAssetRoot}/enemies/ash-hound.png` },
  "rune-warden": { label: "Rune Warden", assetPath: `${raidAssetRoot}/enemies/rune-warden.png` },
  "shard-golem": { label: "Shard Golem", assetPath: `${raidAssetRoot}/enemies/shard-golem.png` },
  "storm-sentinel": { label: "Storm Sentinel", assetPath: `${raidAssetRoot}/enemies/storm-sentinel.png` },
  "solheart-sentinel": { label: "Solheart Sentinel", assetPath: `${raidAssetRoot}/enemies/solheart-sentinel.png` }
};

export const raidRewardAssets: Record<RaidRewardKey, RaidVisualAsset> = {
  "earned-gold": { label: "Earned Gold", assetPath: `${raidAssetRoot}/rewards/earned-gold.png` },
  xp: { label: "XP", assetPath: `${raidAssetRoot}/rewards/xp-crystal.png` },
  "tower-shard": { label: "Tower Shard", assetPath: `${raidAssetRoot}/rewards/tower-shard.png` },
  "moss-thread": { label: "Moss Thread", assetPath: `${raidAssetRoot}/rewards/moss-thread.png` },
  "ember-core": { label: "Ember Core", assetPath: `${raidAssetRoot}/rewards/ember-core.png` },
  "tidal-pearl": { label: "Tidal Pearl", assetPath: `${raidAssetRoot}/rewards/tidal-pearl.png` },
  "starlit-dust": { label: "Starlit Dust", assetPath: `${raidAssetRoot}/rewards/starlit-dust.png` },
  "gear-chest": { label: "Chest Reward", assetPath: `${raidAssetRoot}/rewards/chest-reward.png` },
  "rare-chest-reward": { label: "Rare Chest", assetPath: `${raidAssetRoot}/rewards/rare-chest-reward.png` },
  "boss-chest-reward": { label: "Boss Chest", assetPath: `${raidAssetRoot}/rewards/boss-chest-reward.png` }
};

export const raidMapOneStageAssets = {
  1: `${raidAssetRoot}/stages/stage-1-1-sproutling-path.png`,
  2: `${raidAssetRoot}/stages/stage-1-2-cinder-crossing.png`,
  3: `${raidAssetRoot}/stages/stage-1-3-briar-hollow.png`,
  4: `${raidAssetRoot}/stages/stage-1-4-glass-beetle-grotto.png`,
  5: `${raidAssetRoot}/stages/stage-1-5-mistwood-watch.png`,
  6: `${raidAssetRoot}/stages/stage-1-6-ashhound-trail.png`,
  7: `${raidAssetRoot}/stages/stage-1-7-rune-grove.png`,
  8: `${raidAssetRoot}/stages/stage-1-8-shardfall-rise.png`,
  9: `${raidAssetRoot}/stages/stage-1-9-stormgate-approach.png`,
  10: `${raidAssetRoot}/stages/stage-1-10-solheart-sentinel.png`
} as const;

export const raidMapTwoStageAssets = {
  1: `${raidAssetRoot}/stages/stage-2-1-emberfall-gate.png`,
  2: `${raidAssetRoot}/stages/stage-2-2-cinderroot-bridge.png`,
  3: `${raidAssetRoot}/stages/stage-2-3-smokestack-hollow.png`,
  4: `${raidAssetRoot}/stages/stage-2-4-molten-cartway.png`,
  5: `${raidAssetRoot}/stages/stage-2-5-soot-lantern-run.png`,
  6: `${raidAssetRoot}/stages/stage-2-6-blazebark-thicket.png`,
  7: `${raidAssetRoot}/stages/stage-2-7-kilnstone-rise.png`,
  8: `${raidAssetRoot}/stages/stage-2-8-furnace-vale.png`,
  9: `${raidAssetRoot}/stages/stage-2-9-obsidian-causeway.png`,
  10: `${raidAssetRoot}/stages/stage-2-10-emberfall-warden.png`
} as const;

export function getRaidStageAssetPath(mapNumber: number, stageInMap: number): string | null {
  if (mapNumber === 1) {
    return raidMapOneStageAssets[stageInMap as keyof typeof raidMapOneStageAssets] ?? null;
  }

  if (mapNumber === 2) {
    return raidMapTwoStageAssets[stageInMap as keyof typeof raidMapTwoStageAssets] ?? null;
  }

  return null;
}
