import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(root, "apps/web/public");
const assetRoot = "assets/soltower/environment";

const palette = {
  outline: "#07120f",
  shadow: "#020617",
  grassDark: "#102b22",
  grass: "#1f4d33",
  grassLight: "#3d7b43",
  moss: "#6f8f3e",
  stoneDark: "#3f4545",
  stone: "#74736a",
  stoneLight: "#b8ac86",
  woodDark: "#3d2618",
  wood: "#6b4326",
  woodLight: "#b87836",
  roofBlue: "#143047",
  roofRed: "#6d2e26",
  roofGreen: "#275340",
  gold: "#f6c453",
  amber: "#ffb84a",
  cyan: "#40d6ff",
  purple: "#9b5cff",
  waterDark: "#0e4351",
  water: "#1d7f8b",
  waterLight: "#7ed6dc"
};

function main() {
  writeAsset("ground/grass-tile.png", drawGrassTile(128, 128));
  writeAsset("ground/cobble-path-tile.png", drawCobbleTile(128, 64));
  writeAsset("ground/town-ground.png", drawTownGround());

  writeAsset("props/oak-tree.png", drawOakTree());
  writeAsset("props/pine-tree.png", drawPineTree());
  writeAsset("props/bush-flower.png", drawBushFlower());
  writeAsset("props/rock-cluster.png", drawRockCluster());
  writeAsset("props/lamp-post.png", drawLampPost());
  writeAsset("props/lamp-glow.png", drawLampGlow());
  writeAsset("props/bench.png", drawBench());
  writeAsset("props/barrel-crates.png", drawBarrelCrates());
  writeAsset("props/fence-rail.png", drawFenceRail());
  writeAsset("props/signpost.png", drawSignpost());
  writeAsset("props/quest-board.png", drawQuestBoardAsset());
  writeAsset("props/market-stall.png", drawMarketStall());
  writeAsset("props/fountain.png", drawFountain());
  writeAsset("props/campfire.png", drawCampfire());
  writeAsset("props/dock.png", drawDock());
  writeAsset("props/boat.png", drawBoat());

  writeAsset("structures/solheart-tower.png", drawSolheartTower());
  writeAsset("structures/raid-portal.png", drawRaidPortal());
  writeAsset("structures/moonpetal-market.png", drawBuilding("market"));
  writeAsset("structures/lanternroot-tavern.png", drawBuilding("tavern"));
  writeAsset("structures/emberforge.png", drawBuilding("forge"));
  writeAsset("structures/quest-grove.png", drawBuilding("grove"));
  writeAsset("structures/blacksmith.png", drawBuilding("blacksmith"));
}

function writeAsset(relativePath, canvas) {
  const outputPath = join(publicRoot, assetRoot, relativePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, encodePng(canvas.width, canvas.height, canvas.data));
}

function drawGrassTile(width, height) {
  const canvas = createCanvas(width, height, color(palette.grassDark));
  const rng = createRng(1021);
  for (let i = 0; i < 1200; i += 1) {
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    const colors = [palette.grass, palette.grassLight, palette.moss, "#173c2b", "#2f663c"];
    fillRect(canvas, x, y, 1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 2), color(colors[i % colors.length], 145 + Math.floor(rng() * 100)));
  }
  for (let i = 0; i < 38; i += 1) {
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    fillRect(canvas, x, y, 2, 2, color(i % 3 === 0 ? "#f5d06b" : i % 3 === 1 ? "#b985e8" : "#e97772"));
  }
  return canvas;
}

function drawCobbleTile(width, height) {
  const canvas = createCanvas(width, height);
  fillRect(canvas, 0, 0, width, height, color("#525850"));
  const rng = createRng(842);
  for (let y = 2; y < height; y += 13) {
    for (let x = 2; x < width; x += 18) {
      const w = 13 + Math.floor(rng() * 8);
      const h = 9 + Math.floor(rng() * 6);
      const shade = [palette.stoneDark, palette.stone, "#8a8779", "#686d67"][Math.floor(rng() * 4)];
      fillRect(canvas, x + Math.floor(rng() * 4), y + Math.floor(rng() * 3), w, h, color(shade));
      strokeRect(canvas, x, y, w + 2, h + 1, color("#262b2c", 130));
      putPixel(canvas, x + 2, y + 1, color(palette.stoneLight, 160));
    }
  }
  return canvas;
}

function drawTownGround() {
  const canvas = createCanvas(1600, 1000, color("#11291f"));
  const rng = createRng(6671);
  for (let i = 0; i < 44000; i += 1) {
    const x = Math.floor(rng() * canvas.width);
    const y = Math.floor(rng() * canvas.height);
    const c = [palette.grassDark, palette.grass, "#265b37", "#2d683b", "#486d37"][Math.floor(rng() * 5)];
    fillRect(canvas, x, y, 1 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 2), color(c, 120 + Math.floor(rng() * 120)));
  }

  fillRect(canvas, 0, 905, 1600, 95, color("#0b3240"));
  for (let i = 0; i < 900; i += 1) {
    const x = Math.floor(rng() * 1600);
    const y = 905 + Math.floor(rng() * 95);
    fillRect(canvas, x, y, 6 + Math.floor(rng() * 14), 1, color(i % 4 === 0 ? palette.waterLight : palette.water, 120));
  }

  drawCobbleArea(canvas, (x, y) => isPathMask(x, y), 8752);
  drawFlowerMeadow(canvas, rng);
  drawCliffEdges(canvas, rng);
  return canvas;
}

function isPathMask(x, y) {
  const vertical = Math.abs(x - 800) < 52 && y > 92 && y < 900;
  const horizontal = Math.abs(y - 543) < 43 && x > 285 && x < 1315;
  const plaza = ((x - 800) ** 2) / (188 ** 2) + ((y - 543) ** 2) / (126 ** 2) < 1;
  const branchLeftTop = Math.abs((y - 548) - (x - 285) * -0.18) < 28 && x > 250 && x < 520 && y > 430 && y < 610;
  const branchRightTop = Math.abs((y - 548) - (x - 1120) * 0.22) < 28 && x > 1020 && x < 1350 && y > 430 && y < 620;
  return vertical || horizontal || plaza || branchLeftTop || branchRightTop;
}

function drawCobbleArea(canvas, mask, seed) {
  const rng = createRng(seed);
  for (let y = 72; y < 910; y += 15) {
    for (let x = 225; x < 1365; x += 22) {
      if (!mask(x, y)) {
        continue;
      }
      const ox = Math.floor(rng() * 8) - 4;
      const oy = Math.floor(rng() * 7) - 3;
      const w = 16 + Math.floor(rng() * 12);
      const h = 9 + Math.floor(rng() * 7);
      const shade = [palette.stoneDark, "#5e655f", palette.stone, "#8b8776", "#9b9279"][Math.floor(rng() * 5)];
      fillPolygon(canvas, [
        [x + ox - w / 2, y + oy - h / 2],
        [x + ox + w / 2 - 2, y + oy - h / 2 + 1],
        [x + ox + w / 2, y + oy + h / 2],
        [x + ox - w / 2 + 2, y + oy + h / 2]
      ], color(shade));
      strokeRect(canvas, Math.round(x + ox - w / 2), Math.round(y + oy - h / 2), w, h, color("#242a29", 90));
      if (rng() > 0.62) fillRect(canvas, x + ox - 4, y + oy - 3, 3, 1, color(palette.stoneLight, 145));
    }
  }
  fillEllipse(canvas, 800, 543, 56, 30, color("#36535b", 155));
}

function drawFlowerMeadow(canvas, rng) {
  for (let i = 0; i < 520; i += 1) {
    const x = Math.floor(rng() * 1500) + 50;
    const y = Math.floor(rng() * 790) + 105;
    if (isPathMask(x, y)) continue;
    const c = ["#f0cf6a", "#e17076", "#c68dfa", "#e9e0ac", "#82cf7c"][i % 5];
    fillRect(canvas, x, y, 2, 2, color(c, 180));
    if (i % 3 === 0) fillRect(canvas, x + 2, y + 1, 1, 1, color("#335f36", 210));
  }
}

function drawCliffEdges(canvas, rng) {
  for (let x = 0; x < 1600; x += 48) {
    if (rng() > 0.42) continue;
    fillRect(canvas, x, 88 + Math.floor(rng() * 30), 38, 8, color("#2a312c", 120));
    fillRect(canvas, x + 4, 96 + Math.floor(rng() * 25), 26, 5, color("#5b6053", 120));
  }
}

function drawOakTree() {
  const c = createCanvas(112, 128);
  fillEllipse(c, 56, 114, 42, 12, color(palette.shadow, 80));
  fillRect(c, 49, 66, 15, 44, color("#4a2d18"));
  fillRect(c, 57, 67, 5, 38, color("#8b5a2e"));
  const blobs = [
    [56, 38, 36, 28, "#1f5f35"],
    [31, 54, 30, 25, "#1a4c31"],
    [80, 56, 30, 26, "#27683b"],
    [55, 66, 38, 26, "#2f7d42"],
    [53, 22, 24, 18, "#3f8744"],
    [31, 35, 21, 18, "#346f3d"],
    [81, 34, 22, 18, "#3b7a3f"]
  ];
  blobs.forEach(([x, y, rx, ry, hex]) => fillEllipse(c, x, y, rx, ry, color(hex)));
  for (let i = 0; i < 90; i += 1) {
    const x = 20 + ((i * 17) % 72);
    const y = 16 + ((i * 29) % 62);
    if ((x - 56) ** 2 / 44 ** 2 + (y - 46) ** 2 / 42 ** 2 < 1) {
      fillRect(c, x, y, 3, 2, color(i % 4 === 0 ? "#78a650" : "#143d2b", 120));
    }
  }
  return c;
}

function drawPineTree() {
  const c = createCanvas(96, 132);
  fillEllipse(c, 48, 120, 34, 9, color(palette.shadow, 80));
  fillRect(c, 43, 76, 11, 38, color("#5b3a22"));
  [
    [48, 18, 20, 38],
    [48, 38, 33, 48],
    [48, 61, 42, 56],
    [48, 83, 35, 43]
  ].forEach(([x, y, rx, h], i) => {
    fillPolygon(c, [[x, y - h / 2], [x + rx, y + h / 2], [x - rx, y + h / 2]], color(["#2c6f37", "#205a34", "#1c4d31", "#2f7438"][i]));
    line(c, x - rx + 8, y + h / 2 - 4, x + rx - 8, y + h / 2 - 4, color("#0d2b22", 145), 2);
  });
  fillRect(c, 46, 10, 4, 2, color("#8fbf55", 160));
  return c;
}

function drawBushFlower() {
  const c = createCanvas(72, 54);
  fillEllipse(c, 36, 44, 28, 7, color(palette.shadow, 60));
  fillEllipse(c, 25, 28, 19, 14, color("#275f35"));
  fillEllipse(c, 43, 27, 23, 16, color("#347540"));
  fillEllipse(c, 34, 20, 17, 13, color("#438a47"));
  [[21, 22], [37, 18], [48, 27], [31, 31], [55, 20]].forEach(([x, y], i) => {
    fillRect(c, x, y, 3, 3, color(["#ef8e7b", "#f5d06b", "#c995ff"][i % 3]));
  });
  return c;
}

function drawRockCluster() {
  const c = createCanvas(72, 48);
  fillEllipse(c, 36, 39, 30, 8, color(palette.shadow, 70));
  fillPolygon(c, [[12, 34], [22, 17], [39, 13], [54, 27], [49, 38], [19, 40]], color("#555c5d"));
  fillPolygon(c, [[32, 36], [45, 18], [62, 25], [65, 38], [43, 42]], color("#747775"));
  fillRect(c, 24, 19, 13, 3, color("#b5b09a", 130));
  fillRect(c, 48, 24, 8, 2, color("#c7bea4", 130));
  line(c, 20, 37, 51, 39, color("#202827", 130), 2);
  return c;
}

function drawLampPost() {
  const c = createCanvas(48, 96);
  fillEllipse(c, 24, 89, 17, 5, color(palette.shadow, 70));
  fillRect(c, 21, 33, 6, 49, color("#2d2118"));
  fillRect(c, 24, 33, 2, 49, color("#8a5c2e"));
  fillRect(c, 15, 28, 18, 6, color("#1b2022"));
  fillRect(c, 17, 16, 14, 16, color("#2a2b2a"));
  fillRect(c, 20, 18, 8, 11, color("#ffd16a"));
  fillRect(c, 22, 19, 4, 9, color("#ff8f35"));
  fillPolygon(c, [[24, 7], [35, 17], [13, 17]], color("#11191b"));
  fillRect(c, 18, 82, 12, 5, color("#413024"));
  return c;
}

function drawLampGlow() {
  const c = createCanvas(96, 96);
  for (let r = 42; r > 0; r -= 3) {
    fillEllipse(c, 48, 48, r, r, color("#ffc45d", Math.round((1 - r / 45) * 18)));
  }
  fillEllipse(c, 48, 48, 18, 22, color("#ffd36d", 32));
  return c;
}

function drawBench() {
  const c = createCanvas(88, 44);
  fillEllipse(c, 44, 35, 37, 7, color(palette.shadow, 70));
  fillRect(c, 15, 15, 58, 8, color("#8a5832"));
  fillRect(c, 12, 25, 64, 7, color("#6a3f25"));
  fillRect(c, 18, 11, 5, 25, color("#3b271c"));
  fillRect(c, 65, 11, 5, 25, color("#3b271c"));
  line(c, 17, 17, 70, 17, color("#c18443", 170), 1);
  return c;
}

function drawBarrelCrates() {
  const c = createCanvas(88, 64);
  fillEllipse(c, 45, 55, 34, 7, color(palette.shadow, 70));
  drawBarrel(c, 14, 21);
  drawCrate(c, 40, 24);
  drawSack(c, 63, 30);
  return c;
}

function drawBarrel(c, x, y) {
  fillEllipse(c, x + 12, y, 12, 5, color("#b87938"));
  fillRect(c, x, y, 24, 25, color("#85512b"));
  fillEllipse(c, x + 12, y + 25, 12, 5, color("#5a351e"));
  fillRect(c, x + 3, y + 4, 3, 20, color("#d49547"));
  fillRect(c, x + 18, y + 4, 3, 20, color("#4a2c1b"));
  fillRect(c, x, y + 8, 24, 3, color("#2b2520"));
  fillRect(c, x, y + 18, 24, 3, color("#2b2520"));
}

function drawCrate(c, x, y) {
  fillRect(c, x, y, 25, 25, color("#7b512f"));
  strokeRect(c, x, y, 25, 25, color("#2a1d14"));
  line(c, x + 3, y + 21, x + 21, y + 4, color("#b77a3d"), 2);
  line(c, x + 3, y + 4, x + 21, y + 21, color("#4a2f1f"), 2);
}

function drawSack(c, x, y) {
  fillEllipse(c, x + 8, y + 19, 11, 9, color("#b49a65"));
  fillRect(c, x, y + 8, 17, 16, color("#947849"));
  fillRect(c, x + 4, y + 5, 9, 5, color("#d0b77d"));
  line(c, x + 2, y + 10, x + 15, y + 11, color("#614a2e"), 1);
}

function drawFenceRail() {
  const c = createCanvas(104, 46);
  fillEllipse(c, 52, 38, 45, 5, color(palette.shadow, 55));
  [12, 52, 92].forEach((x) => {
    fillRect(c, x - 4, 8, 8, 31, color("#5a3823"));
    fillPolygon(c, [[x - 5, 8], [x, 0], [x + 5, 8]], color("#8d5b30"));
  });
  line(c, 9, 17, 96, 12, color("#7b4d2a"), 6);
  line(c, 8, 29, 96, 23, color("#5d3822"), 5);
  fillRect(c, 18, 14, 20, 2, color("#bc7d3d", 150));
  return c;
}

function drawSignpost() {
  const c = createCanvas(82, 78);
  fillEllipse(c, 40, 70, 26, 5, color(palette.shadow, 60));
  fillRect(c, 38, 20, 6, 46, color("#4a2f1f"));
  fillRect(c, 18, 19, 45, 18, color("#76502d"));
  strokeRect(c, 18, 19, 45, 18, color("#2a1b12"));
  fillRect(c, 23, 24, 35, 2, color("#d1a058", 160));
  fillRect(c, 29, 43, 28, 16, color("#8a623a"));
  strokeRect(c, 29, 43, 28, 16, color("#2a1b12"));
  return c;
}

function drawQuestBoardAsset() {
  const c = createCanvas(136, 112);
  fillEllipse(c, 68, 102, 48, 7, color(palette.shadow, 65));
  fillRect(c, 22, 35, 8, 58, color("#4a2f1f"));
  fillRect(c, 106, 35, 8, 58, color("#4a2f1f"));
  fillRect(c, 18, 24, 100, 60, color("#76502d"));
  strokeRect(c, 18, 24, 100, 60, color("#d1a058"));
  [[36, 34], [65, 39], [88, 31]].forEach(([x, y], i) => {
    fillRect(c, x, y, 20, 28, color(i === 1 ? "#ead8a9" : "#d8c393"));
    strokeRect(c, x, y, 20, 28, color("#65492b"));
  });
  fillRect(c, 42, 91, 52, 7, color("#5c3b22"));
  return c;
}

function drawMarketStall() {
  const c = createCanvas(180, 130);
  fillEllipse(c, 90, 115, 72, 12, color(palette.shadow, 70));
  fillRect(c, 35, 62, 110, 43, color("#7a4b2a"));
  fillRect(c, 42, 69, 96, 9, color("#a16734"));
  fillRect(c, 29, 45, 122, 25, color("#f2d19b"));
  for (let i = 0; i < 6; i += 1) {
    fillRect(c, 31 + i * 20, 44, 14, 30, color(i % 2 === 0 ? "#bb5b39" : "#f4d6a0"));
  }
  fillPolygon(c, [[30, 44], [45, 21], [136, 21], [151, 44]], color("#d77d45"));
  strokeRect(c, 31, 44, 120, 4, color("#5b3924"));
  fillRect(c, 38, 70, 8, 41, color("#4a2d1b"));
  fillRect(c, 133, 70, 8, 41, color("#4a2d1b"));
  [[58, 88, "#f08c4f"], [78, 86, "#f7ca55"], [98, 88, "#73ba54"], [118, 86, "#d7584d"]].forEach(([x, y, hex]) => fillEllipse(c, x, y, 8, 5, color(hex)));
  fillRect(c, 64, 102, 48, 9, color("#4d2f1d"));
  return c;
}

function drawFountain() {
  const c = createCanvas(190, 142);
  fillEllipse(c, 95, 121, 78, 12, color(palette.shadow, 65));
  fillEllipse(c, 95, 91, 84, 35, color("#5c625d"));
  fillEllipse(c, 95, 86, 72, 28, color("#9b927b"));
  fillEllipse(c, 95, 80, 58, 20, color(palette.water));
  fillRect(c, 82, 50, 26, 38, color("#626b69"));
  fillEllipse(c, 95, 49, 23, 9, color("#a89f85"));
  fillPolygon(c, [[95, 10], [116, 43], [95, 72], [74, 43]], color(palette.cyan, 225));
  fillPolygon(c, [[95, 10], [105, 42], [95, 72]], color("#9bf4ff", 210));
  fillRect(c, 100, 24, 3, 31, color("#e5ffff", 150));
  for (let i = 0; i < 22; i += 1) {
    fillRect(c, 54 + (i * 7) % 88, 74 + (i * 11) % 14, 6, 1, color(palette.waterLight, 170));
  }
  return c;
}

function drawCampfire() {
  const c = createCanvas(88, 72);
  fillEllipse(c, 44, 60, 28, 6, color(palette.shadow, 70));
  line(c, 24, 52, 63, 38, color("#5a341d"), 5);
  line(c, 25, 39, 63, 53, color("#6f4223"), 5);
  fillPolygon(c, [[44, 18], [57, 47], [44, 58], [31, 47]], color("#ff6d2f"));
  fillPolygon(c, [[45, 7], [54, 42], [45, 55], [35, 42]], color("#ffba43"));
  fillPolygon(c, [[43, 25], [49, 43], [43, 51], [38, 43]], color("#fff0a3"));
  return c;
}

function drawDock() {
  const c = createCanvas(270, 150);
  fillEllipse(c, 123, 133, 118, 10, color(palette.shadow, 70));
  for (let i = 0; i < 9; i += 1) {
    fillPolygon(c, [[20 + i * 25, 42], [42 + i * 25, 31], [56 + i * 25, 102], [34 + i * 25, 113]], color(i % 2 ? "#6d4427" : "#80522e"));
    line(c, 24 + i * 25, 48, 40 + i * 25, 108, color("#b57b3e", 120), 2);
  }
  [28, 110, 200, 242].forEach((x) => fillRect(c, x, 38, 10, 94, color("#3d281b")));
  line(c, 18, 48, 242, 35, color("#2b2119"), 4);
  line(c, 35, 115, 253, 100, color("#2b2119"), 4);
  return c;
}

function drawBoat() {
  const c = createCanvas(250, 140);
  fillEllipse(c, 122, 123, 102, 10, color(palette.shadow, 70));
  fillPolygon(c, [[36, 80], [61, 111], [184, 111], [220, 78], [185, 101], [66, 101]], color("#5f351e"));
  fillPolygon(c, [[54, 73], [80, 95], [173, 95], [204, 72], [178, 88], [77, 88]], color("#8a552d"));
  fillRect(c, 120, 28, 7, 73, color("#4c321f"));
  fillPolygon(c, [[128, 31], [193, 72], [128, 75]], color("#e7dbc1"));
  fillPolygon(c, [[119, 35], [65, 81], [119, 78]], color("#f4ead0"));
  fillRect(c, 139, 48, 37, 28, color("#1c4c72"));
  fillRect(c, 151, 56, 12, 11, color(palette.gold));
  fillRect(c, 86, 102, 44, 10, color("#3b281c"));
  return c;
}

function drawSolheartTower() {
  const c = createCanvas(230, 330);
  fillEllipse(c, 115, 310, 83, 16, color(palette.shadow, 70));
  fillEllipse(c, 115, 264, 80, 28, color("#4d4e47"));
  fillRect(c, 59, 103, 112, 165, color("#5b5850"));
  fillEllipse(c, 115, 103, 56, 23, color("#7a7464"));
  for (let y = 111; y < 260; y += 19) {
    for (let x = 63 + ((y / 19) % 2) * 10; x < 164; x += 22) {
      fillRect(c, x, y, 19, 12, color((x + y) % 3 === 0 ? "#756e5d" : "#494b47"));
      strokeRect(c, x, y, 19, 12, color("#1c2222", 80));
    }
  }
  fillRect(c, 95, 221, 40, 59, color("#2c1d15"));
  strokeRect(c, 95, 221, 40, 59, color(palette.gold, 160));
  [82, 148].forEach((x) => {
    fillRect(c, x, 144, 10, 33, color("#125b86"));
    fillRect(c, x + 3, 147, 4, 25, color(palette.cyan));
  });
  fillPolygon(c, [[115, 14], [151, 69], [115, 104], [79, 69]], color(palette.cyan));
  fillPolygon(c, [[115, 14], [132, 67], [115, 104]], color("#a6f7ff"));
  fillRect(c, 56, 76, 118, 29, color("#3a3731"));
  for (let i = 0; i < 5; i += 1) fillRect(c, 64 + i * 22, 80, 15, 19, color("#6c6355"));
  [44, 185].forEach((x) => {
    fillRect(c, x, 153, 20, 120, color("#41423d"));
    fillRect(c, x + 5, 136, 10, 21, color(palette.cyan));
  });
  return c;
}

function drawRaidPortal() {
  const c = createCanvas(190, 190);
  fillEllipse(c, 95, 171, 72, 12, color(palette.shadow, 80));
  fillEllipse(c, 95, 105, 49, 66, color("#4b1a77", 120));
  for (let r = 50; r > 12; r -= 8) {
    fillEllipse(c, 95, 105, r, Math.round(r * 1.12), color(palette.purple, 18));
  }
  fillEllipse(c, 95, 105, 26, 34, color("#b47aff", 150));
  fillEllipse(c, 95, 105, 10, 14, color("#f2d8ff", 210));
  fillRect(c, 36, 79, 19, 76, color("#4c4c50"));
  fillRect(c, 135, 79, 19, 76, color("#4c4c50"));
  fillPolygon(c, [[37, 80], [61, 34], [83, 44], [61, 83]], color("#5f5c58"));
  fillPolygon(c, [[153, 80], [129, 34], [107, 44], [129, 83]], color("#5f5c58"));
  for (let i = 0; i < 18; i += 1) fillRect(c, 47 + (i * 13) % 96, 52 + (i * 17) % 85, 5, 4, color(i % 2 ? "#6d6571" : "#3b3d42"));
  [49, 141].forEach((x) => {
    fillRect(c, x - 5, 91, 10, 43, color(palette.purple, 190));
    fillRect(c, x - 2, 98, 4, 28, color("#e3bdff"));
  });
  return c;
}

function drawBuilding(kind) {
  const config = {
    market: { roof: "#c56a44", wall: "#6f4b2f", sign: "#f2c15f", accent: "#72c78e" },
    tavern: { roof: "#183954", wall: "#7a5232", sign: "#f2c15f", accent: "#ffb357" },
    forge: { roof: "#7b2d26", wall: "#5c4436", sign: "#f5a740", accent: "#ff6e32" },
    grove: { roof: "#2f6246", wall: "#6d5232", sign: "#d8e891", accent: "#91cc73" },
    blacksmith: { roof: "#17344c", wall: "#6b4b34", sign: "#f2c15f", accent: "#ff8a32" }
  }[kind];
  const c = createCanvas(232, 196);
  fillEllipse(c, 116, 180, 86, 12, color(palette.shadow, 70));
  fillRect(c, 47, 84, 138, 73, color(config.wall));
  for (let x = 52; x < 180; x += 19) fillRect(c, x, 91, 13, 5, color("#9a7448", 130));
  fillPolygon(c, [[30, 88], [70, 37], [161, 37], [203, 88]], color(config.roof));
  fillPolygon(c, [[49, 85], [79, 50], [154, 50], [184, 85]], color(lighten(config.roof, 18)));
  strokeRect(c, 48, 84, 138, 73, color("#241915"));
  fillRect(c, 96, 118, 38, 40, color("#2a1c14"));
  fillRect(c, 101, 121, 29, 35, color("#4b2f1f"));
  [68, 162].forEach((x) => {
    fillRect(c, x, 107, 20, 20, color("#40291b"));
    fillRect(c, x + 4, 110, 12, 13, color(config.accent));
  });
  fillRect(c, 75, 70, 82, 20, color("#3c2b1f"));
  strokeRect(c, 75, 70, 82, 20, color(config.sign));
  if (kind === "forge" || kind === "blacksmith") {
    fillEllipse(c, 184, 143, 22, 11, color("#4a3427"));
    fillRect(c, 167, 122, 34, 23, color("#38261d"));
    fillRect(c, 175, 127, 18, 13, color("#ff7a2c"));
    fillRect(c, 181, 116, 5, 19, color("#ffcf6b"));
  }
  if (kind === "tavern") {
    fillRect(c, 48, 61, 16, 52, color("#51321f"));
    fillRect(c, 51, 50, 10, 14, color("#7e5130"));
  }
  if (kind === "grove") {
    fillEllipse(c, 43, 113, 22, 17, color("#376e3e"));
    fillEllipse(c, 192, 115, 24, 17, color("#418349"));
  }
  return c;
}

function lighten(hex, amount) {
  const [r, g, b] = parseHex(hex);
  return rgbToHex(Math.min(255, r + amount), Math.min(255, g + amount), Math.min(255, b + amount));
}

function createCanvas(width, height, fill = [0, 0, 0, 0]) {
  const canvas = { width, height, data: new Uint8Array(width * height * 4) };
  if (fill[3] > 0) fillRect(canvas, 0, 0, width, height, fill);
  return canvas;
}

function color(hex, alpha = 255) {
  const [r, g, b] = parseHex(hex);
  return [r, g, b, alpha];
}

function parseHex(hex) {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function putPixel(canvas, x, y, rgba) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height || rgba[3] <= 0) return;
  const index = (py * canvas.width + px) * 4;
  const sourceAlpha = rgba[3] / 255;
  const targetAlpha = canvas.data[index + 3] / 255;
  const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) return;
  canvas.data[index] = Math.round((rgba[0] * sourceAlpha + canvas.data[index] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  canvas.data[index + 1] = Math.round((rgba[1] * sourceAlpha + canvas.data[index + 1] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  canvas.data[index + 2] = Math.round((rgba[2] * sourceAlpha + canvas.data[index + 2] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  canvas.data[index + 3] = Math.round(outAlpha * 255);
}

function fillRect(canvas, x, y, width, height, rgba) {
  for (let yy = Math.round(y); yy < Math.round(y + height); yy += 1) {
    for (let xx = Math.round(x); xx < Math.round(x + width); xx += 1) {
      putPixel(canvas, xx, yy, rgba);
    }
  }
}

function strokeRect(canvas, x, y, width, height, rgba) {
  fillRect(canvas, x, y, width, 1, rgba);
  fillRect(canvas, x, y + height - 1, width, 1, rgba);
  fillRect(canvas, x, y, 1, height, rgba);
  fillRect(canvas, x + width - 1, y, 1, height, rgba);
}

function fillEllipse(canvas, cx, cy, rx, ry, rgba) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      if (((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) <= 1) putPixel(canvas, x, y, rgba);
    }
  }
}

function fillPolygon(canvas, points, rgba) {
  const minX = Math.floor(Math.min(...points.map(([x]) => x)));
  const maxX = Math.ceil(Math.max(...points.map(([x]) => x)));
  const minY = Math.floor(Math.min(...points.map(([, y]) => y)));
  const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) putPixel(canvas, x, y, rgba);
    }
  }
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function line(canvas, x0, y0, x1, y1, rgba, width = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    fillRect(canvas, Math.round(x - width / 2), Math.round(y - width / 2), width, width, rgba);
  }
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function encodePng(width, height, rgbaData) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgbaData.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  return Buffer.concat([u32(data.length), typeBuffer, data, u32(crc32(Buffer.concat([typeBuffer, data])))]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

main();
