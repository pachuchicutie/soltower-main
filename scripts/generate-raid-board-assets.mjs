import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(repoRoot, "apps/web/public/assets/raids");

const colors = {
  transparent: [0, 0, 0, 0],
  outline: [10, 12, 18, 255],
  shadow: [16, 21, 24, 160],
  grass0: [17, 55, 35, 255],
  grass1: [25, 77, 45, 255],
  grass2: [44, 110, 56, 255],
  moss: [77, 132, 63, 255],
  path0: [96, 92, 72, 255],
  path1: [133, 129, 99, 255],
  path2: [172, 165, 124, 255],
  stone0: [72, 77, 72, 255],
  stone1: [114, 118, 108, 255],
  stone2: [164, 160, 139, 255],
  wood0: [67, 39, 25, 255],
  wood1: [121, 73, 37, 255],
  wood2: [174, 112, 49, 255],
  gold0: [121, 83, 28, 255],
  gold1: [246, 196, 83, 255],
  gold2: [255, 230, 138, 255],
  ember0: [119, 37, 25, 255],
  ember1: [231, 88, 37, 255],
  ember2: [255, 198, 76, 255],
  blue0: [28, 85, 138, 255],
  blue1: [60, 179, 227, 255],
  blue2: [166, 246, 255, 255],
  purple0: [54, 28, 97, 255],
  purple1: [137, 73, 220, 255],
  purple2: [219, 186, 255, 255],
  red0: [98, 31, 30, 255],
  red1: [180, 55, 42, 255],
  white: [236, 239, 230, 255]
};

const stageAssets = [
  ["stage-1-1-sproutling-path.png", "sproutling"],
  ["stage-1-2-cinder-crossing.png", "cinder"],
  ["stage-1-3-briar-hollow.png", "briar"],
  ["stage-1-4-glass-beetle-grotto.png", "glass"],
  ["stage-1-5-mistwood-watch.png", "mist"],
  ["stage-1-6-ashhound-trail.png", "ash"],
  ["stage-1-7-rune-grove.png", "rune"],
  ["stage-1-8-shardfall-rise.png", "shard"],
  ["stage-1-9-stormgate-approach.png", "storm"],
  ["stage-1-10-solheart-sentinel.png", "boss"]
];

function main() {
  mkdirSync(join(outRoot, "chapters"), { recursive: true });
  mkdirSync(join(outRoot, "stages"), { recursive: true });
  mkdirSync(join(outRoot, "enemies"), { recursive: true });
  mkdirSync(join(outRoot, "rewards"), { recursive: true });
  mkdirSync(join(outRoot, "source"), { recursive: true });

  writePng(join(outRoot, "chapters/solheart-outskirts-banner.png"), drawChapterBanner());
  for (const [filename, variant] of stageAssets) {
    writePng(join(outRoot, "stages", filename), drawStagePreview(variant));
  }

  writePng(join(outRoot, "enemies/sproutling.png"), drawSproutling());
  writePng(join(outRoot, "enemies/ember-mite.png"), drawEmberMite());
  writePng(join(outRoot, "enemies/briar-crawler.png"), drawBriarCrawler());
  writePng(join(outRoot, "enemies/glass-beetle.png"), drawGlassBeetle());
  writePng(join(outRoot, "enemies/mist-wisp.png"), drawMistWisp());
  writePng(join(outRoot, "enemies/ash-hound.png"), drawAshHound());
  writePng(join(outRoot, "enemies/rune-warden.png"), drawRuneWarden());
  writePng(join(outRoot, "enemies/shard-golem.png"), drawShardGolem());
  writePng(join(outRoot, "enemies/storm-sentinel.png"), drawStormSentinel());
  writePng(join(outRoot, "enemies/solheart-sentinel.png"), drawSolheartSentinel());

  writePng(join(outRoot, "rewards/earned-gold.png"), drawGoldReward());
  writePng(join(outRoot, "rewards/xp-crystal.png"), drawXpCrystal());
  writePng(join(outRoot, "rewards/moss-thread.png"), drawMossThread());
  writePng(join(outRoot, "rewards/tower-shard.png"), drawTowerShard());
  writePng(join(outRoot, "rewards/ember-core.png"), drawEmberCore());
  writePng(join(outRoot, "rewards/tidal-pearl.png"), drawTidalPearl());
  writePng(join(outRoot, "rewards/starlit-dust.png"), drawStarlitDust());
  writePng(join(outRoot, "rewards/chest-reward.png"), drawChest("common"));
  writePng(join(outRoot, "rewards/rare-chest-reward.png"), drawChest("rare"));
  writePng(join(outRoot, "rewards/boss-chest-reward.png"), drawChest("boss"));

  writeFileSync(
    join(outRoot, "source/README.md"),
    [
      "# SolTower Raid Board Assets",
      "",
      "These PNGs are original local SolTower raid UI assets generated for Map 1: Solheart Outskirts.",
      "",
      "- Chapter banner: 960x320 RGBA PNG.",
      "- Stage previews: 640x360 RGBA PNGs.",
      "- Enemy portraits: 96x96 RGBA PNGs, except Solheart Sentinel at 160x160.",
      "- Reward icons: 64x64 RGBA PNGs.",
      "",
      "The art is deterministic pixel art with hard edges and local repository paths only. Do not replace these with external URLs or CSS placeholders."
    ].join("\n")
  );
}

function drawChapterBanner() {
  const c = new Canvas(960, 320, colors.grass0);
  drawGrassNoise(c, 0, 0, 960, 320, 137);
  drawPath(c, [
    [0, 226],
    [155, 198],
    [302, 170],
    [486, 186],
    [660, 151],
    [960, 178]
  ], 72);
  drawPath(c, [
    [430, 320],
    [461, 250],
    [487, 182],
    [515, 105]
  ], 54);
  drawForestBand(c, 0, 18, 240, 98);
  drawForestBand(c, 705, 15, 245, 102);
  drawTower(c, 432, 62, 96, 170, 1.2);
  drawBlueCrystal(c, 481, 31, 38, 76);
  drawPortal(c, 250, 156, "blue");
  drawPortal(c, 652, 141, "purple");
  drawLamp(c, 363, 181, 1.15);
  drawLamp(c, 594, 164, 1.15);
  drawSmallHouse(c, 780, 176, 112, 88, "market");
  drawMarketStall(c, 80, 176, 126, 78);
  drawFlowers(c, 714, 222, 14);
  drawFlowers(c, 205, 250, 12);
  drawVignette(c);
  return c;
}

function drawStagePreview(variant) {
  const c = new Canvas(640, 360, variant === "cinder" || variant === "ash" ? [30, 42, 35, 255] : colors.grass0);
  drawGrassNoise(c, 0, 0, 640, 360, variant.length * 43 + 19);
  const pathShape = variant === "boss"
    ? [[0, 238], [150, 205], [305, 208], [452, 176], [640, 190]]
    : variant === "storm"
      ? [[0, 246], [140, 220], [260, 182], [398, 191], [640, 158]]
      : [[0, 222], [132, 194], [278, 208], [412, 176], [640, 197]];
  drawPath(c, pathShape, variant === "boss" ? 78 : 66);
  drawStageFoliage(c, variant);
  if (variant === "sproutling") {
    drawPond(c, 170, 242, 78, 38);
    drawBushCluster(c, 460, 99, 78);
    drawSmallCrystal(c, 520, 80, "blue");
  } else if (variant === "cinder") {
    drawWoodBridge(c, 250, 205);
    drawFire(c, 430, 152, 1.1);
    drawCracks(c);
  } else if (variant === "briar") {
    drawThorns(c, 245, 204);
    drawFallenLog(c, 400, 198);
  } else if (variant === "glass") {
    drawCrystalPatch(c, 425, 140, "blue");
    drawPond(c, 245, 222, 58, 28);
    drawRocks(c, 120, 232);
  } else if (variant === "mist") {
    drawMist(c, 80, 90, 450, 145);
    drawPortal(c, 464, 162, "white");
    drawRuin(c, 460, 156);
  } else if (variant === "ash") {
    drawCharredTrees(c);
    drawFire(c, 152, 220, 0.8);
    drawRocks(c, 410, 238);
  } else if (variant === "rune") {
    drawRuneStones(c, 316, 180);
    drawCrystalPatch(c, 495, 110, "purple");
  } else if (variant === "shard") {
    drawCrystalPatch(c, 260, 138, "blue");
    drawCrystalPatch(c, 500, 110, "purple");
    drawRocks(c, 382, 228);
  } else if (variant === "storm") {
    drawGate(c, 416, 128);
    drawBlueCrystal(c, 240, 108, 30, 64);
    drawLightning(c, 510, 45);
  } else if (variant === "boss") {
    drawTower(c, 278, 90, 118, 178, 1.05);
    drawBlueCrystal(c, 328, 44, 36, 78);
    drawPortal(c, 508, 178, "purple");
    drawLamp(c, 222, 220, 1);
    drawLamp(c, 448, 205, 1);
  }
  drawVignette(c);
  return c;
}

function drawGrassNoise(c, x, y, w, h, seed) {
  const rng = mulberry32(seed);
  for (let yy = y; yy < y + h; yy += 4) {
    for (let xx = x; xx < x + w; xx += 4) {
      const r = rng();
      const col = r > 0.84 ? colors.grass2 : r > 0.58 ? colors.grass1 : colors.grass0;
      c.rect(xx, yy, 4, 4, col);
    }
  }
  for (let i = 0; i < 450; i += 1) {
    const px = x + Math.floor(rng() * w);
    const py = y + Math.floor(rng() * h);
    const col = rng() > 0.82 ? [209, 168, 115, 255] : rng() > 0.64 ? [95, 149, 75, 255] : [104, 77, 139, 255];
    c.rect(px, py, 3, 3, col);
  }
}

function drawPath(c, points, width) {
  for (let i = 0; i < points.length - 1; i += 1) {
    c.thickLine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], width + 16, [60, 62, 52, 255]);
    c.thickLine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], width, colors.path0);
  }
  const rng = mulberry32(points.length * width + points[0][1]);
  for (let i = 0; i < 110; i += 1) {
    const [sx, sy] = points[Math.floor(rng() * points.length)];
    const px = Math.max(0, Math.min(c.width - 18, sx + Math.floor((rng() - 0.5) * 180)));
    const py = Math.max(0, Math.min(c.height - 12, sy + Math.floor((rng() - 0.5) * 84)));
    const stone = rng() > 0.55 ? colors.path1 : colors.stone1;
    c.rect(px, py, 20 + Math.floor(rng() * 22), 8 + Math.floor(rng() * 14), stone);
    c.rect(px + 2, py + 2, 5, 3, colors.path2);
  }
}

function drawForestBand(c, x, y, w) {
  for (let i = 0; i < w; i += 38) {
    drawTree(c, x + i + (i % 3) * 8, y + 18 + (i % 4) * 4, 1.05);
  }
  for (let i = 18; i < w; i += 46) {
    drawTree(c, x + i, y + 42 + (i % 5) * 5, 0.92);
  }
}

function drawStageFoliage(c, variant) {
  const dense = variant === "sproutling" || variant === "briar" || variant === "mist";
  const count = dense ? 10 : 6;
  for (let i = 0; i < count; i += 1) {
    const x = 50 + ((i * 91 + variant.length * 21) % 540);
    const y = 32 + ((i * 47 + variant.length * 19) % 285);
    if (i % 2 === 0) drawTree(c, x, y, 0.86 + (i % 3) * 0.1);
    else drawBushCluster(c, x, y + 28, 48 + (i % 3) * 12);
  }
}

function drawTree(c, x, y, s) {
  const trunkW = Math.round(12 * s);
  c.rect(x + Math.round(20 * s), y + Math.round(44 * s), trunkW, Math.round(32 * s), colors.wood1);
  c.rect(x + Math.round(22 * s), y + Math.round(48 * s), Math.round(4 * s), Math.round(26 * s), colors.wood2);
  c.circle(x + Math.round(26 * s), y + Math.round(28 * s), Math.round(28 * s), [34, 93, 48, 255]);
  c.circle(x + Math.round(8 * s), y + Math.round(34 * s), Math.round(21 * s), [45, 118, 58, 255]);
  c.circle(x + Math.round(42 * s), y + Math.round(36 * s), Math.round(23 * s), [50, 126, 60, 255]);
  c.circle(x + Math.round(25 * s), y + Math.round(18 * s), Math.round(21 * s), [64, 140, 63, 255]);
  c.rect(x + Math.round(8 * s), y + Math.round(14 * s), Math.round(11 * s), Math.round(7 * s), [106, 162, 76, 255]);
}

function drawBushCluster(c, x, y, size) {
  c.circle(x, y, Math.round(size * 0.28), [40, 105, 54, 255]);
  c.circle(x + Math.round(size * 0.25), y + 4, Math.round(size * 0.24), [64, 133, 62, 255]);
  c.circle(x - Math.round(size * 0.26), y + 8, Math.round(size * 0.22), [50, 119, 58, 255]);
  c.rect(x - 10, y - 7, 8, 5, [110, 169, 76, 255]);
}

function drawTower(c, x, y, w, h, s) {
  const wall = [116, 111, 94, 255];
  c.rect(x + 14 * s, y + 20 * s, w - 28 * s, h - 20 * s, colors.outline);
  c.rect(x + 20 * s, y + 24 * s, w - 40 * s, h - 28 * s, wall);
  for (let yy = y + 34 * s; yy < y + h - 24 * s; yy += 18 * s) {
    for (let xx = x + 24 * s; xx < x + w - 34 * s; xx += 26 * s) {
      c.rect(xx, yy, 20 * s, 8 * s, ((xx + yy) / s) % 3 > 1 ? colors.stone2 : colors.stone0);
    }
  }
  c.rect(x + 38 * s, y + h - 62 * s, 30 * s, 56 * s, colors.wood0);
  c.rect(x + 44 * s, y + h - 54 * s, 18 * s, 42 * s, colors.wood1);
  c.rect(x + 15 * s, y + 8 * s, 20 * s, 24 * s, colors.stone1);
  c.rect(x + w - 35 * s, y + 8 * s, 20 * s, 24 * s, colors.stone1);
  c.rect(x + 41 * s, y + 76 * s, 8 * s, 36 * s, colors.blue1);
  c.rect(x + 56 * s, y + 76 * s, 8 * s, 36 * s, colors.blue1);
}

function drawBlueCrystal(c, x, y, w, h) {
  c.poly([[x + w / 2, y], [x + w, y + h * 0.38], [x + w * 0.68, y + h], [x + w * 0.32, y + h], [x, y + h * 0.38]], colors.blue0);
  c.poly([[x + w / 2, y + 6], [x + w * 0.82, y + h * 0.38], [x + w * 0.56, y + h - 6], [x + w * 0.48, y + h * 0.35]], colors.blue1);
  c.poly([[x + w * 0.2, y + h * 0.4], [x + w * 0.48, y + 8], [x + w * 0.42, y + h - 8]], colors.blue2);
}

function drawPortal(c, x, y, tone) {
  const p0 = tone === "blue" ? colors.blue0 : tone === "white" ? [180, 218, 223, 255] : colors.purple0;
  const p1 = tone === "blue" ? colors.blue1 : tone === "white" ? [217, 245, 250, 255] : colors.purple1;
  const p2 = tone === "blue" ? colors.blue2 : tone === "white" ? [255, 255, 255, 255] : colors.purple2;
  c.rect(x - 32, y - 12, 64, 78, colors.outline);
  c.rect(x - 24, y - 4, 48, 64, colors.stone1);
  c.circle(x, y + 29, 28, p0);
  c.circle(x, y + 29, 20, p1);
  c.circle(x, y + 29, 8, p2);
  c.rect(x - 42, y + 62, 84, 12, colors.stone0);
}

function drawLamp(c, x, y, s) {
  c.rect(x - 4 * s, y, 8 * s, 64 * s, colors.wood1);
  c.rect(x - 8 * s, y + 58 * s, 16 * s, 8 * s, colors.wood0);
  c.rect(x - 10 * s, y - 18 * s, 20 * s, 24 * s, colors.outline);
  c.rect(x - 6 * s, y - 13 * s, 12 * s, 16 * s, colors.gold1);
  c.circle(x, y - 5 * s, 23 * s, [246, 196, 83, 66]);
}

function drawSmallHouse(c, x, y, w, h) {
  c.rect(x + 10, y + 30, w - 20, h - 30, colors.wood1);
  c.poly([[x, y + 38], [x + w / 2, y], [x + w, y + 38]], colors.outline);
  c.poly([[x + 8, y + 36], [x + w / 2, y + 8], [x + w - 8, y + 36]], colors.blue0);
  c.rect(x + 36, y + 52, 28, 38, colors.wood0);
  c.rect(x + 74, y + 48, 18, 18, colors.gold1);
}

function drawMarketStall(c, x, y, w, h) {
  c.rect(x + 8, y + 22, w - 16, h - 16, colors.wood1);
  c.rect(x, y + 4, w, 32, colors.outline);
  for (let i = 0; i < w; i += 22) {
    c.rect(x + i + 2, y + 8, 18, 26, i % 44 === 0 ? [244, 225, 177, 255] : colors.blue0);
  }
  c.rect(x + 14, y + 52, 20, 12, colors.ember1);
  c.rect(x + 42, y + 51, 22, 13, colors.moss);
  c.rect(x + 72, y + 50, 24, 14, colors.purple1);
  c.rect(x + w - 28, y + 45, 16, 22, colors.wood2);
}

function drawFlowers(c, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const px = x + (i * 17) % 80;
    const py = y + ((i * 11) % 38);
    c.rect(px, py, 4, 4, i % 3 === 0 ? colors.gold1 : i % 3 === 1 ? colors.purple2 : colors.blue2);
  }
}

function drawPond(c, x, y, w, h) {
  c.ellipse(x, y, w, h, [21, 83, 94, 255]);
  c.ellipse(x, y - 2, w - 14, h - 10, [43, 137, 153, 255]);
  c.rect(x - 34, y - 6, 30, 3, colors.blue2);
  c.rect(x + 18, y + 4, 38, 3, colors.blue2);
}

function drawSmallCrystal(c, x, y, tone) {
  const base = tone === "purple" ? colors.purple1 : colors.blue1;
  c.poly([[x, y], [x + 20, y + 28], [x + 8, y + 58], [x - 12, y + 54], [x - 20, y + 24]], colors.outline);
  c.poly([[x, y + 4], [x + 14, y + 27], [x + 5, y + 49], [x - 9, y + 48], [x - 14, y + 25]], base);
}

function drawCrystalPatch(c, x, y, tone) {
  drawSmallCrystal(c, x, y, tone);
  drawSmallCrystal(c, x + 34, y + 24, tone);
  drawSmallCrystal(c, x - 28, y + 34, tone);
}

function drawWoodBridge(c, x, y) {
  c.rect(x - 74, y - 18, 150, 46, colors.wood0);
  for (let i = -68; i <= 58; i += 22) {
    c.rect(x + i, y - 16, 16, 44, colors.wood2);
    c.rect(x + i + 2, y - 14, 4, 38, colors.gold0);
  }
  c.rect(x - 84, y - 26, 168, 8, colors.wood1);
  c.rect(x - 84, y + 28, 168, 8, colors.wood1);
}

function drawFire(c, x, y, s) {
  c.circle(x, y + 18 * s, 34 * s, [255, 128, 38, 44]);
  c.poly([[x, y - 26 * s], [x + 22 * s, y + 24 * s], [x, y + 42 * s], [x - 22 * s, y + 24 * s]], colors.ember1);
  c.poly([[x + 2 * s, y - 10 * s], [x + 11 * s, y + 22 * s], [x - 4 * s, y + 32 * s], [x - 11 * s, y + 18 * s]], colors.ember2);
}

function drawCracks(c) {
  c.thickLine(95, 235, 160, 218, 4, colors.ember1);
  c.thickLine(460, 178, 526, 160, 4, colors.ember1);
  c.thickLine(386, 260, 422, 286, 4, colors.ember1);
}

function drawThorns(c, x, y) {
  for (let i = 0; i < 8; i += 1) {
    const xx = x + i * 20;
    c.thickLine(xx, y + 32, xx + 18, y - 24 + (i % 3) * 8, 5, colors.wood0);
    c.thickLine(xx + 18, y - 24 + (i % 3) * 8, xx + 30, y - 36 + (i % 2) * 8, 3, [65, 107, 50, 255]);
  }
}

function drawFallenLog(c, x, y) {
  c.rect(x - 58, y - 12, 116, 28, colors.wood0);
  c.rect(x - 52, y - 8, 104, 20, colors.wood1);
  c.circle(x + 58, y + 2, 15, colors.wood2);
  c.circle(x + 58, y + 2, 7, colors.wood0);
}

function drawRocks(c, x, y) {
  c.poly([[x - 38, y + 18], [x - 18, y - 20], [x + 8, y - 10], [x + 31, y + 20]], colors.outline);
  c.poly([[x - 30, y + 12], [x - 13, y - 14], [x + 8, y - 6], [x + 24, y + 16]], colors.stone1);
  c.rect(x - 12, y - 8, 18, 8, colors.stone2);
}

function drawMist(c, x, y) {
  for (let i = 0; i < 7; i += 1) {
    c.ellipse(x + i * 70, y + (i % 2) * 25, 100, 28, [188, 211, 213, 38]);
  }
}

function drawRuin(c, x, y) {
  c.rect(x - 48, y + 50, 96, 18, colors.stone0);
  c.rect(x - 42, y - 20, 18, 74, colors.stone1);
  c.rect(x + 24, y - 28, 18, 82, colors.stone1);
  c.rect(x - 50, y - 30, 100, 14, colors.stone2);
}

function drawCharredTrees(c) {
  for (const [x, y] of [[130, 118], [485, 98], [520, 238], [240, 272]]) {
    c.thickLine(x, y, x + 18, y + 70, 12, [38, 27, 21, 255]);
    c.thickLine(x + 4, y + 12, x - 30, y + 28, 5, [49, 34, 24, 255]);
  }
}

function drawRuneStones(c, x, y) {
  for (let i = 0; i < 5; i += 1) {
    const px = x + Math.cos(i * 1.257) * 76;
    const py = y + Math.sin(i * 1.257) * 42;
    c.rect(px - 12, py - 25, 24, 50, colors.stone0);
    c.rect(px - 6, py - 15, 12, 24, colors.blue1);
  }
  c.circle(x, y, 28, [35, 102, 133, 255]);
  c.circle(x, y, 14, colors.blue2);
}

function drawGate(c, x, y) {
  c.rect(x - 78, y + 36, 156, 30, colors.stone0);
  c.rect(x - 62, y - 14, 34, 82, colors.stone1);
  c.rect(x + 28, y - 14, 34, 82, colors.stone1);
  c.rect(x - 62, y - 28, 124, 24, colors.stone2);
  c.circle(x, y + 20, 30, colors.blue0);
  c.circle(x, y + 20, 16, colors.blue2);
}

function drawLightning(c, x, y) {
  c.poly([[x, y], [x + 30, y + 54], [x + 10, y + 54], [x + 42, y + 116], [x - 12, y + 42], [x + 10, y + 42]], colors.blue2);
}

function drawVignette(c) {
  for (let i = 0; i < 34; i += 1) {
    c.rect(i, i, c.width - i * 2, 2, [0, 0, 0, 16]);
    c.rect(i, c.height - i - 2, c.width - i * 2, 2, [0, 0, 0, 16]);
    c.rect(i, i, 2, c.height - i * 2, [0, 0, 0, 16]);
    c.rect(c.width - i - 2, i, 2, c.height - i * 2, [0, 0, 0, 16]);
  }
}

function drawSproutling() {
  return iconCanvas(96, (c) => {
    c.circle(48, 58, 24, colors.outline);
    c.circle(48, 58, 19, [84, 142, 53, 255]);
    c.circle(38, 53, 6, [18, 38, 22, 255]);
    c.circle(58, 53, 6, [18, 38, 22, 255]);
    c.rect(38, 68, 20, 5, [32, 72, 34, 255]);
    c.poly([[48, 34], [24, 18], [42, 44]], [93, 166, 72, 255]);
    c.poly([[52, 34], [73, 18], [57, 45]], [113, 189, 84, 255]);
    c.rect(28, 75, 12, 12, colors.wood1);
    c.rect(56, 75, 12, 12, colors.wood1);
  });
}

function drawEmberMite() {
  return iconCanvas(96, (c) => {
    c.circle(48, 54, 25, colors.outline);
    c.circle(48, 54, 20, colors.ember0);
    c.circle(48, 50, 13, colors.ember1);
    c.poly([[48, 19], [61, 53], [48, 45], [35, 53]], colors.ember2);
    for (let i = 0; i < 4; i += 1) {
      c.thickLine(28, 56 + i * 5, 14, 48 + i * 10, 4, colors.outline);
      c.thickLine(68, 56 + i * 5, 82, 48 + i * 10, 4, colors.outline);
    }
    c.rect(38, 56, 5, 5, colors.gold2);
    c.rect(53, 56, 5, 5, colors.gold2);
  });
}

function drawBriarCrawler() {
  return iconCanvas(96, (c) => {
    c.ellipse(48, 59, 34, 20, colors.outline);
    c.ellipse(48, 59, 28, 15, [71, 88, 40, 255]);
    for (let i = 0; i < 6; i += 1) {
      c.thickLine(24 + i * 9, 66, 10 + i * 13, 83, 4, colors.wood0);
      c.thickLine(24 + i * 9, 51, 8 + i * 13, 32, 4, colors.wood0);
    }
    c.poly([[33, 47], [26, 22], [42, 43]], [92, 132, 62, 255]);
    c.poly([[58, 47], [72, 20], [63, 44]], [92, 132, 62, 255]);
    c.rect(37, 56, 5, 5, colors.gold1);
    c.rect(54, 56, 5, 5, colors.gold1);
  });
}

function drawGlassBeetle() {
  return iconCanvas(96, (c) => {
    c.ellipse(48, 56, 30, 25, colors.outline);
    c.poly([[48, 21], [75, 47], [64, 78], [48, 86], [32, 78], [21, 47]], [58, 145, 160, 255]);
    c.poly([[48, 27], [70, 48], [50, 54]], colors.blue2);
    c.poly([[28, 50], [45, 30], [46, 80]], colors.blue1);
    c.thickLine(48, 27, 48, 84, 3, colors.outline);
    c.rect(36, 48, 5, 5, colors.outline);
    c.rect(55, 48, 5, 5, colors.outline);
  });
}

function drawMistWisp() {
  return iconCanvas(96, (c) => {
    c.circle(48, 49, 31, [144, 190, 206, 70]);
    c.circle(48, 49, 21, colors.blue1);
    c.circle(48, 49, 12, colors.blue2);
    c.poly([[48, 68], [65, 86], [50, 82], [39, 94], [42, 74], [29, 78]], [151, 210, 219, 190]);
    c.rect(40, 44, 5, 5, colors.outline);
    c.rect(54, 44, 5, 5, colors.outline);
  });
}

function drawAshHound() {
  return iconCanvas(96, (c) => {
    c.rect(21, 48, 54, 25, colors.outline);
    c.rect(26, 44, 46, 25, [74, 57, 48, 255]);
    c.rect(55, 34, 24, 24, colors.outline);
    c.rect(58, 37, 18, 18, [95, 66, 48, 255]);
    c.poly([[61, 36], [68, 18], [72, 38]], colors.outline);
    c.poly([[71, 39], [88, 28], [76, 49]], colors.outline);
    c.rect(64, 44, 4, 4, colors.ember2);
    c.rect(28, 68, 9, 17, colors.outline);
    c.rect(58, 68, 9, 17, colors.outline);
    c.poly([[25, 46], [14, 30], [17, 59]], colors.ember1);
  });
}

function drawRuneWarden() {
  return iconCanvas(96, (c) => {
    c.rect(28, 21, 40, 62, colors.outline);
    c.rect(34, 27, 28, 50, colors.stone0);
    c.rect(39, 35, 18, 30, colors.blue0);
    c.rect(44, 39, 8, 22, colors.blue2);
    c.rect(21, 42, 12, 30, colors.stone1);
    c.rect(64, 42, 12, 30, colors.stone1);
    c.rect(34, 77, 10, 12, colors.stone1);
    c.rect(52, 77, 10, 12, colors.stone1);
  });
}

function drawShardGolem() {
  return iconCanvas(96, (c) => {
    c.poly([[48, 8], [75, 38], [66, 84], [30, 84], [20, 38]], colors.outline);
    c.poly([[48, 16], [68, 40], [60, 76], [36, 76], [27, 40]], colors.purple0);
    c.poly([[49, 17], [65, 40], [49, 53]], colors.purple1);
    c.poly([[30, 42], [48, 18], [46, 78]], colors.purple2);
    c.rect(38, 45, 6, 6, colors.gold2);
    c.rect(54, 45, 6, 6, colors.gold2);
  });
}

function drawStormSentinel() {
  return iconCanvas(96, (c) => {
    c.rect(31, 25, 34, 54, colors.outline);
    c.rect(36, 30, 24, 44, colors.stone0);
    c.rect(39, 38, 18, 8, colors.blue1);
    c.poly([[48, 48], [57, 57], [50, 57], [58, 74], [40, 53], [47, 53]], colors.blue2);
    c.rect(20, 42, 14, 20, colors.stone1);
    c.rect(62, 42, 14, 20, colors.stone1);
    c.circle(48, 22, 12, colors.blue0);
    c.circle(48, 22, 6, colors.blue2);
  });
}

function drawSolheartSentinel() {
  return iconCanvas(160, (c) => {
    c.rect(48, 35, 64, 88, colors.outline);
    c.rect(57, 44, 46, 72, colors.stone0);
    c.circle(80, 36, 26, colors.gold0);
    c.circle(80, 36, 15, colors.gold1);
    c.rect(68, 62, 8, 9, colors.blue2);
    c.rect(86, 62, 8, 9, colors.blue2);
    c.poly([[80, 80], [96, 104], [80, 96], [64, 104]], colors.gold1);
    c.rect(28, 72, 25, 44, colors.outline);
    c.rect(107, 72, 25, 44, colors.outline);
    c.rect(55, 120, 18, 25, colors.outline);
    c.rect(88, 120, 18, 25, colors.outline);
    drawBlueCrystal(c, 70, 0, 22, 44);
  });
}

function drawGoldReward() {
  return iconCanvas(64, (c) => {
    for (let i = 0; i < 4; i += 1) {
      c.ellipse(22 + i * 7, 42 - i * 6, 16, 7, colors.outline);
      c.ellipse(22 + i * 7, 41 - i * 6, 13, 5, colors.gold1);
      c.rect(18 + i * 7, 36 - i * 6, 8, 2, colors.gold2);
    }
  });
}

function drawXpCrystal() {
  return iconCanvas(64, (c) => drawBlueCrystal(c, 21, 7, 24, 50));
}

function drawMossThread() {
  return iconCanvas(64, (c) => {
    for (let i = 0; i < 6; i += 1) c.thickLine(10, 22 + i * 5, 52, 15 + i * 5, 4, i % 2 ? colors.moss : colors.grass2);
    c.rect(10, 44, 34, 6, colors.grass1);
  });
}

function drawTowerShard() {
  return iconCanvas(64, (c) => {
    c.poly([[33, 5], [50, 25], [43, 55], [24, 55], [14, 25]], colors.outline);
    c.poly([[33, 10], [45, 27], [39, 50], [27, 50], [20, 27]], colors.blue1);
    c.rect(30, 17, 5, 28, colors.blue2);
  });
}

function drawEmberCore() {
  return iconCanvas(64, (c) => {
    c.circle(32, 33, 23, colors.outline);
    c.circle(32, 33, 18, colors.ember0);
    c.poly([[32, 10], [45, 37], [32, 52], [20, 38]], colors.ember1);
    c.poly([[34, 22], [40, 38], [29, 43]], colors.ember2);
  });
}

function drawTidalPearl() {
  return iconCanvas(64, (c) => {
    c.circle(32, 34, 22, colors.outline);
    c.circle(32, 34, 17, [132, 221, 227, 255]);
    c.circle(26, 28, 7, colors.white);
    c.thickLine(14, 49, 50, 49, 5, colors.blue0);
  });
}

function drawStarlitDust() {
  return iconCanvas(64, (c) => {
    for (const [x, y, s] of [[32, 29, 18], [18, 42, 8], [47, 44, 9], [45, 17, 7]]) {
      c.poly([[x, y - s], [x + 4, y - 4], [x + s, y], [x + 4, y + 4], [x, y + s], [x - 4, y + 4], [x - s, y], [x - 4, y - 4]], colors.gold1);
      c.rect(x - 2, y - 2, 4, 4, colors.gold2);
    }
  });
}

function drawChest(kind) {
  return iconCanvas(64, (c) => {
    const accent = kind === "boss" ? colors.purple1 : kind === "rare" ? colors.blue1 : colors.gold1;
    c.rect(12, 24, 40, 28, colors.outline);
    c.rect(16, 28, 32, 20, colors.wood1);
    c.rect(16, 20, 32, 13, colors.wood2);
    c.rect(30, 29, 6, 12, accent);
    c.rect(16, 32, 32, 5, colors.gold0);
    c.rect(22, 22, 20, 3, colors.gold2);
  });
}

function iconCanvas(size, draw) {
  const c = new Canvas(size, size, colors.transparent);
  draw(c);
  return c;
}

class Canvas {
  constructor(width, height, fill = colors.transparent) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4);
    this.rect(0, 0, width, height, fill);
  }

  pixel(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const [r, g, b, a] = color;
    if (a === 255) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = a;
      return;
    }
    const dstA = this.data[i + 3] / 255;
    const srcA = a / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA === 0) return;
    this.data[i] = Math.round((r * srcA + this.data[i] * dstA * (1 - srcA)) / outA);
    this.data[i + 1] = Math.round((g * srcA + this.data[i + 1] * dstA * (1 - srcA)) / outA);
    this.data[i + 2] = Math.round((b * srcA + this.data[i + 2] * dstA * (1 - srcA)) / outA);
    this.data[i + 3] = Math.round(outA * 255);
  }

  rect(x, y, w, h, color) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy += 1) {
      for (let xx = x0; xx < x1; xx += 1) this.pixel(xx, yy, color);
    }
  }

  circle(cx, cy, r, color) {
    const rr = r * r;
    for (let y = Math.floor(cy - r); y <= cy + r; y += 1) {
      for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= rr) this.pixel(x, y, color);
      }
    }
  }

  ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
        if (((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1) this.pixel(x, y, color);
      }
    }
  }

  thickLine(x0, y0, x1, y1, width, color) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      this.circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, color);
    }
  }

  poly(points, color) {
    const ys = points.map((p) => p[1]);
    const minY = Math.floor(Math.min(...ys));
    const maxY = Math.ceil(Math.max(...ys));
    for (let y = minY; y <= maxY; y += 1) {
      const nodes = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if ((yi < y && yj >= y) || (yj < y && yi >= y)) {
          nodes.push(Math.round(xi + ((y - yi) / (yj - yi)) * (xj - xi)));
        }
      }
      nodes.sort((a, b) => a - b);
      for (let i = 0; i < nodes.length; i += 2) {
        if (nodes[i + 1] === undefined) break;
        this.rect(nodes[i], y, nodes[i + 1] - nodes[i] + 1, 1, color);
      }
    }
  }
}

function writePng(path, canvas) {
  writeFileSync(path, encodePng(canvas.width, canvas.height, canvas.data));
}

function encodePng(width, height, rgba) {
  const scanline = width * 4 + 1;
  const raw = Buffer.alloc(scanline * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * scanline] = 0;
    rgba.copy(raw, y * scanline + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  return Buffer.concat([u32(data.length), name, data, u32(crc32(Buffer.concat([name, data])))]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

main();
