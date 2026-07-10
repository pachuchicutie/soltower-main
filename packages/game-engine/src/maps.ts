import {
  getRaidStageAssetPath,
  raidAssetRoot,
  raidEnemyAssets,
  raidRewardAssets,
  type RaidEnemyKey,
  type RaidRewardKey,
  type RaidVisualAsset
} from "./raidAssets";

export type RaidChapterStatus = "ACTIVE" | "LOCKED" | "FUTURE";
export type { RaidEnemyKey, RaidRewardKey, RaidVisualAsset };

export interface RaidWaveDefinition {
  wave: number;
  second: number;
  enemyKey: RaidEnemyKey;
  enemy: string;
  count: number;
  hp: number;
  speed: number;
  modifier: string;
  boss?: boolean;
}

export interface RaidRewardPreview {
  key: RaidRewardKey;
  label: string;
  amount: string;
  assetPath: string;
}

export interface RaidBattlePoint {
  x: number;
  y: number;
}

export interface RaidBattleDefenderSlot extends RaidBattlePoint {
  progress: number;
  facing: "left" | "right" | "up" | "down";
}

export interface RaidBattleLayout {
  base: RaidBattlePoint;
  defenderSlots: RaidBattleDefenderSlot[];
  enemyPath: RaidBattlePoint[];
}

export interface RaidStageDefinition {
  id: string;
  stageNumber: string;
  stageIndex: number;
  mapNumber: number;
  chapterId: string;
  chapterName: string;
  chapterStatus: RaidChapterStatus;
  name: string;
  chapter: string;
  biome: string;
  recommendedAccountLevel: number;
  recommendedPower: number;
  baseGoldReward: number;
  baseXpReward: number;
  unlockedByDefault: boolean;
  thumbnailPath: string;
  largePreviewPath: string;
  objective: string;
  estimatedDuration: string;
  partySize: string;
  primaryEnemyKey: RaidEnemyKey;
  enemyKeys: RaidEnemyKey[];
  rewardPreview: RaidRewardPreview[];
  waves: RaidWaveDefinition[];
  battleLayout: RaidBattleLayout;
  isBossStage: boolean;
  bossKey?: RaidEnemyKey;
  bossName?: string;
}

export interface RaidChapterDefinition {
  id: string;
  mapNumber: number;
  title: string;
  shortTitle: string;
  levelRange: string;
  minAccountLevel: number;
  unlockRequirement: string;
  bannerPath: string;
  status: RaidChapterStatus;
  stages: RaidStageDefinition[];
}

export interface RaidStageUnlockState {
  stageId: string;
  unlocked: boolean;
  completed: boolean;
  reason: string | null;
  requiredAccountLevel: number;
  requiredStageId: string | null;
  requiredStageLabel: string | null;
}

export { raidEnemyAssets, raidRewardAssets };

const mapOneStageSeeds = [
  {
    stage: 1,
    name: "Sproutling Path",
    biome: "Sunlit forest path",
    enemyKeys: ["sproutling"],
    materials: ["moss-thread"],
    objective: "Hold the first lantern bend while Sproutlings test the tower wards."
  },
  {
    stage: 2,
    name: "Cinder Crossing",
    biome: "Warm stone crossing",
    enemyKeys: ["sproutling", "ember-mite"],
    materials: ["ember-core"],
    objective: "Defend the ember bridge before Cinder Motes ignite the roadside shrines."
  },
  {
    stage: 3,
    name: "Briar Hollow",
    biome: "Thorny woodland hollow",
    enemyKeys: ["sproutling", "briar-crawler"],
    materials: ["moss-thread"],
    objective: "Protect the hollow gate from Briar Imps weaving roots under the path."
  },
  {
    stage: 4,
    name: "Glass Beetle Grotto",
    biome: "Crystal-veined grotto",
    enemyKeys: ["glass-beetle", "ember-mite"],
    materials: ["tower-shard"],
    objective: "Break the beetle line before their glass shells refract the tower beam."
  },
  {
    stage: 5,
    name: "Mistwood Watch",
    biome: "Misty watchpost ruins",
    enemyKeys: ["mist-wisp", "briar-crawler"],
    materials: ["tidal-pearl"],
    objective: "Keep the old watchpost lamp burning through the Mist Wisp ambush."
  },
  {
    stage: 6,
    name: "Ashhound Trail",
    biome: "Charred forest trail",
    enemyKeys: ["ash-hound", "ember-mite"],
    materials: ["ember-core"],
    objective: "Stop Ashhounds from reaching the outer tower stairs."
  },
  {
    stage: 7,
    name: "Rune Grove",
    biome: "Blue rune grove",
    enemyKeys: ["rune-warden", "mist-wisp"],
    materials: ["starlit-dust"],
    objective: "Stabilize the grove runes while Rune Grubs gnaw at the magic roots."
  },
  {
    stage: 8,
    name: "Shardfall Rise",
    biome: "Falling crystal ridge",
    enemyKeys: ["shard-golem", "glass-beetle"],
    materials: ["tower-shard"],
    objective: "Hold the ridge as Shardlings descend through broken crystal rain."
  },
  {
    stage: 9,
    name: "Stormgate Approach",
    biome: "Storm-lit gate road",
    enemyKeys: ["storm-sentinel", "shard-golem"],
    materials: ["starlit-dust"],
    objective: "Defend the approach while Storm Wardens charge the gate pylons."
  },
  {
    stage: 10,
    name: "Solheart Sentinel",
    biome: "Ancient tower gate",
    enemyKeys: ["storm-sentinel", "shard-golem", "solheart-sentinel"],
    materials: ["boss-chest-reward", "tower-shard"],
    objective: "Defeat the Solheart Sentinel before it seals the tower route.",
    bossKey: "solheart-sentinel"
  }
] satisfies Array<{
  stage: number;
  name: string;
  biome: string;
  enemyKeys: RaidEnemyKey[];
  materials: RaidRewardKey[];
  objective: string;
  bossKey?: RaidEnemyKey;
}>;

const lockedChapterStageSeeds = {
  2: [
    {
      name: "Emberfall Gate",
      biome: "Ash-lit gate road",
      enemyKeys: ["ember-mite", "storm-sentinel"],
      materials: ["ember-core"],
      objective: "Break the first ember patrol before the gate braziers flare."
    },
    {
      name: "Cinderroot Bridge",
      biome: "Burnt root crossing",
      enemyKeys: ["ember-mite", "ash-hound"],
      materials: ["ember-core"],
      objective: "Hold the cracked bridge while Ashhounds rush from the smoking grove."
    },
    {
      name: "Smokestack Hollow",
      biome: "Charcoal woodland hollow",
      enemyKeys: ["ash-hound", "briar-crawler"],
      materials: ["moss-thread"],
      objective: "Protect the hollow ward from hounds circling through the smoke."
    },
    {
      name: "Molten Cartway",
      biome: "Lava-scarred trade road",
      enemyKeys: ["ember-mite", "glass-beetle"],
      materials: ["tower-shard"],
      objective: "Stop crystal-backed raiders from cracking the old cartway stones."
    },
    {
      name: "Soot Lantern Run",
      biome: "Lantern-lined ash trail",
      enemyKeys: ["ash-hound", "mist-wisp"],
      materials: ["tidal-pearl"],
      objective: "Keep the soot lanterns lit while wisps blur the road ahead."
    },
    {
      name: "Blazebark Thicket",
      biome: "Burning thorn thicket",
      enemyKeys: ["briar-crawler", "ember-mite"],
      materials: ["ember-core"],
      objective: "Cut down the burning briar line before it reaches the wardstone."
    },
    {
      name: "Kilnstone Rise",
      biome: "Heated stone ridge",
      enemyKeys: ["shard-golem", "ash-hound"],
      materials: ["tower-shard"],
      objective: "Hold the kilnstone ridge against golems hardened by forge heat."
    },
    {
      name: "Furnace Vale",
      biome: "Deep ember valley",
      enemyKeys: ["storm-sentinel", "ember-mite"],
      materials: ["starlit-dust"],
      objective: "Defend the vale pylons while sentinels charge through the ember fog."
    },
    {
      name: "Obsidian Causeway",
      biome: "Black glass causeway",
      enemyKeys: ["shard-golem", "storm-sentinel"],
      materials: ["tower-shard"],
      objective: "Hold the obsidian causeway before the sentinels breach the tower route."
    },
    {
      name: "Emberfall Warden",
      biome: "Ancient ember bastion",
      enemyKeys: ["ash-hound", "storm-sentinel", "solheart-sentinel"],
      materials: ["boss-chest-reward", "ember-core"],
      objective: "Defeat the Emberfall Warden and seal the reach."
    }
  ],
  3: [
    {
      name: "Stormpeak Foothold",
      biome: "Wind-cut mountain pass",
      enemyKeys: ["storm-sentinel", "mist-wisp"],
      materials: ["starlit-dust"],
      objective: "Claim the first foothold while storm wisps test the cliff wards."
    },
    {
      name: "Cloudbreak Steps",
      biome: "High stone stairway",
      enemyKeys: ["storm-sentinel", "glass-beetle"],
      materials: ["tower-shard"],
      objective: "Hold the steps as beetles and sentinels descend through cloudlight."
    },
    {
      name: "Thunderpine Shelf",
      biome: "Pine-covered cliff shelf",
      enemyKeys: ["ash-hound", "storm-sentinel"],
      materials: ["moss-thread"],
      objective: "Protect the shelf beacon from beasts driven wild by thunder."
    },
    {
      name: "Galeglass Crossing",
      biome: "Crystal wind bridge",
      enemyKeys: ["glass-beetle", "shard-golem"],
      materials: ["tower-shard"],
      objective: "Stop the glass swarm before it shatters the crossing sigils."
    },
    {
      name: "Skyhorn Watch",
      biome: "Old mountain watchpost",
      enemyKeys: ["mist-wisp", "rune-warden"],
      materials: ["starlit-dust"],
      objective: "Keep the watchpost lamps burning through the warden assault."
    },
    {
      name: "Tempest Ravine",
      biome: "Storm-carved ravine",
      enemyKeys: ["storm-sentinel", "shard-golem"],
      materials: ["tower-shard"],
      objective: "Hold the ravine path as heavy sentinels force the narrow road."
    },
    {
      name: "Aerie Rune Nest",
      biome: "Rune-marked sky nest",
      enemyKeys: ["rune-warden", "mist-wisp"],
      materials: ["starlit-dust"],
      objective: "Stabilize the aerie runes before the nest collapses into the storm."
    },
    {
      name: "Lightning Cairns",
      biome: "Charged memorial stones",
      enemyKeys: ["storm-sentinel", "shard-golem"],
      materials: ["tower-shard"],
      objective: "Defend the cairns while lightning-charged golems advance."
    },
    {
      name: "Starwind Approach",
      biome: "Final highland approach",
      enemyKeys: ["storm-sentinel", "rune-warden"],
      materials: ["starlit-dust"],
      objective: "Hold the approach before the peak gate opens."
    },
    {
      name: "Stormpeak Sovereign",
      biome: "Summit storm gate",
      enemyKeys: ["storm-sentinel", "shard-golem", "solheart-sentinel"],
      materials: ["boss-chest-reward", "starlit-dust"],
      objective: "Defeat the Stormpeak Sovereign and claim the summit route."
    }
  ]
} satisfies Record<
  2 | 3,
  Array<{
    name: string;
    biome: string;
    enemyKeys: RaidEnemyKey[];
    materials: RaidRewardKey[];
    objective: string;
  }>
>;

/**
 * Map-art-aligned layouts (percent coords over the full 1672x941 stage art).
 * Portal = enemy spawn, wardstone / exit portal = base. Circles = defender posts.
 */
const defaultBattleLayout: RaidBattleLayout = {
  // Stage 1-1 Sproutling Path: purple portal (NW) → winding road → crystal tower (center)
  base: { x: 50, y: 48 },
  defenderSlots: [
    { x: 27, y: 38, progress: 0.22, facing: "right" },
    { x: 30, y: 68, progress: 0.48, facing: "right" },
    { x: 62, y: 68, progress: 0.62, facing: "left" },
    { x: 78, y: 28, progress: 0.18, facing: "left" }
  ],
  enemyPath: [
    { x: 14, y: 20 },
    { x: 17, y: 28 },
    { x: 24, y: 38 },
    { x: 20, y: 50 },
    { x: 22, y: 60 },
    { x: 30, y: 70 },
    { x: 42, y: 74 },
    { x: 54, y: 70 },
    { x: 56, y: 58 },
    { x: 52, y: 52 },
    { x: 50, y: 48 }
  ]
};

const mapOneBattleLayouts: Record<number, RaidBattleLayout> = {
  1: defaultBattleLayout,
  // Stage 1-2: purple portal left → S-road → blue portal right
  2: {
    base: { x: 90, y: 56 },
    defenderSlots: [
      { x: 28, y: 24, progress: 0.2, facing: "right" },
      { x: 22, y: 68, progress: 0.28, facing: "right" },
      { x: 74, y: 24, progress: 0.72, facing: "left" },
      { x: 72, y: 68, progress: 0.78, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 22 },
      { x: 22, y: 30 },
      { x: 34, y: 32 },
      { x: 44, y: 38 },
      { x: 50, y: 44 },
      { x: 56, y: 52 },
      { x: 62, y: 48 },
      { x: 72, y: 42 },
      { x: 82, y: 50 },
      { x: 90, y: 56 }
    ]
  },
  3: {
    base: { x: 88, y: 54 },
    defenderSlots: [
      { x: 26, y: 26, progress: 0.18, facing: "right" },
      { x: 24, y: 66, progress: 0.3, facing: "right" },
      { x: 72, y: 28, progress: 0.7, facing: "left" },
      { x: 70, y: 66, progress: 0.8, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 24 },
      { x: 24, y: 30 },
      { x: 36, y: 34 },
      { x: 48, y: 42 },
      { x: 56, y: 52 },
      { x: 64, y: 48 },
      { x: 74, y: 44 },
      { x: 84, y: 50 },
      { x: 88, y: 54 }
    ]
  },
  4: {
    base: { x: 89, y: 58 },
    defenderSlots: [
      { x: 27, y: 28, progress: 0.18, facing: "right" },
      { x: 24, y: 70, progress: 0.32, facing: "right" },
      { x: 72, y: 30, progress: 0.7, facing: "left" },
      { x: 70, y: 70, progress: 0.82, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 26 },
      { x: 24, y: 32 },
      { x: 36, y: 36 },
      { x: 48, y: 44 },
      { x: 56, y: 54 },
      { x: 66, y: 50 },
      { x: 76, y: 48 },
      { x: 86, y: 54 },
      { x: 89, y: 58 }
    ]
  },
  5: {
    base: { x: 88, y: 52 },
    defenderSlots: [
      { x: 28, y: 26, progress: 0.18, facing: "right" },
      { x: 24, y: 68, progress: 0.3, facing: "right" },
      { x: 74, y: 26, progress: 0.72, facing: "left" },
      { x: 72, y: 68, progress: 0.8, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 24 },
      { x: 24, y: 30 },
      { x: 36, y: 34 },
      { x: 48, y: 42 },
      { x: 58, y: 50 },
      { x: 68, y: 46 },
      { x: 78, y: 44 },
      { x: 86, y: 50 },
      { x: 88, y: 52 }
    ]
  },
  6: {
    base: { x: 89, y: 60 },
    defenderSlots: [
      { x: 28, y: 28, progress: 0.18, facing: "right" },
      { x: 24, y: 70, progress: 0.32, facing: "right" },
      { x: 74, y: 28, progress: 0.7, facing: "left" },
      { x: 72, y: 70, progress: 0.82, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 28 },
      { x: 24, y: 34 },
      { x: 36, y: 38 },
      { x: 48, y: 46 },
      { x: 58, y: 56 },
      { x: 68, y: 52 },
      { x: 78, y: 50 },
      { x: 86, y: 56 },
      { x: 89, y: 60 }
    ]
  },
  7: {
    base: { x: 88, y: 54 },
    defenderSlots: [
      { x: 28, y: 26, progress: 0.18, facing: "right" },
      { x: 24, y: 68, progress: 0.3, facing: "right" },
      { x: 74, y: 26, progress: 0.72, facing: "left" },
      { x: 72, y: 68, progress: 0.8, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 24 },
      { x: 24, y: 30 },
      { x: 36, y: 36 },
      { x: 48, y: 44 },
      { x: 58, y: 52 },
      { x: 68, y: 48 },
      { x: 78, y: 46 },
      { x: 86, y: 52 },
      { x: 88, y: 54 }
    ]
  },
  8: {
    base: { x: 89, y: 58 },
    defenderSlots: [
      { x: 28, y: 28, progress: 0.18, facing: "right" },
      { x: 24, y: 70, progress: 0.32, facing: "right" },
      { x: 74, y: 28, progress: 0.7, facing: "left" },
      { x: 72, y: 70, progress: 0.82, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 26 },
      { x: 24, y: 32 },
      { x: 36, y: 38 },
      { x: 48, y: 46 },
      { x: 58, y: 54 },
      { x: 68, y: 50 },
      { x: 78, y: 48 },
      { x: 86, y: 54 },
      { x: 89, y: 58 }
    ]
  },
  9: {
    base: { x: 88, y: 54 },
    defenderSlots: [
      { x: 28, y: 26, progress: 0.18, facing: "right" },
      { x: 24, y: 68, progress: 0.3, facing: "right" },
      { x: 74, y: 26, progress: 0.72, facing: "left" },
      { x: 72, y: 68, progress: 0.8, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 24 },
      { x: 24, y: 30 },
      { x: 36, y: 36 },
      { x: 48, y: 44 },
      { x: 58, y: 52 },
      { x: 68, y: 48 },
      { x: 78, y: 46 },
      { x: 86, y: 52 },
      { x: 88, y: 54 }
    ]
  },
  10: {
    base: { x: 50, y: 48 },
    defenderSlots: [
      { x: 26, y: 36, progress: 0.22, facing: "right" },
      { x: 28, y: 70, progress: 0.5, facing: "right" },
      { x: 64, y: 70, progress: 0.62, facing: "left" },
      { x: 76, y: 30, progress: 0.2, facing: "left" }
    ],
    enemyPath: [
      { x: 14, y: 22 },
      { x: 20, y: 32 },
      { x: 26, y: 40 },
      { x: 22, y: 54 },
      { x: 28, y: 68 },
      { x: 42, y: 74 },
      { x: 56, y: 70 },
      { x: 58, y: 58 },
      { x: 52, y: 52 },
      { x: 50, y: 48 }
    ]
  }
};

const mapTwoBattleLayouts: Record<number, RaidBattleLayout> = {
  1: {
    base: { x: 90, y: 58 },
    defenderSlots: [
      { x: 24, y: 58, progress: 0.2, facing: "right" },
      { x: 40, y: 54, progress: 0.38, facing: "right" },
      { x: 60, y: 52, progress: 0.62, facing: "left" },
      { x: 78, y: 48, progress: 0.82, facing: "left" }
    ],
    enemyPath: [
      { x: 10, y: 56 },
      { x: 20, y: 55 },
      { x: 32, y: 54 },
      { x: 44, y: 53 },
      { x: 56, y: 52 },
      { x: 68, y: 50 },
      { x: 80, y: 50 },
      { x: 90, y: 58 }
    ]
  },
  2: {
    base: { x: 90, y: 56 },
    defenderSlots: [
      { x: 26, y: 60, progress: 0.22, facing: "right" },
      { x: 44, y: 56, progress: 0.42, facing: "right" },
      { x: 62, y: 48, progress: 0.64, facing: "left" },
      { x: 80, y: 40, progress: 0.84, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 62 },
      { x: 24, y: 60 },
      { x: 36, y: 58 },
      { x: 48, y: 54 },
      { x: 58, y: 50 },
      { x: 68, y: 44 },
      { x: 80, y: 40 },
      { x: 90, y: 56 }
    ]
  },
  3: {
    base: { x: 90, y: 52 },
    defenderSlots: [
      { x: 26, y: 54, progress: 0.22, facing: "right" },
      { x: 44, y: 50, progress: 0.42, facing: "right" },
      { x: 62, y: 46, progress: 0.64, facing: "left" },
      { x: 80, y: 40, progress: 0.84, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 54 },
      { x: 24, y: 54 },
      { x: 36, y: 52 },
      { x: 48, y: 50 },
      { x: 60, y: 46 },
      { x: 72, y: 42 },
      { x: 82, y: 40 },
      { x: 90, y: 52 }
    ]
  },
  4: {
    base: { x: 90, y: 62 },
    defenderSlots: [
      { x: 26, y: 64, progress: 0.22, facing: "right" },
      { x: 44, y: 60, progress: 0.42, facing: "right" },
      { x: 62, y: 56, progress: 0.64, facing: "left" },
      { x: 80, y: 52, progress: 0.84, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 64 },
      { x: 24, y: 63 },
      { x: 36, y: 62 },
      { x: 48, y: 60 },
      { x: 60, y: 58 },
      { x: 72, y: 54 },
      { x: 82, y: 52 },
      { x: 90, y: 62 }
    ]
  },
  5: {
    base: { x: 90, y: 54 },
    defenderSlots: [
      { x: 28, y: 58, progress: 0.22, facing: "right" },
      { x: 46, y: 54, progress: 0.42, facing: "right" },
      { x: 64, y: 48, progress: 0.64, facing: "left" },
      { x: 80, y: 40, progress: 0.84, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 58 },
      { x: 26, y: 57 },
      { x: 38, y: 56 },
      { x: 50, y: 54 },
      { x: 62, y: 50 },
      { x: 74, y: 44 },
      { x: 84, y: 40 },
      { x: 90, y: 54 }
    ]
  },
  6: {
    base: { x: 90, y: 58 },
    defenderSlots: [
      { x: 26, y: 62, progress: 0.22, facing: "right" },
      { x: 44, y: 58, progress: 0.42, facing: "right" },
      { x: 62, y: 52, progress: 0.64, facing: "left" },
      { x: 80, y: 46, progress: 0.84, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 62 },
      { x: 24, y: 61 },
      { x: 36, y: 60 },
      { x: 48, y: 56 },
      { x: 60, y: 52 },
      { x: 72, y: 48 },
      { x: 82, y: 46 },
      { x: 90, y: 58 }
    ]
  },
  7: {
    base: { x: 90, y: 64 },
    defenderSlots: [
      { x: 28, y: 66, progress: 0.22, facing: "right" },
      { x: 46, y: 62, progress: 0.42, facing: "right" },
      { x: 64, y: 56, progress: 0.64, facing: "left" },
      { x: 82, y: 48, progress: 0.84, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 66 },
      { x: 26, y: 65 },
      { x: 38, y: 64 },
      { x: 50, y: 60 },
      { x: 62, y: 56 },
      { x: 74, y: 50 },
      { x: 84, y: 48 },
      { x: 90, y: 64 }
    ]
  },
  8: {
    base: { x: 90, y: 56 },
    defenderSlots: [
      { x: 28, y: 60, progress: 0.22, facing: "right" },
      { x: 46, y: 56, progress: 0.42, facing: "right" },
      { x: 64, y: 50, progress: 0.64, facing: "left" },
      { x: 82, y: 42, progress: 0.84, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 60 },
      { x: 26, y: 58 },
      { x: 38, y: 56 },
      { x: 50, y: 54 },
      { x: 62, y: 50 },
      { x: 74, y: 44 },
      { x: 84, y: 42 },
      { x: 90, y: 56 }
    ]
  },
  9: {
    base: { x: 90, y: 60 },
    defenderSlots: [
      { x: 28, y: 64, progress: 0.22, facing: "right" },
      { x: 46, y: 58, progress: 0.42, facing: "right" },
      { x: 64, y: 54, progress: 0.64, facing: "left" },
      { x: 82, y: 46, progress: 0.84, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 64 },
      { x: 26, y: 62 },
      { x: 38, y: 60 },
      { x: 50, y: 56 },
      { x: 62, y: 52 },
      { x: 74, y: 48 },
      { x: 84, y: 46 },
      { x: 90, y: 60 }
    ]
  },
  10: {
    base: { x: 90, y: 54 },
    defenderSlots: [
      { x: 28, y: 58, progress: 0.22, facing: "right" },
      { x: 46, y: 54, progress: 0.42, facing: "right" },
      { x: 64, y: 48, progress: 0.64, facing: "left" },
      { x: 82, y: 42, progress: 0.84, facing: "left" }
    ],
    enemyPath: [
      { x: 12, y: 58 },
      { x: 26, y: 56 },
      { x: 38, y: 54 },
      { x: 50, y: 52 },
      { x: 62, y: 48 },
      { x: 74, y: 44 },
      { x: 84, y: 42 },
      { x: 90, y: 54 }
    ]
  }
};

function createChapterBattleLayout(mapNumber: number, stageInMap: number): RaidBattleLayout {
  if (mapNumber === 1) {
    return mapOneBattleLayouts[stageInMap] ?? defaultBattleLayout;
  }

  if (mapNumber === 2) {
    return mapTwoBattleLayouts[stageInMap] ?? defaultBattleLayout;
  }

  const verticalOffset = ((stageInMap - 1) % 5) * 2;
  const leftArenaY = mapNumber === 2 ? 42 + verticalOffset * 0.35 : 36 + verticalOffset * 0.3;
  const rightArenaY = mapNumber === 2 ? 68 - verticalOffset * 0.4 : 62 - verticalOffset * 0.3;
  const baseY = mapNumber === 2 ? 62 + verticalOffset * 0.2 : 58 + verticalOffset * 0.15;
  const entryY = mapNumber === 2 ? 28 + verticalOffset * 0.25 : 24 + verticalOffset * 0.25;

  return {
    base: { x: 10, y: baseY },
    defenderSlots: [
      { x: 32, y: baseY + 3, progress: 0.73, facing: "right" },
      { x: 56, y: rightArenaY, progress: 0.5, facing: "left" },
      { x: 36, y: leftArenaY, progress: 0.34, facing: "right" },
      { x: 73, y: entryY + 10, progress: 0.16, facing: "left" }
    ],
    enemyPath: [
      { x: 91, y: entryY },
      { x: 80, y: entryY + 4 },
      { x: 72, y: entryY + 13 },
      { x: 63, y: rightArenaY - 4 },
      { x: 54, y: rightArenaY },
      { x: 44, y: baseY + 1 },
      { x: 32, y: baseY + 3 },
      { x: 21, y: baseY + 1 },
      { x: 10, y: baseY }
    ]
  };
}

const mapOneStages = mapOneStageSeeds.map((seed) =>
  createStage({
    mapNumber: 1,
    chapterId: "map-1-solheart-outskirts",
    chapterName: "Map 1: Solheart Outskirts",
    chapterStatus: "ACTIVE",
    stageInMap: seed.stage,
    name: seed.name,
    biome: seed.biome,
    recommendedAccountLevel: seed.stage,
    recommendedPower: 420 + seed.stage * 95,
    baseGoldReward: 18 + seed.stage * 4,
    baseXpReward: 55 + seed.stage * 25,
    thumbnailPath: getRaidStageAssetPath(1, seed.stage) ?? `${raidAssetRoot}/chapters/solheart-outskirts-banner.png`,
    objective: seed.objective,
    enemyKeys: seed.enemyKeys,
    materialKeys: seed.materials,
    bossKey: seed.bossKey
  })
);

export const raidChapters: RaidChapterDefinition[] = [
  {
    id: "map-1-solheart-outskirts",
    mapNumber: 1,
    title: "Map 1: Solheart Outskirts",
    shortTitle: "Solheart Outskirts",
    levelRange: "Levels 1-10",
    minAccountLevel: 1,
    unlockRequirement: "Available from Account Level 1.",
    bannerPath: getRaidStageAssetPath(1, 1) ?? `${raidAssetRoot}/chapters/solheart-outskirts-banner.png`,
    status: "ACTIVE",
    stages: mapOneStages
  },
  {
    id: "map-2-emberfall-reach",
    mapNumber: 2,
    title: "Map 2: Emberfall Reach",
    shortTitle: "Emberfall Reach",
    levelRange: "Levels 11-20",
    minAccountLevel: 11,
    unlockRequirement: "Requires Account Level 11 and completion of Stage 1-10.",
    bannerPath: getRaidStageAssetPath(2, 1) ?? `${raidAssetRoot}/chapters/emberfall-reach-locked.png`,
    status: "LOCKED",
    stages: createLockedStages(2, "map-2-emberfall-reach", "Map 2: Emberfall Reach", 11)
  },
  {
    id: "map-3-stormpeak-aerie",
    mapNumber: 3,
    title: "Map 3: Stormpeak Aerie",
    shortTitle: "Stormpeak Aerie",
    levelRange: "Levels 21-30",
    minAccountLevel: 21,
    unlockRequirement: "Future content. Requires Account Level 21 and completion of Stage 2-10.",
    bannerPath: `${raidAssetRoot}/chapters/stormpeak-aerie-locked.png`,
    status: "FUTURE",
    stages: createLockedStages(3, "map-3-stormpeak-aerie", "Map 3: Stormpeak Aerie", 21)
  }
];

export const raidStages = raidChapters.flatMap((chapter) => chapter.stages);

export const mapDefinitions = raidStages;

export const prototypeWaves = mapOneStages[0].waves;

export function getRaidStageById(stageId: string): RaidStageDefinition | undefined {
  return raidStages.find((stage) => stage.id === stageId);
}

export function getPreviousRaidStageId(stage: RaidStageDefinition): string | null {
  if (stage.mapNumber === 1 && stage.stageIndex === 1) {
    return null;
  }
  if (stage.stageIndex === 1) {
    return `tower-${stage.mapNumber - 1}-10`;
  }
  return `tower-${stage.mapNumber}-${stage.stageIndex - 1}`;
}

export function getRaidStageUnlockState(
  stageOrId: RaidStageDefinition | string,
  accountLevel: number,
  completedStageIds: Iterable<string>
): RaidStageUnlockState {
  const stage = typeof stageOrId === "string" ? getRaidStageById(stageOrId) : stageOrId;
  if (!stage) {
    return {
      stageId: typeof stageOrId === "string" ? stageOrId : "unknown",
      unlocked: false,
      completed: false,
      reason: "Unknown stage.",
      requiredAccountLevel: 1,
      requiredStageId: null,
      requiredStageLabel: null
    };
  }

  const completed = new Set(completedStageIds);
  const previousStageId = getPreviousRaidStageId(stage);
  const previousStage = previousStageId ? getRaidStageById(previousStageId) : undefined;
  const previousStageLabel = previousStage ? `Stage ${previousStage.stageNumber}` : null;

  if (accountLevel < stage.recommendedAccountLevel) {
    return {
      stageId: stage.id,
      unlocked: false,
      completed: completed.has(stage.id),
      reason: previousStageLabel
        ? `Requires Account Level ${stage.recommendedAccountLevel} and completion of ${previousStageLabel}.`
        : `Requires Account Level ${stage.recommendedAccountLevel}.`,
      requiredAccountLevel: stage.recommendedAccountLevel,
      requiredStageId: previousStageId,
      requiredStageLabel: previousStageLabel
    };
  }

  if (previousStageId && !completed.has(previousStageId)) {
    return {
      stageId: stage.id,
      unlocked: false,
      completed: completed.has(stage.id),
      reason: `Requires completion of ${previousStageLabel ?? previousStageId}.`,
      requiredAccountLevel: stage.recommendedAccountLevel,
      requiredStageId: previousStageId,
      requiredStageLabel: previousStageLabel
    };
  }

  if (stage.chapterStatus !== "ACTIVE") {
    return {
      stageId: stage.id,
      unlocked: false,
      completed: completed.has(stage.id),
      reason:
        stage.chapterStatus === "FUTURE"
          ? `${stage.chapterName} is future content.`
          : `${stage.chapterName} is locked for a later content update.`,
      requiredAccountLevel: stage.recommendedAccountLevel,
      requiredStageId: previousStageId,
      requiredStageLabel: previousStageLabel
    };
  }

  return {
    stageId: stage.id,
    unlocked: true,
    completed: completed.has(stage.id),
    reason: null,
    requiredAccountLevel: stage.recommendedAccountLevel,
    requiredStageId: previousStageId,
    requiredStageLabel: previousStageLabel
  };
}

export function getRaidChapterClearCount(chapter: RaidChapterDefinition, completedStageIds: Iterable<string>): number {
  const completed = new Set(completedStageIds);
  return chapter.stages.filter((stage) => completed.has(stage.id)).length;
}

export function getPaginatedRaidStages(stages: RaidStageDefinition[], page: number, perPage = 5): RaidStageDefinition[] {
  const safePerPage = Math.max(1, perPage);
  const pageCount = Math.max(1, Math.ceil(stages.length / safePerPage));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  return stages.slice(safePage * safePerPage, safePage * safePerPage + safePerPage);
}

function createStage(input: {
  mapNumber: number;
  chapterId: string;
  chapterName: string;
  chapterStatus: RaidChapterStatus;
  stageInMap: number;
  name: string;
  biome: string;
  recommendedAccountLevel: number;
  recommendedPower: number;
  baseGoldReward: number;
  baseXpReward: number;
  thumbnailPath: string;
  objective: string;
  enemyKeys: RaidEnemyKey[];
  materialKeys: RaidRewardKey[];
  bossKey?: RaidEnemyKey;
}): RaidStageDefinition {
  const stageNumber = `${input.mapNumber}-${input.stageInMap}`;
  const id = `tower-${stageNumber}`;
  const waves = createWaves(input.enemyKeys, input.stageInMap, input.bossKey);
  const rewardKeys: RaidRewardKey[] = ["earned-gold", "xp", ...input.materialKeys];
  const rewardPreview = rewardKeys.map((key) => ({
    key,
    label: raidRewardAssets[key].label,
    amount: rewardAmount(key, input),
    assetPath: raidRewardAssets[key].assetPath
  }));

  return {
    id,
    stageNumber,
    stageIndex: input.stageInMap,
    mapNumber: input.mapNumber,
    chapterId: input.chapterId,
    chapterName: input.chapterName,
    chapterStatus: input.chapterStatus,
    name: input.name,
    chapter: input.chapterName,
    biome: input.biome,
    recommendedAccountLevel: input.recommendedAccountLevel,
    recommendedPower: input.recommendedPower,
    baseGoldReward: input.baseGoldReward,
    baseXpReward: input.baseXpReward,
    unlockedByDefault: input.mapNumber === 1 && input.stageInMap === 1,
    thumbnailPath: input.thumbnailPath,
    largePreviewPath: input.thumbnailPath,
    objective: input.objective,
    estimatedDuration: "About 5 minutes",
    partySize: "1-4 Players",
    primaryEnemyKey: input.enemyKeys[0],
    enemyKeys: input.enemyKeys,
    rewardPreview,
    waves,
    battleLayout: createChapterBattleLayout(input.mapNumber, input.stageInMap),
    isBossStage: Boolean(input.bossKey),
    bossKey: input.bossKey,
    bossName: input.bossKey ? raidEnemyAssets[input.bossKey].label : undefined
  };
}

function createLockedStages(
  mapNumber: number,
  chapterId: string,
  chapterName: string,
  firstLevel: number
): RaidStageDefinition[] {
  const stageSeeds = lockedChapterStageSeeds[mapNumber as 2 | 3];
  return Array.from({ length: 10 }, (_, index) => {
    const stageInMap = index + 1;
    const seed = stageSeeds[index];
    return createStage({
      mapNumber,
      chapterId,
      chapterName,
      chapterStatus: mapNumber === 2 ? "LOCKED" : "FUTURE",
      stageInMap,
      name: seed.name,
      biome: seed.biome,
      recommendedAccountLevel: firstLevel + index,
      recommendedPower: 1400 + (firstLevel + index) * 110,
      baseGoldReward: 70 + index * 5,
      baseXpReward: 320 + index * 35,
      thumbnailPath:
        getRaidStageAssetPath(mapNumber, stageInMap) ??
        (mapNumber === 2
          ? `${raidAssetRoot}/chapters/emberfall-reach-locked.png`
          : `${raidAssetRoot}/chapters/stormpeak-aerie-locked.png`),
      objective: seed.objective,
      enemyKeys: seed.enemyKeys,
      materialKeys: seed.materials,
      bossKey: stageInMap === 10 ? "solheart-sentinel" : undefined
    });
  });
}

function createWaves(enemyKeys: RaidEnemyKey[], stageInMap: number, bossKey?: RaidEnemyKey): RaidWaveDefinition[] {
  const normalEnemies = enemyKeys.filter((key) => key !== bossKey);
  const waveCount = bossKey ? 5 : 4;
  const waves: RaidWaveDefinition[] = [];
  for (let index = 0; index < waveCount; index += 1) {
    const isBossWave = Boolean(bossKey) && index === waveCount - 1;
    const key = isBossWave ? bossKey : normalEnemies[index % normalEnemies.length];
    if (!key) continue;
    const earlyStageRelief = Math.max(0, 4 - stageInMap);
    const normalCount = Math.max(3, 4 + stageInMap + index - earlyStageRelief);
    const normalHp = Math.max(16, 16 + stageInMap * 8 + index * 7 - earlyStageRelief * 3);
    waves.push({
      wave: index + 1,
      second: index * 45,
      enemyKey: key,
      enemy: raidEnemyAssets[key].label,
      count: isBossWave ? 1 : normalCount,
      hp: isBossWave ? 900 + stageInMap * 95 : normalHp,
      speed: isBossWave ? 20 : Math.max(26, 30 + (index % 3) * 3 + stageInMap - earlyStageRelief),
      modifier: isBossWave ? "Boss" : waveModifier(stageInMap, index),
      boss: isBossWave || undefined
    });
  }
  return waves;
}

function rewardAmount(
  key: RaidRewardKey,
  input: {
    stageInMap: number;
    baseGoldReward: number;
    baseXpReward: number;
  }
): string {
  if (key === "earned-gold") return `${input.baseGoldReward}`;
  if (key === "xp") return `${input.baseXpReward}`;
  if (key === "gear-chest") return "Chance";
  return `x${1 + Math.floor(input.stageInMap / 3)}`;
}

function waveModifier(stageInMap: number, index: number): string {
  const modifiers = ["Forest", "Fast", "Armored", "Arcane", "Elite"];
  return modifiers[(stageInMap + index) % modifiers.length];
}
