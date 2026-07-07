import type { HeroDefinition } from "@soltower/shared";

export const heroDefinitions: HeroDefinition[] = [
  {
    id: "storm-archer",
    name: "Storm Archer",
    className: "Ranged Guardian",
    role: "Long-range single-target boss damage",
    attackType: "Single-target lightning burst",
    tagline: "Long-range burst damage",
    description: "A safe backline guardian who picks off priority targets with lightning-charged arrows.",
    ultimate: "Storm Volley",
    accent: "#7dd3fc",
    stats: {
      power: 420,
      damage: 64,
      attackSpeed: 72,
      critChance: 18,
      critDamage: 165,
      bossDamage: 22,
      luck: 7,
      range: 92
    },
    onboardingStats: {
      power: 84,
      damage: 88,
      attackSpeed: 78,
      range: 96,
      survivability: 48,
      utility: 56,
      difficulty: 42
    },
    strengths: ["Excellent range", "Strong boss pressure", "Safe positioning"],
    weaknesses: ["Lower frontline durability", "Less efficient into dense swarms"],
    bestFor: "Boss damage and careful ranged play",
    starterGearSummary: "Basic Bow, light armor, storm charm, focus relic",
    tags: ["range", "crit", "armor pierce"]
  },
  {
    id: "tide-mage",
    name: "Tide Mage",
    className: "Control Caster",
    role: "Area damage and slow",
    attackType: "Splash magic and slows",
    tagline: "Area control and wave slowing",
    description: "A flowing spellcaster who softens groups and buys time with tide magic.",
    ultimate: "Tidal Surge",
    accent: "#38bdf8",
    stats: {
      power: 405,
      damage: 52,
      attackSpeed: 58,
      critChance: 8,
      critDamage: 135,
      bossDamage: 9,
      luck: 10,
      range: 76
    },
    onboardingStats: {
      power: 81,
      damage: 72,
      attackSpeed: 64,
      range: 78,
      survivability: 52,
      utility: 90,
      difficulty: 58
    },
    strengths: ["Controls grouped enemies", "Reliable slow effects", "Good team utility"],
    weaknesses: ["Lower single-target burst", "Needs good placement timing"],
    bestFor: "Players who like controlling waves and setting up allies",
    starterGearSummary: "Tide staff, woven armor, current charm, moonwater relic",
    tags: ["chain damage", "splash", "slow"]
  },
  {
    id: "bombardier",
    name: "Bombardier",
    className: "Siege Specialist",
    role: "Artillery and explosive area damage",
    attackType: "Explosive artillery shots",
    tagline: "Big blasts and armor break",
    description: "A heavy-hitting demolitions expert who punishes clustered enemies with explosive arcs.",
    ultimate: "Skybreaker Barrage",
    accent: "#fb923c",
    stats: {
      power: 430,
      damage: 72,
      attackSpeed: 42,
      critChance: 10,
      critDamage: 150,
      bossDamage: 14,
      luck: 4,
      range: 82
    },
    onboardingStats: {
      power: 86,
      damage: 94,
      attackSpeed: 42,
      range: 84,
      survivability: 62,
      utility: 54,
      difficulty: 66
    },
    strengths: ["High burst damage", "Strong splash pressure", "Armor break tools"],
    weaknesses: ["Slow attack rhythm", "Can overkill small targets"],
    bestFor: "Players who want heavy hits and explosive wave clear",
    starterGearSummary: "Starter launcher, plated vest, ember charm, blast relic",
    tags: ["explosion radius", "burn", "armor break"]
  },
  {
    id: "coral-alchemist",
    name: "Coral Alchemist",
    className: "Debuff Tactician",
    role: "Poison and debuffs",
    attackType: "Poison bolts and defense reduction",
    tagline: "Poison pressure and debuffs",
    description: "A clever apothecary who wins longer fights with poison, weakening mixtures, and steady pressure.",
    ultimate: "Venom Bloom",
    accent: "#34d399",
    stats: {
      power: 395,
      damage: 48,
      attackSpeed: 66,
      critChance: 9,
      critDamage: 125,
      bossDamage: 11,
      luck: 15,
      range: 74
    },
    onboardingStats: {
      power: 79,
      damage: 68,
      attackSpeed: 72,
      range: 74,
      survivability: 56,
      utility: 86,
      difficulty: 72
    },
    strengths: ["Great damage over time", "Weakens tough enemies", "Rewards smart target focus"],
    weaknesses: ["Damage ramps over time", "Less immediate burst"],
    bestFor: "Strategic players who like debuffs and long-fight value",
    starterGearSummary: "Alchemist wand, travel coat, venom charm, coral relic",
    tags: ["poison", "damage over time", "defense reduction"]
  },
  {
    id: "starcaller",
    name: "Starcaller",
    className: "Support Guardian",
    role: "Shields, buffs, and team support",
    attackType: "Starlight bolts and shields",
    tagline: "Shields, buffs, and team safety",
    description: "A celestial guardian who protects allies, stabilizes lanes, and keeps the team alive.",
    ultimate: "Celestial Shield",
    accent: "#facc15",
    stats: {
      power: 410,
      damage: 38,
      attackSpeed: 70,
      critChance: 7,
      critDamage: 120,
      bossDamage: 6,
      luck: 18,
      range: 78
    },
    onboardingStats: {
      power: 82,
      damage: 54,
      attackSpeed: 76,
      range: 80,
      survivability: 74,
      utility: 96,
      difficulty: 50
    },
    strengths: ["Excellent support tools", "Strong defensive value", "Beginner-friendly safety"],
    weaknesses: ["Lower solo damage", "Best value comes with team play"],
    bestFor: "Co-op players who like shields, buffs, and steady support",
    starterGearSummary: "Star focus, ceremonial robe, ward charm, astral relic",
    tags: ["shields", "attack speed buffs", "core protection"]
  }
];

export const heroSynergies = [
  {
    ids: ["tide-mage", "coral-alchemist"],
    name: "Blooming Tide",
    description: "Slowed enemies take increased poison tick value in future full raids."
  },
  {
    ids: ["storm-archer", "starcaller"],
    name: "Starlit Volley",
    description: "Buff windows increase critical strike value for long-range heroes."
  },
  {
    ids: ["bombardier", "tide-mage"],
    name: "Steambreak",
    description: "Explosions gain future bonus armor break against soaked enemies."
  }
] as const;
