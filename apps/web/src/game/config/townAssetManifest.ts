import type { ModalKey } from "../../store/ui";

export type TownAssetKey =
  | "townGround"
  | "solheartTower"
  | "raidPortal"
  | "moonpetalMarket"
  | "lanternrootTavern"
  | "emberforge"
  | "questGrove"
  | "blacksmith"
  | "starlightVault"
  | "blackjackTable"
  | "marketStall"
  | "questBoard"
  | "bushFlower"
  | "rockCluster"
  | "lampPost"
  | "bench"
  | "barrelCrates"
  | "fenceRail"
  | "signpost"
  | "fountain"
  | "dock"
  | "boat"
  | "campfire";

export interface TownRect {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export interface TownPoint {
  offsetX: number;
  offsetY: number;
}

export interface TownAssetDefinition {
  path: string;
  renderWidth: number;
  renderHeight: number;
  originX: number;
  originY: number;
  collidable: boolean;
  collisionBody?: TownRect;
  depthOffset?: number;
  assetStatus?: "pending_manual_art" | "partial" | "ready" | "disabled";
  enabledForPlayerUse?: boolean;
}

export interface TownWorldObject {
  id: string;
  assetKey: TownAssetKey;
  x: number;
  y: number;
  visible?: boolean;
  flipX?: boolean;
  scale?: number;
  renderWidth?: number;
  renderHeight?: number;
  originX?: number;
  originY?: number;
  depth?: number;
  depthOffset?: number;
  collidable: boolean;
  interactable: boolean;
  debugVisible: boolean;
  assetStatus?: "pending_manual_art" | "partial" | "ready" | "disabled";
  enabledForPlayerUse?: boolean;
  collisionBody?: TownRect;
  interactionAnchor?: TownPoint;
  interactionRange?: number;
  interactionLabel?: string;
  interactionAction?: ModalKey;
  interactionKind?: "npc" | "landmark" | "prop";
  displayLabel?: string;
  labelAnchor?: TownPoint;
}

export interface TownTerrainCollisionZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const townAssetManifest: Record<TownAssetKey, TownAssetDefinition> = {
  townGround: {
    path: "/assets/soltower/environment/ground/town-ground.png",
    renderWidth: 1254,
    renderHeight: 1254,
    originX: 0.5,
    originY: 0.5,
    collidable: false
  },
  solheartTower: {
    path: "/assets/soltower/environment/structures/solheart-tower.png",
    renderWidth: 188,
    renderHeight: 270,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -52, offsetY: -76, width: 104, height: 74 }
  },
  raidPortal: {
    path: "/assets/soltower/environment/structures/raid-portal.png",
    renderWidth: 112,
    renderHeight: 112,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -42, offsetY: -36, width: 84, height: 31 }
  },
  moonpetalMarket: {
    path: "/assets/soltower/environment/structures/moonpetal-market.png",
    renderWidth: 232,
    renderHeight: 197,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -72, offsetY: -58, width: 144, height: 56 }
  },
  lanternrootTavern: {
    path: "/assets/soltower/environment/structures/lanternroot-tavern.png",
    renderWidth: 242,
    renderHeight: 203,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -74, offsetY: -60, width: 148, height: 58 }
  },
  emberforge: {
    path: "/assets/soltower/environment/structures/emberforge.png",
    renderWidth: 270,
    renderHeight: 228,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -94, offsetY: -74, width: 188, height: 72 }
  },
  questGrove: {
    path: "/assets/soltower/environment/structures/quest-grove.png",
    renderWidth: 270,
    renderHeight: 227,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -94, offsetY: -73, width: 188, height: 70 }
  },
  blacksmith: {
    path: "/assets/soltower/environment/structures/blacksmith.png",
    renderWidth: 336,
    renderHeight: 300,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -116, offsetY: -92, width: 232, height: 86 }
  },
  starlightVault: {
    path: "/assets/soltower/environment/structures/starlight-vault.png",
    renderWidth: 300,
    renderHeight: 300,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -104, offsetY: -78, width: 208, height: 72 },
    assetStatus: "ready",
    enabledForPlayerUse: true
  },
  blackjackTable: {
    path: "/assets/soltower/environment/structures/blackjack.png",
    renderWidth: 220,
    renderHeight: 220,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -82, offsetY: -38, width: 164, height: 34 },
    assetStatus: "ready",
    enabledForPlayerUse: true
  },
  marketStall: {
    path: "/assets/soltower/environment/props/market-stall.png",
    renderWidth: 144,
    renderHeight: 120,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -48, offsetY: -34, width: 96, height: 30 }
  },
  questBoard: {
    path: "/assets/soltower/environment/props/quest-board.png",
    renderWidth: 88,
    renderHeight: 73,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -28, offsetY: -21, width: 56, height: 18 }
  },
  bushFlower: {
    path: "/assets/soltower/environment/props/bush-flower.png",
    renderWidth: 58,
    renderHeight: 48,
    originX: 0.5,
    originY: 1,
    collidable: false
  },
  rockCluster: {
    path: "/assets/soltower/environment/props/rock-cluster.png",
    renderWidth: 58,
    renderHeight: 48,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -20, offsetY: -18, width: 40, height: 16 }
  },
  lampPost: {
    path: "/assets/soltower/environment/props/lamp-post.png",
    renderWidth: 42,
    renderHeight: 76,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -9, offsetY: -17, width: 18, height: 15 }
  },
  bench: {
    path: "/assets/soltower/environment/props/bench.png",
    renderWidth: 84,
    renderHeight: 44,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -32, offsetY: -22, width: 64, height: 19 }
  },
  barrelCrates: {
    path: "/assets/soltower/environment/props/barrel-crates.png",
    renderWidth: 64,
    renderHeight: 52,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -25, offsetY: -27, width: 50, height: 23 }
  },
  fenceRail: {
    path: "/assets/soltower/environment/props/fence-rail.png",
    renderWidth: 92,
    renderHeight: 46,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -39, offsetY: -22, width: 78, height: 14 }
  },
  signpost: {
    path: "/assets/soltower/environment/props/signpost.png",
    renderWidth: 60,
    renderHeight: 56,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -14, offsetY: -19, width: 28, height: 16 }
  },
  fountain: {
    path: "/assets/soltower/environment/props/fountain.png",
    renderWidth: 126,
    renderHeight: 94,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -50, offsetY: -34, width: 100, height: 26 }
  },
  dock: {
    path: "/assets/soltower/environment/props/dock.png",
    renderWidth: 172,
    renderHeight: 96,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -72, offsetY: -46, width: 144, height: 31 }
  },
  boat: {
    path: "/assets/soltower/environment/props/boat.png",
    renderWidth: 150,
    renderHeight: 84,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -58, offsetY: -33, width: 116, height: 26 }
  },
  campfire: {
    path: "/assets/soltower/environment/props/campfire.png",
    renderWidth: 60,
    renderHeight: 52,
    originX: 0.5,
    originY: 1,
    collidable: true,
    collisionBody: { offsetX: -21, offsetY: -18, width: 42, height: 15 }
  }
};

export const townWorldObjects: TownWorldObject[] = [
  {
    id: "solheart-tower",
    assetKey: "solheartTower",
    x: 620,
    y: 365,
    scale: 1.15,
    collidable: true,
    interactable: true,
    debugVisible: false,
    interactionAnchor: { offsetX: 0, offsetY: -28 },
    interactionRange: 72,
    interactionLabel: "Enter Raid Board",
    interactionAction: "raid-captain",
    interactionKind: "landmark"
  },
  {
    id: "raid-gate",
    assetKey: "raidPortal",
    x: 925,
    y: 270,
    scale: 1.08,
    collidable: true,
    interactable: true,
    debugVisible: false,
    interactionAnchor: { offsetX: 0, offsetY: -18 },
    interactionRange: 76,
    interactionLabel: "Enter Raid Board",
    interactionAction: "raid-captain",
    interactionKind: "landmark"
  },
  {
    id: "moonpetal-market",
    assetKey: "moonpetalMarket",
    x: 220,
    y: 480,
    scale: 1.2,
    collidable: true,
    interactable: true,
    debugVisible: false,
    interactionAnchor: { offsetX: 0, offsetY: -26 },
    interactionRange: 58,
    interactionLabel: "Open Auction House",
    interactionAction: "market-broker",
    interactionKind: "landmark"
  },
  {
    id: "lanternroot-tavern",
    assetKey: "lanternrootTavern",
    x: 1025,
    y: 485,
    scale: 1.2,
    collidable: true,
    interactable: true,
    debugVisible: false,
    interactionAnchor: { offsetX: 0, offsetY: -27 },
    interactionRange: 58,
    interactionLabel: "Enter Tavern",
    interactionAction: "tavern",
    interactionKind: "landmark"
  },
  {
    id: "starlight-vault",
    assetKey: "starlightVault",
    x: 1000,
    y: 955,
    scale: 1.18,
    collidable: true,
    interactable: true,
    debugVisible: false,
    assetStatus: "ready",
    enabledForPlayerUse: true,
    interactionAnchor: { offsetX: 0, offsetY: -74 },
    interactionRange: 112,
    interactionLabel: "Enter Starlight Vault",
    interactionAction: "open_starlight_vault",
    interactionKind: "landmark",
    displayLabel: "Starlight Vault",
    labelAnchor: { offsetX: 0, offsetY: -315 }
  },
  {
    id: "gold-market-board-left",
    assetKey: "marketStall",
    x: 115,
    y: 620,
    scale: 1.15,
    collidable: true,
    interactable: true,
    debugVisible: false,
    interactionAnchor: { offsetX: 0, offsetY: -48 },
    interactionRange: 74,
    interactionLabel: "Open Gold Exchange",
    interactionAction: "market-broker",
    interactionKind: "landmark",
    displayLabel: "Gold Exchange",
    labelAnchor: { offsetX: 0, offsetY: -120 }
  },
  {
    id: "quest-board-east",
    assetKey: "questBoard",
    x: 1145,
    y: 635,
    scale: 1.2,
    collidable: true,
    interactable: true,
    debugVisible: false,
    interactionAnchor: { offsetX: 0, offsetY: -30 },
    interactionRange: 58,
    interactionLabel: "View Quests",
    interactionAction: "quest-board",
    interactionKind: "prop"
  },
  {
    id: "blackjack-table",
    assetKey: "blackjackTable",
    x: 627,
    y: 985,
    collidable: true,
    interactable: true,
    debugVisible: false,
    interactionAnchor: { offsetX: 0, offsetY: -58 },
    interactionRange: 78,
    interactionLabel: "Play Blackjack",
    interactionAction: "blackjack",
    interactionKind: "landmark",
    displayLabel: "Lady Vesper's Blackjack",
    labelAnchor: { offsetX: 0, offsetY: -188 }
  },
  {
    id: "fountain",
    assetKey: "fountain",
    x: 627,
    y: 675,
    scale: 1.35,
    collidable: true,
    interactable: false,
    debugVisible: false
  },
  {
    id: "blacksmith-exterior",
    assetKey: "blacksmith",
    x: 245,
    y: 955,
    collidable: true,
    interactable: true,
    debugVisible: false,
    interactionAnchor: { offsetX: 0, offsetY: -78 },
    interactionRange: 158,
    interactionLabel: "Visit Emberforge",
    interactionAction: "blacksmith",
    interactionKind: "landmark"
  },
  { id: "dock", assetKey: "dock", x: 602, y: 1110, collidable: true, interactable: false, debugVisible: false },
  { id: "boat", assetKey: "boat", x: 748, y: 1170, collidable: true, interactable: false, debugVisible: false },
  { id: "campfire", assetKey: "campfire", x: 805, y: 930, collidable: true, interactable: false, debugVisible: false },
  { id: "bench-west", assetKey: "bench", x: 470, y: 715, flipX: true, collidable: true, interactable: false, debugVisible: false },
  { id: "bench-east", assetKey: "bench", x: 784, y: 715, flipX: false, collidable: true, interactable: false, debugVisible: false },
  { id: "market-supplies", assetKey: "barrelCrates", x: 345, y: 455, collidable: true, interactable: false, debugVisible: false },
  { id: "forge-supplies", assetKey: "barrelCrates", x: 390, y: 925, collidable: true, interactable: false, debugVisible: false },
  { id: "vault-signpost", assetKey: "signpost", x: 825, y: 825, collidable: true, interactable: false, debugVisible: false }
];

export const townLampObjects: TownWorldObject[] = [];

export const townTerrainCollisionZones: TownTerrainCollisionZone[] = [
  { id: "north-forest-cliff", x: 0, y: 0, width: 1015, height: 112 },
  { id: "northwest-high-cliff", x: 60, y: 105, width: 380, height: 115 },
  { id: "northeast-high-cliff", x: 800, y: 105, width: 215, height: 110 },
  { id: "northwest-forest", x: 0, y: 92, width: 66, height: 930 },
  { id: "northeast-waterfall", x: 1010, y: 0, width: 190, height: 194 },
  { id: "northeast-forest", x: 1190, y: 0, width: 64, height: 1055 },
  { id: "southwest-cliff", x: 0, y: 1015, width: 315, height: 239 },
  { id: "south-water", x: 300, y: 1070, width: 670, height: 184 },
  { id: "south-water-left-shore", x: 305, y: 1016, width: 190, height: 92 },
  { id: "south-water-right-shore", x: 710, y: 1016, width: 250, height: 92 },
  { id: "dock-left-water-pocket", x: 392, y: 1032, width: 112, height: 92 },
  { id: "southeast-cliff", x: 955, y: 1020, width: 299, height: 234 },

  { id: "north-platform-west-wall", x: 420, y: 170, width: 36, height: 226 },
  { id: "north-platform-east-wall", x: 775, y: 165, width: 36, height: 230 },
  { id: "north-platform-southwest-wall", x: 438, y: 365, width: 164, height: 32 },
  { id: "north-platform-southeast-wall", x: 655, y: 365, width: 145, height: 32 },
  { id: "central-raised-dais", x: 520, y: 570, width: 214, height: 126 },

  { id: "west-upper-trees", x: 0, y: 110, width: 105, height: 205 },
  { id: "west-middle-trees", x: 0, y: 430, width: 88, height: 180 },
  { id: "west-lower-trees", x: 0, y: 850, width: 95, height: 180 },
  { id: "east-upper-trees", x: 1148, y: 210, width: 106, height: 205 },
  { id: "east-middle-trees", x: 1165, y: 480, width: 89, height: 190 },
  { id: "east-lower-trees", x: 1152, y: 820, width: 102, height: 210 }
];
