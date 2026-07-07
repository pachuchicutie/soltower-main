import type { HeroId } from "./types";

export type HeroAssetType = "transparent-png" | "transparent-png-spritesheet";
export type HeroAnimationName = "idle" | "walk" | "run" | "attack";

export type HeroAppearance = {
  hairStyle: "storm-swept" | "soft-bob" | "crest";
  hairColor: string;
  skinTone: string;
  outfitVariant: "village-defender" | "traveler" | "ceremonial";
  accentColor: string;
  backAccessory: "starter-cloak" | "long-cloak" | "wing-cape";
  weaponAccent: string;
};

export type HeroLayerPaths = {
  hair: Record<HeroAppearance["hairStyle"], string>;
  skin: string;
  outfit: Record<HeroAppearance["outfitVariant"], string>;
  accent: string;
  cloak: Record<HeroAppearance["backAccessory"], string>;
  weapon: string;
};

export type HeroAssetManifestEntry = {
  heroId: HeroId;
  assetPath: string;
  assetType: HeroAssetType;
  dimensions: {
    previewIcon: { width: 96; height: 96 };
    portrait: { width: 192; height: 192 };
    worldSpriteSheet: { width: 256; height: 256; frameWidth: 64; frameHeight: 64 };
  };
  animationLayout: {
    actions: ["idle", "walk", "run", "attack"];
    columns: ["frame-1", "frame-2", "frame-3", "frame-4"];
    rows: ["down", "left", "right", "up"];
    frameCount: 16;
  };
  anchor: { x: 0.5; y: 0.88 };
  origin: { x: 0.5; y: 0.88 };
  fallback: {
    previewIconPath: string;
    worldSpritePaths: Record<HeroAnimationName, string>;
  };
  previewIconPath: string;
  portraitPath: string;
  worldSpritePaths: Record<HeroAnimationName, string>;
  customizationLayerCompatibility: {
    tintSafe: true;
    portraitLayers: HeroLayerPaths;
    worldLayers: Record<HeroAnimationName, HeroLayerPaths>;
  };
  defaultAppearance: HeroAppearance;
};

const root = "/assets/soltower/heroes";

const heroDefaults: Record<HeroId, HeroAppearance> = {
  "storm-archer": {
    hairStyle: "storm-swept",
    hairColor: "#f6d365",
    skinTone: "#d99a73",
    outfitVariant: "village-defender",
    accentColor: "#7dd3fc",
    backAccessory: "starter-cloak",
    weaponAccent: "#eecb72"
  },
  "tide-mage": {
    hairStyle: "soft-bob",
    hairColor: "#d7f9ff",
    skinTone: "#c98b68",
    outfitVariant: "traveler",
    accentColor: "#38d6d6",
    backAccessory: "long-cloak",
    weaponAccent: "#bfe8ff"
  },
  bombardier: {
    hairStyle: "crest",
    hairColor: "#4b2b21",
    skinTone: "#b97852",
    outfitVariant: "village-defender",
    accentColor: "#fb923c",
    backAccessory: "starter-cloak",
    weaponAccent: "#d0873d"
  },
  "coral-alchemist": {
    hairStyle: "soft-bob",
    hairColor: "#5ee0b4",
    skinTone: "#c98870",
    outfitVariant: "traveler",
    accentColor: "#fb7185",
    backAccessory: "wing-cape",
    weaponAccent: "#9ef0d2"
  },
  starcaller: {
    hairStyle: "storm-swept",
    hairColor: "#f9e7a5",
    skinTone: "#b97862",
    outfitVariant: "ceremonial",
    accentColor: "#a78bfa",
    backAccessory: "long-cloak",
    weaponAccent: "#facc15"
  }
};

export const heroCustomizationOptions = {
  hairStyles: [
    { id: "storm-swept", label: "Storm swept" },
    { id: "soft-bob", label: "Soft bob" },
    { id: "crest", label: "Crest" }
  ],
  hairColors: [
    { id: "#f6d365", label: "Sunlit Gold" },
    { id: "#d7f9ff", label: "Pearl White" },
    { id: "#4b2b21", label: "Ember Brown" },
    { id: "#5ee0b4", label: "Seafoam" },
    { id: "#f9e7a5", label: "Star Blonde" }
  ],
  skinTones: [
    { id: "#d99a73", label: "Warm" },
    { id: "#c98b68", label: "Honey" },
    { id: "#b97852", label: "Bronze" },
    { id: "#e0ad86", label: "Sunlit" }
  ],
  outfitVariants: [
    { id: "village-defender", label: "Village defender" },
    { id: "traveler", label: "Traveler" },
    { id: "ceremonial", label: "Ceremonial" }
  ],
  accentColors: [
    { id: "#7dd3fc", label: "Lightning Blue" },
    { id: "#38d6d6", label: "Tide Teal" },
    { id: "#fb923c", label: "Ember Copper" },
    { id: "#fb7185", label: "Coral Rose" },
    { id: "#a78bfa", label: "Starlit Violet" },
    { id: "#f3c969", label: "Tower Gold" }
  ],
  backAccessories: [
    { id: "starter-cloak", label: "Starter cloak" },
    { id: "long-cloak", label: "Long cloak" },
    { id: "wing-cape", label: "Wing cape" }
  ],
  weaponAccents: [
    { id: "#eecb72", label: "Hero default" },
    { id: "#77d4f2", label: "Magical blue" },
    { id: "#a78bfa", label: "Rune violet" },
    { id: "#f3c969", label: "Warm gold" }
  ]
} as const;

export const heroAssetManifest = {
  "storm-archer": makeHeroEntry("storm-archer"),
  "tide-mage": makeHeroEntry("tide-mage"),
  bombardier: makeHeroEntry("bombardier"),
  "coral-alchemist": makeHeroEntry("coral-alchemist"),
  starcaller: makeHeroEntry("starcaller")
} satisfies Record<HeroId, HeroAssetManifestEntry>;

export const heroAnimationNames = ["idle", "walk", "run", "attack"] as const satisfies readonly HeroAnimationName[];

export function defaultHeroAppearance(heroId: string | null | undefined): HeroAppearance {
  return { ...heroDefaults[normalizeHeroId(heroId)] };
}

export function normalizeHeroAppearance(
  heroId: string | null | undefined,
  appearance: Partial<HeroAppearance> | null | undefined
): HeroAppearance {
  const fallback = defaultHeroAppearance(heroId);
  return {
    hairStyle: isOption(appearance?.hairStyle, heroCustomizationOptions.hairStyles) ? appearance.hairStyle : fallback.hairStyle,
    hairColor: isOption(appearance?.hairColor, heroCustomizationOptions.hairColors) ? appearance.hairColor : fallback.hairColor,
    skinTone: isOption(appearance?.skinTone, heroCustomizationOptions.skinTones) ? appearance.skinTone : fallback.skinTone,
    outfitVariant: isOption(appearance?.outfitVariant, heroCustomizationOptions.outfitVariants)
      ? appearance.outfitVariant
      : fallback.outfitVariant,
    accentColor: isOption(appearance?.accentColor, heroCustomizationOptions.accentColors)
      ? appearance.accentColor
      : fallback.accentColor,
    backAccessory: isOption(appearance?.backAccessory, heroCustomizationOptions.backAccessories)
      ? appearance.backAccessory
      : fallback.backAccessory,
    weaponAccent: isOption(appearance?.weaponAccent, heroCustomizationOptions.weaponAccents)
      ? appearance.weaponAccent
      : fallback.weaponAccent
  };
}

export function normalizeHeroId(heroId: string | null | undefined): HeroId {
  return isHeroId(heroId) ? heroId : "storm-archer";
}

export function heroPreviewIconPath(heroId: string | null | undefined): string {
  return heroAssetManifest[normalizeHeroId(heroId)].previewIconPath;
}

export function heroPortraitPath(heroId: string | null | undefined): string {
  return heroAssetManifest[normalizeHeroId(heroId)].portraitPath;
}

export function heroWorldSpritePath(
  heroId: string | null | undefined,
  animation: HeroAnimationName = "idle"
): string {
  return heroAssetManifest[normalizeHeroId(heroId)].worldSpritePaths[animation];
}

function makeHeroEntry(heroId: HeroId): HeroAssetManifestEntry {
  const heroRoot = `${root}/${heroId}`;
  return {
    heroId,
    assetPath: heroRoot,
    assetType: "transparent-png-spritesheet",
    dimensions: {
      previewIcon: { width: 96, height: 96 },
      portrait: { width: 192, height: 192 },
      worldSpriteSheet: { width: 256, height: 256, frameWidth: 64, frameHeight: 64 }
    },
    animationLayout: {
      actions: ["idle", "walk", "run", "attack"],
      columns: ["frame-1", "frame-2", "frame-3", "frame-4"],
      rows: ["down", "left", "right", "up"],
      frameCount: 16
    },
    anchor: { x: 0.5, y: 0.88 },
    origin: { x: 0.5, y: 0.88 },
    fallback: {
      previewIconPath: `${root}/shared/fallback-silhouette.png`,
      worldSpritePaths: makeFallbackActionPaths()
    },
    previewIconPath: `${heroRoot}/icon.png`,
    portraitPath: `${heroRoot}/portrait.png`,
    worldSpritePaths: makeActionPaths(heroRoot),
    customizationLayerCompatibility: {
      tintSafe: true,
      portraitLayers: makeLayerPaths(`${heroRoot}/layers/portrait`),
      worldLayers: makeActionLayerPaths(`${heroRoot}/layers/world`)
    },
    defaultAppearance: heroDefaults[heroId]
  };
}

function makeActionPaths(rootPath: string): Record<HeroAnimationName, string> {
  return {
    idle: `${rootPath}/idle.png`,
    walk: `${rootPath}/walk.png`,
    run: `${rootPath}/run.png`,
    attack: `${rootPath}/attack.png`
  };
}

function makeFallbackActionPaths(): Record<HeroAnimationName, string> {
  return {
    idle: `${root}/shared/fallback-idle.png`,
    walk: `${root}/shared/fallback-walk.png`,
    run: `${root}/shared/fallback-run.png`,
    attack: `${root}/shared/fallback-attack.png`
  };
}

function makeActionLayerPaths(rootPath: string): Record<HeroAnimationName, HeroLayerPaths> {
  return {
    idle: makeLayerPaths(`${rootPath}/idle`),
    walk: makeLayerPaths(`${rootPath}/walk`),
    run: makeLayerPaths(`${rootPath}/run`),
    attack: makeLayerPaths(`${rootPath}/attack`)
  };
}

function makeLayerPaths(rootPath: string): HeroLayerPaths {
  return {
    hair: {
      "storm-swept": `${rootPath}/hair-storm-swept.png`,
      "soft-bob": `${rootPath}/hair-soft-bob.png`,
      crest: `${rootPath}/hair-crest.png`
    },
    skin: `${rootPath}/skin.png`,
    outfit: {
      "village-defender": `${rootPath}/outfit-village-defender.png`,
      traveler: `${rootPath}/outfit-traveler.png`,
      ceremonial: `${rootPath}/outfit-ceremonial.png`
    },
    accent: `${rootPath}/accent.png`,
    cloak: {
      "starter-cloak": `${rootPath}/cloak-starter-cloak.png`,
      "long-cloak": `${rootPath}/cloak-long-cloak.png`,
      "wing-cape": `${rootPath}/cloak-wing-cape.png`
    },
    weapon: `${rootPath}/weapon.png`
  };
}

function isHeroId(value: unknown): value is HeroId {
  return typeof value === "string" && value in heroDefaults;
}

function isOption<T extends string>(value: unknown, options: readonly { id: T; label: string }[]): value is T {
  return typeof value === "string" && options.some((option) => option.id === value);
}
