import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { raidChapters, raidEnemyAssets, raidRewardAssets } from "@soltower/game-engine";
import {
  heroAssetManifest,
  starlightBanners,
  starlightRarityAssets,
  starlightRewardDefinitions,
  starlightVaultIconAssets,
  uiAssetManifest
} from "@soltower/shared";
import { townAssetManifest } from "./game/config/townAssetManifest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(webRoot, "public");

describe("generated UI and audio assets", () => {
  it("resolves all manifest paths locally without external URLs", () => {
    for (const assetPath of flatten(uiAssetManifest)) {
      expect(assetPath.startsWith("/assets/"), assetPath).toBe(true);
      expect(assetPath.startsWith("http"), assetPath).toBe(false);
      expect(existsSync(join(publicRoot, assetPath)), assetPath).toBe(true);
    }
  });

  it("generates transparent SVG icons and valid WAV audio headers", () => {
    const svgPaths = flatten(uiAssetManifest).filter((assetPath) => assetPath.endsWith(".svg"));
    const wavPaths = flatten(uiAssetManifest).filter((assetPath) => assetPath.endsWith(".wav"));
    expect(svgPaths.length).toBeGreaterThan(20);
    expect(wavPaths.length).toBeGreaterThan(10);

    for (const assetPath of svgPaths) {
      const svg = readFileSync(join(publicRoot, assetPath), "utf8");
      expect(svg).toContain("<svg");
      expect(svg).not.toMatch(/\b(?:href|src)=["']https?:\/\//);
    }

    for (const assetPath of wavPaths) {
      const wav = readFileSync(join(publicRoot, assetPath));
      expect(wav.subarray(0, 4).toString("ascii"), assetPath).toBe("RIFF");
      expect(wav.subarray(8, 12).toString("ascii"), assetPath).toBe("WAVE");
    }
  });

  it("uses the supplied Starlight Vault MP3 as persistent town music", () => {
    const assetPath = uiAssetManifest.audio.music.cozyVillage;
    const mp3 = readFileSync(join(publicRoot, assetPath));
    expect(assetPath).toBe("/assets/soltower/Starlight Vault Walk.mp3");
    expect(mp3.length).toBeGreaterThan(1_000_000);
    expect(["ID3", "\u00ff\u00fb", "\u00ff\u00f3", "\u00ff\u00f2"]).toContain(
      mp3.subarray(0, 3).toString("latin1")
    );
  });
});

describe("generated Hero character assets", () => {
  it("resolves all Hero portrait, sprite, fallback, and layer paths locally", () => {
    for (const entry of Object.values(heroAssetManifest)) {
      const paths = flatten(entry).filter((value) => value.startsWith("/assets/"));
      expect(paths.length, entry.heroId).toBeGreaterThan(20);
      for (const assetPath of paths) {
        expect(assetPath.startsWith("/assets/soltower/heroes/"), assetPath).toBe(true);
        expect(assetPath.startsWith("http"), assetPath).toBe(false);
        expect(existsSync(join(publicRoot, assetPath)), assetPath).toBe(true);
      }
    }
  });

  it("uses transparent PNG hero assets with the documented sprite-sheet layout", () => {
    for (const entry of Object.values(heroAssetManifest)) {
      expect(entry.dimensions.worldSpriteSheet).toEqual({
        width: 256,
        height: 256,
        frameWidth: 64,
        frameHeight: 64
      });
      expect(entry.animationLayout.actions).toEqual(["idle", "walk", "run", "attack"]);
      expect(entry.animationLayout.columns).toEqual(["frame-1", "frame-2", "frame-3", "frame-4"]);
      expect(entry.animationLayout.rows).toEqual(["down", "left", "right", "up"]);
      expect(entry.anchor).toEqual({ x: 0.5, y: 0.88 });

      const pngPaths = [
        entry.previewIconPath,
        entry.portraitPath,
        ...Object.values(entry.worldSpritePaths),
        entry.fallback.previewIconPath,
        ...Object.values(entry.fallback.worldSpritePaths),
        ...flatten(entry.customizationLayerCompatibility)
      ];
      for (const assetPath of pngPaths) {
        const png = readFileSync(join(publicRoot, assetPath));
        expect(png.subarray(0, 8), assetPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        expect(png[25], assetPath).toBe(6);
      }
      for (const assetPath of [...Object.values(entry.worldSpritePaths), ...Object.values(entry.fallback.worldSpritePaths)]) {
        expect(pngDimensions(readFileSync(join(publicRoot, assetPath))), assetPath).toEqual({ width: 256, height: 256 });
      }
    }
  });

  it("exports the Storm Archer 8-direction walking sheet at the Phaser-ready size", () => {
    const assetPath = "/assets/soltower/heroes/storm-archer/walk-8dir.png";
    const png = readFileSync(join(publicRoot, assetPath));
    expect(png.subarray(0, 8), assetPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png[25], assetPath).toBe(6);
    expect(pngDimensions(png), assetPath).toEqual({ width: 256, height: 512 });
  });

  it("exports the Tide Mage 8-direction walking sheet at the Phaser-ready size", () => {
    const assetPath = "/assets/soltower/heroes/tide-mage/walk-8dir.png";
    const png = readFileSync(join(publicRoot, assetPath));
    expect(png.subarray(0, 8), assetPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png[25], assetPath).toBe(6);
    expect(pngDimensions(png), assetPath).toEqual({ width: 256, height: 512 });
  });

  it("exports the Bombardier 8-direction walking sheet at the Phaser-ready size", () => {
    const assetPath = "/assets/soltower/heroes/bombardier/walk-8dir.png";
    const png = readFileSync(join(publicRoot, assetPath));
    expect(png.subarray(0, 8), assetPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png[25], assetPath).toBe(6);
    expect(pngDimensions(png), assetPath).toEqual({ width: 256, height: 512 });
  });

  it("exports the Coral Alchemist 8-direction walking sheet at the Phaser-ready size", () => {
    const assetPath = "/assets/soltower/heroes/coral-alchemist/walk-8dir.png";
    const png = readFileSync(join(publicRoot, assetPath));
    expect(png.subarray(0, 8), assetPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png[25], assetPath).toBe(6);
    expect(pngDimensions(png), assetPath).toEqual({ width: 256, height: 512 });
  });

  it("exports the Storm Archer reference idle sheet at the standard Phaser-ready size", () => {
    const assetPath = "/assets/soltower/heroes/storm-archer/idle.png";
    const png = readFileSync(join(publicRoot, assetPath));
    expect(png.subarray(0, 8), assetPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png[25], assetPath).toBe(6);
    expect(pngDimensions(png), assetPath).toEqual({ width: 256, height: 256 });
  });
});

describe("generated town environment assets", () => {
  const environmentAssets = [
    ["/assets/soltower/environment/ground/town-ground.png", { width: 1254, height: 1254 }],
    ["/assets/soltower/environment/ground/grass-tile.png", { width: 128, height: 128 }],
    ["/assets/soltower/environment/ground/cobble-path-tile.png", { width: 128, height: 64 }],
    ["/assets/soltower/environment/structures/solheart-tower.png", { width: 600, height: 600 }],
    ["/assets/soltower/environment/structures/raid-portal.png", { width: 600, height: 600 }],
    ["/assets/soltower/environment/structures/lanternroot-tavern.png", { width: 600, height: 600 }],
    ["/assets/soltower/environment/structures/emberforge.png", { width: 232, height: 196 }],
    ["/assets/soltower/environment/structures/starlight-vault.png", { width: 600, height: 600 }],
    ["/assets/soltower/environment/props/market-stall.png", { width: 600, height: 600 }],
    ["/assets/soltower/environment/props/fountain.png", { width: 600, height: 600 }],
    ["/assets/soltower/environment/props/lamp-post.png", { width: 600, height: 600 }],
    ["/assets/soltower/environment/props/dock.png", { width: 600, height: 600 }],
    ["/assets/soltower/environment/props/boat.png", { width: 600, height: 600 }]
  ] as const;

  it("exports local PNG environment assets at their documented game-ready sizes", () => {
    for (const [assetPath, dimensions] of environmentAssets) {
      const png = readFileSync(join(publicRoot, assetPath));
      expect(png.subarray(0, 8), assetPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect([2, 6], assetPath).toContain(png[25]);
      expect(pngDimensions(png), assetPath).toEqual(dimensions);
    }
  });

  it("uses the town runtime manifest for balanced world display sizes", () => {
    expect(townAssetManifest.moonpetalMarket.renderWidth).toBe(232);
    expect(townAssetManifest.lanternrootTavern.renderWidth).toBe(242);
    expect(townAssetManifest.marketStall.renderWidth).toBe(144);
    expect(townAssetManifest.fountain.renderWidth).toBe(126);
    expect(townAssetManifest.moonpetalMarket.renderWidth).toBeLessThan(600);
    expect(townAssetManifest.marketStall.renderWidth).toBeLessThan(600);
  });
});

describe("generated Raid Board assets", () => {
  const mapOne = raidChapters[0];
  const stageImageStages = raidChapters
    .flatMap((chapter) => chapter.stages)
    .filter((stage) => stage.thumbnailPath.startsWith("/assets/raids/stages/"));

  it("resolves all Raid Board asset paths locally without external URLs", () => {
    const raidAssetPaths = [
      ...raidChapters.map((chapter) => chapter.bannerPath),
      ...stageImageStages.map((stage) => stage.thumbnailPath),
      ...Object.values(raidEnemyAssets).map((asset) => asset.assetPath),
      ...Object.values(raidRewardAssets).map((asset) => asset.assetPath)
    ];

    expect(mapOne.stages).toHaveLength(10);
    expect(stageImageStages).toHaveLength(20);
    for (const assetPath of raidAssetPaths) {
      expect(assetPath.startsWith("/assets/raids/"), assetPath).toBe(true);
      expect(assetPath.startsWith("http"), assetPath).toBe(false);
      expect(existsSync(join(publicRoot, assetPath)), assetPath).toBe(true);
    }
    expect(existsSync(join(publicRoot, "/assets/raids/source/README.md"))).toBe(true);
  });

  it("exports Raid Board PNG assets at their documented UI sizes", () => {
    for (const chapter of raidChapters) {
      const png = readFileSync(join(publicRoot, chapter.bannerPath));
      expect(png.subarray(0, 8), chapter.bannerPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect([2, 6], chapter.bannerPath).toContain(png[25]);
      expect(pngDimensions(png), chapter.bannerPath).toEqual(
        chapter.id === "map-1-solheart-outskirts"
          ? { width: 960, height: 320 }
          : chapter.mapNumber === 2
            ? { width: 1707, height: 921 }
            : { width: 640, height: 220 }
      );
    }

    for (const stage of stageImageStages) {
      const png = readFileSync(join(publicRoot, stage.thumbnailPath));
      expect(png.subarray(0, 8), stage.thumbnailPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect([2, 6], stage.thumbnailPath).toContain(png[25]);
      expect(stage.thumbnailPath).toMatch(/\/assets\/raids\/stages\/stage-[12]-\d+-/);
      const dimensions = pngDimensions(png);
      expect(dimensions.width, stage.thumbnailPath).toBeGreaterThanOrEqual(640);
      expect(dimensions.height, stage.thumbnailPath).toBeGreaterThanOrEqual(320);
    }

    for (const asset of Object.values(raidEnemyAssets)) {
      const png = readFileSync(join(publicRoot, asset.assetPath));
      expect(png.subarray(0, 8), asset.assetPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png[25], asset.assetPath).toBe(6);
      const dimensions = pngDimensions(png);
      expect(dimensions.width, asset.assetPath).toBeGreaterThanOrEqual(96);
      expect(dimensions.height, asset.assetPath).toBeGreaterThanOrEqual(96);
      expect(dimensions.width, asset.assetPath).toBe(dimensions.height);
    }

    for (const asset of Object.values(raidRewardAssets)) {
      const png = readFileSync(join(publicRoot, asset.assetPath));
      expect(png.subarray(0, 8), asset.assetPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png[25], asset.assetPath).toBe(6);
      expect(pngDimensions(png), asset.assetPath).toEqual({ width: 64, height: 64 });
    }
  });

  it("removes the old horizontal wave strip from the Raid Board implementation", () => {
    const raidPanel = readFileSync(join(webRoot, "src/components/panels/RaidPanel.tsx"), "utf8");
    const styles = readFileSync(join(webRoot, "src/styles/main.css"), "utf8");
    expect(raidPanel).not.toContain("wave-strip");
    expect(styles).not.toContain(".wave-strip");
    expect(styles).toContain(".raid-stage-grid");
    expect(styles).toContain("overflow: hidden;");
  });
});

describe("generated Starlight Vault assets", () => {
  it("resolves every Starlight Vault registry asset locally", () => {
    const vaultAssetPaths = [
      ...starlightBanners.map((banner) => banner.imagePath),
      ...starlightRewardDefinitions.flatMap((reward) => [reward.assetPath, reward.framePath]),
      ...Object.values(starlightRarityAssets),
      ...Object.values(starlightVaultIconAssets)
    ];

    expect(starlightBanners).toHaveLength(5);
    expect(starlightRewardDefinitions).toHaveLength(24);
    for (const assetPath of vaultAssetPaths) {
      expect(assetPath.startsWith("/assets/vault/"), assetPath).toBe(true);
      expect(assetPath.startsWith("http"), assetPath).toBe(false);
      expect(existsSync(join(publicRoot, assetPath)), assetPath).toBe(true);
    }
    expect(existsSync(join(publicRoot, "/assets/vault/source/README.md"))).toBe(true);
  });

  it("exports Starlight Vault PNG assets at their documented UI sizes", () => {
    for (const banner of starlightBanners) {
      const png = readFileSync(join(publicRoot, banner.imagePath));
      expect(png.subarray(0, 8), banner.imagePath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png[25], banner.imagePath).toBe(6);
      expect(pngDimensions(png), banner.imagePath).toEqual({ width: 960, height: 320 });
    }

    for (const reward of starlightRewardDefinitions) {
      const png = readFileSync(join(publicRoot, reward.assetPath));
      expect(png.subarray(0, 8), reward.assetPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png[25], reward.assetPath).toBe(6);
      expect(pngDimensions(png), reward.assetPath).toEqual({ width: 160, height: 160 });
    }

    for (const framePath of Object.values(starlightRarityAssets)) {
      const png = readFileSync(join(publicRoot, framePath));
      expect(png.subarray(0, 8), framePath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png[25], framePath).toBe(6);
      expect(pngDimensions(png), framePath).toEqual({ width: 160, height: 160 });
    }

    for (const iconPath of Object.values(starlightVaultIconAssets)) {
      const png = readFileSync(join(publicRoot, iconPath));
      expect(png.subarray(0, 8), iconPath).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png[25], iconPath).toBe(6);
      expect(pngDimensions(png), iconPath).toEqual({ width: 64, height: 64 });
    }
  });
});

function flatten(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  return Object.values(value).flatMap(flatten);
}

function pngDimensions(png: Buffer): { width: number; height: number } {
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20)
  };
}
