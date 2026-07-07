import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, "apps/web/public/assets/soltower/heroes");

const sourceFrame = { width: 32, height: 40 };
const frame = { width: 64, height: 64, columns: 4, rows: 4 };
const directions = ["down", "left", "right", "up"];
const actions = ["idle", "walk", "run", "attack"];
const sourceFrameNames = ["idle", "walk-1", "walk-2", "walk-3"];
const origin = { x: 0.5, y: 0.88 };
const stormSources = {
  idle: join(outRoot, "source/storm-archer-idle-source.png"),
  walk: join(outRoot, "source/storm-archer-walk-source.png"),
  run: join(outRoot, "source/storm-archer-run-source.png"),
  attack: join(outRoot, "source/storm-archer-attack-source.png")
};

const heroes = [
  {
    id: "storm-archer",
    name: "Storm Archer",
    hair: "#f6d365",
    skin: "#d99a73",
    outfit: "#1f5d45",
    cloak: "#173c3d",
    accent: "#7dd3fc",
    weapon: "#eecb72",
    shadow: "#06131d",
    classShape: "bow"
  },
  {
    id: "tide-mage",
    name: "Tide Mage",
    hair: "#d7f9ff",
    skin: "#c98b68",
    outfit: "#1e4f78",
    cloak: "#173c65",
    accent: "#38d6d6",
    weapon: "#bfe8ff",
    shadow: "#071225",
    classShape: "water-staff"
  },
  {
    id: "bombardier",
    name: "Bombardier",
    hair: "#4b2b21",
    skin: "#b97852",
    outfit: "#5b4033",
    cloak: "#292a30",
    accent: "#fb923c",
    weapon: "#d0873d",
    shadow: "#0f1118",
    classShape: "launcher"
  },
  {
    id: "coral-alchemist",
    name: "Coral Alchemist",
    hair: "#5ee0b4",
    skin: "#c98870",
    outfit: "#245f58",
    cloak: "#45345f",
    accent: "#fb7185",
    weapon: "#9ef0d2",
    shadow: "#071d24",
    classShape: "flask"
  },
  {
    id: "starcaller",
    name: "Starcaller",
    hair: "#f9e7a5",
    skin: "#b97862",
    outfit: "#31276b",
    cloak: "#191f4f",
    accent: "#a78bfa",
    weapon: "#facc15",
    shadow: "#080b20",
    classShape: "star-staff"
  }
];

const hairStyles = ["storm-swept", "soft-bob", "crest"];
const outfitVariants = ["village-defender", "traveler", "ceremonial"];
const cloakStyles = ["starter-cloak", "long-cloak", "wing-cape"];
const singleLayers = ["skin", "accent", "weapon"];

function main() {
  mkdirSync(outRoot, { recursive: true });
  for (const hero of heroes) {
    const heroDir = join(outRoot, hero.id);
    mkdirSync(heroDir, { recursive: true });
    mkdirSync(join(heroDir, "layers/portrait"), { recursive: true });

    writePng(join(heroDir, "icon.png"), drawPortrait(hero, 96, "complete"));
    writePng(join(heroDir, "portrait.png"), drawPortrait(hero, 192, "complete"));
    for (const action of actions) {
      mkdirSync(join(heroDir, `layers/world/${action}`), { recursive: true });
      writePng(join(heroDir, `${action}.png`), hero.id === "storm-archer" ? drawStormActionSheet(action) : drawWorldSheet(hero, "complete", action));
    }

    for (const style of hairStyles) {
      writePng(join(heroDir, `layers/portrait/hair-${style}.png`), drawPortrait(hero, 192, `hair:${style}`));
      for (const action of actions) {
        writePng(join(heroDir, `layers/world/${action}/hair-${style}.png`), drawWorldLayerSheet(hero, `hair:${style}`, action));
      }
    }
    for (const variant of outfitVariants) {
      writePng(join(heroDir, `layers/portrait/outfit-${variant}.png`), drawPortrait(hero, 192, `outfit:${variant}`));
      for (const action of actions) {
        writePng(join(heroDir, `layers/world/${action}/outfit-${variant}.png`), drawWorldLayerSheet(hero, `outfit:${variant}`, action));
      }
    }
    for (const cloak of cloakStyles) {
      writePng(join(heroDir, `layers/portrait/cloak-${cloak}.png`), drawPortrait(hero, 192, `cloak:${cloak}`));
      for (const action of actions) {
        writePng(join(heroDir, `layers/world/${action}/cloak-${cloak}.png`), drawWorldLayerSheet(hero, `cloak:${cloak}`, action));
      }
    }
    for (const layer of singleLayers) {
      writePng(join(heroDir, `layers/portrait/${layer}.png`), drawPortrait(hero, 192, layer));
      for (const action of actions) {
        writePng(join(heroDir, `layers/world/${action}/${layer}.png`), drawWorldLayerSheet(hero, layer, action));
      }
    }
  }

  mkdirSync(join(outRoot, "shared"), { recursive: true });
  mkdirSync(join(outRoot, "portraits"), { recursive: true });
  mkdirSync(join(outRoot, "source"), { recursive: true });
  writePng(join(outRoot, "shared/fallback-silhouette.png"), drawFallbackPortrait(96));
  for (const action of actions) {
    writePng(join(outRoot, `shared/fallback-${action}.png`), drawFallbackSheet(action));
  }
  for (const hero of heroes) {
    writePng(join(outRoot, `portraits/${hero.id}.png`), drawPortrait(hero, 192, "complete"));
  }
  writeFileSync(
    join(outRoot, "source/generated-hero-notes.md"),
    `# Generated SolTower Hero Assets

Generated by \`scripts/generate-hero-character-assets.mjs\`.

These are original deterministic transparent PNG pixel-art assets. They do not use external artwork, spritesheets, music packs, icon packs, or copyrighted game assets.

Storm Archer action sheets are normalized from the repo-local source references in this folder:

- \`storm-archer-idle-source.png\`
- \`storm-archer-walk-source.png\`
- \`storm-archer-run-source.png\`
- \`storm-archer-attack-source.png\`

## Town Sprite Layout

- Frame size: ${frame.width}x${frame.height}
- Sheet size: ${frame.width * frame.columns}x${frame.height * frame.rows}
- Action sheets: idle.png, walk.png, run.png, attack.png
- Columns: frame-1, frame-2, frame-3, frame-4
- Rows: down, left, right, up
- Origin: ${origin.x}, ${origin.y}
- Gameplay anchor: lower center, with normalized feet baseline on every frame
- Final sheets use transparent PNG backgrounds

## Customization Layers

Each hero has tint-safe transparent portrait layers and per-action world layers for hair, skin, outfit, accent, cloak/back accessory, and weapon accent. The app tints these layers at runtime so existing players can receive a safe default appearance without schema changes.
`
  );
  writeFileSync(join(outRoot, "source/hero-preview.html"), heroPreviewHtml());
}

function drawWorldSheet(hero, layer, action) {
  const canvas = createCanvas(frame.width * frame.columns, frame.height * frame.rows);
  directions.forEach((direction, row) => {
    sourceFrameNames.forEach((anim, col) => {
      const raw = createCanvas(sourceFrame.width, sourceFrame.height);
      drawWorldFrame(raw, 0, 0, hero, direction, animationFrameName(action, anim, col), layer);
      const transform = normalizedFrameTransform(raw);
      blitNormalized(canvas, raw, transform, col * frame.width, row * frame.height);
    });
  });
  return canvas;
}

function drawWorldLayerSheet(hero, layer, action) {
  if (hero.id === "storm-archer") {
    return createCanvas(frame.width * frame.columns, frame.height * frame.rows);
  }
  const canvas = createCanvas(frame.width * frame.columns, frame.height * frame.rows);
  directions.forEach((direction, row) => {
    sourceFrameNames.forEach((anim, col) => {
      const frameName = animationFrameName(action, anim, col);
      const complete = createCanvas(sourceFrame.width, sourceFrame.height);
      drawWorldFrame(complete, 0, 0, hero, direction, frameName, "complete");
      const transform = normalizedFrameTransform(complete);
      const raw = createCanvas(sourceFrame.width, sourceFrame.height);
      drawWorldFrame(raw, 0, 0, hero, direction, frameName, layer);
      blitNormalized(canvas, raw, transform, col * frame.width, row * frame.height);
    });
  });
  return canvas;
}

function animationFrameName(action, anim, col) {
  if (action === "idle") {
    return col % 2 === 0 ? "idle" : "idle-breathe";
  }
  if (action === "run") {
    return anim === "idle" ? "walk-2" : anim;
  }
  if (action === "attack") {
    return `attack-${col}`;
  }
  return anim;
}

function drawWorldFrame(canvas, ox, oy, hero, direction, anim, layer) {
  const walk = anim === "walk-1" ? -1 : anim === "walk-2" ? 0 : anim === "walk-3" ? 1 : 0;
  const attacking = anim.startsWith("attack");
  const attackFrame = attacking ? Number(anim.split("-")[1]) : 0;
  const runBoost = anim !== "idle" && anim !== "idle-breathe" ? (direction === "up" ? -1 : 1) : 0;
  const bob = anim === "idle" ? 0 : anim === "idle-breathe" ? -1 : Math.abs(walk);
  const faceLeft = direction === "left";
  const faceRight = direction === "right";
  const faceUp = direction === "up";
  const side = faceLeft ? -1 : 1;
  const mask = "#ffffff";

  const colors = layer === "complete"
    ? hero
    : {
        hair: mask,
        skin: mask,
        outfit: mask,
        cloak: mask,
        accent: mask,
        weapon: mask,
        shadow: mask
      };
  const drawBase = layer === "complete";
  const wants = (name) => layer === "complete" || layer === name || layer.startsWith(`${name}:`);

  if (drawBase) {
    rect(canvas, ox + 8, oy + 35, 16, 3, rgba("#020617", 0.35));
    rect(canvas, ox + 13, oy + 14 - bob, 7, 17, hero.shadow);
    rect(canvas, ox + 11, oy + 20 - bob, 11, 14, hero.shadow);
    rect(canvas, ox + 10 + walk, oy + 31, 5, 5, "#07111f");
    rect(canvas, ox + 18 - walk, oy + 31, 5, 5, "#07111f");
    rect(canvas, ox + 11, oy + 7 - bob, 11, 10, "#07111f");
  }

  if (wants("cloak") && !faceUp) {
    drawWorldCloak(canvas, ox, oy - bob, layer.split(":")[1] ?? "starter-cloak", colors.cloak);
  }
  if (wants("outfit")) {
    drawWorldOutfit(canvas, ox, oy - bob, layer.split(":")[1] ?? "village-defender", colors.outfit, hero.classShape, faceUp);
  }
  if (wants("skin")) {
    rect(canvas, ox + 13, oy + 9 - bob, 7, 7, colors.skin);
    rect(canvas, ox + 9, oy + 22 - bob, 3, 4, colors.skin);
    rect(canvas, ox + 21, oy + 22 - bob, 3, 4, colors.skin);
  }
  if (wants("hair")) {
    drawWorldHair(canvas, ox, oy - bob, layer.split(":")[1] ?? "storm-swept", colors.hair, faceUp);
  }
  if (wants("accent")) {
    drawWorldAccent(canvas, ox, oy - bob, hero.classShape, colors.accent, side, faceUp, attacking, attackFrame);
  }
  if (wants("weapon")) {
    drawWorldWeapon(canvas, ox + runBoost, oy - bob, hero.classShape, colors.weapon, side, faceLeft || faceRight, attacking, attackFrame);
  }
}

function drawWorldHair(canvas, ox, oy, style, color, faceUp) {
  if (style === "soft-bob") {
    rect(canvas, ox + 11, oy + 7, 11, 4, color);
    rect(canvas, ox + 10, oy + 10, 4, 8, color);
    rect(canvas, ox + 19, oy + 10, 4, 8, color);
    return;
  }
  if (style === "crest") {
    rect(canvas, ox + 13, oy + 4, 6, 5, color);
    rect(canvas, ox + 11, oy + 8, 11, 4, color);
    rect(canvas, ox + 14, oy + 3, 3, 3, color);
    return;
  }
  rect(canvas, ox + 10, oy + 7, 12, 4, color);
  rect(canvas, ox + 11, oy + 10, 4, 5, color);
  if (!faceUp) {
    rect(canvas, ox + 18, oy + 6, 5, 4, color);
  }
}

function drawWorldOutfit(canvas, ox, oy, variant, color, shape, faceUp) {
  rect(canvas, ox + 12, oy + 18, 9, 13, color);
  if (variant !== "traveler") {
    rect(canvas, ox + 10, oy + 22, 13, 4, color);
  }
  if (variant === "ceremonial") {
    rect(canvas, ox + 11, oy + 18, 2, 10, "#ffffff");
    rect(canvas, ox + 20, oy + 18, 2, 10, "#ffffff");
  }
  if (shape === "launcher") {
    rect(canvas, ox + 10, oy + 19, 5, 11, "#2a1e18");
  }
  if (shape === "flask") {
    rect(canvas, ox + 20, oy + 21, 3, 6, "#ffffff");
  }
  if (faceUp) {
    rect(canvas, ox + 12, oy + 15, 9, 5, color);
  }
}

function drawWorldCloak(canvas, ox, oy, cloak, color) {
  if (cloak === "wing-cape") {
    rect(canvas, ox + 7, oy + 20, 6, 12, color);
    rect(canvas, ox + 20, oy + 20, 6, 12, color);
    return;
  }
  rect(canvas, ox + 9, oy + 17, 14, cloak === "long-cloak" ? 17 : 13, color);
  if (cloak === "long-cloak") {
    rect(canvas, ox + 11, oy + 31, 10, 3, color);
  }
}

function drawWorldAccent(canvas, ox, oy, shape, color, side, faceUp, attacking = false, attackFrame = 0) {
  rect(canvas, ox + 13, oy + 18, 7, 2, color);
  if (shape === "bow") {
    rect(canvas, ox + 22 + (attacking ? attackFrame - 1 : 0), oy + 13, 2, 12, color);
    rect(canvas, ox + 24, oy + 11, 2, 3, color);
  } else if (shape === "water-staff") {
    rect(canvas, ox + 8, oy + 12, 3, 3, color);
    rect(canvas, ox + 7, oy + 10, 2, 2, color);
  } else if (shape === "launcher") {
    rect(canvas, ox + 21, oy + 20, 5, 4, color);
  } else if (shape === "flask") {
    rect(canvas, ox + 22, oy + 20, 4, 6, color);
  } else {
    rect(canvas, ox + 8, oy + 11, 5, 5, color);
    rect(canvas, ox + 10, oy + 9, 1, 9, color);
  }
  if (faceUp) {
    rect(canvas, ox + 14 + side, oy + 12, 5, 2, color);
  }
}

function drawWorldWeapon(canvas, ox, oy, shape, color, side, sideFacing, attacking = false, attackFrame = 0) {
  if (shape === "bow") {
    const reach = attacking ? attackFrame + 1 : 0;
    rect(canvas, ox + (sideFacing ? 22 + reach : 23), oy + 10, 2, 17, color);
    rect(canvas, ox + 21, oy + 11, 2, 3, color);
    rect(canvas, ox + 21, oy + 24, 2, 3, color);
  } else if (shape === "launcher") {
    rect(canvas, ox + 21, oy + 17, 7, 5, color);
    rect(canvas, ox + 25, oy + 14, 3, 3, color);
  } else if (shape === "flask") {
    rect(canvas, ox + 23, oy + 19, 4, 7, color);
    rect(canvas, ox + 24, oy + 17, 2, 2, color);
  } else {
    rect(canvas, ox + 8, oy + 10, 3, 21, color);
    rect(canvas, ox + 6, oy + 9, 7, 3, color);
  }
  if (side < 0) {
    rect(canvas, ox + 5, oy + 17, 4, 3, color);
  }
}

function drawPortrait(hero, size, layer) {
  const canvas = createCanvas(size, size);
  const s = size / 96;
  const mask = "#ffffff";
  const colors = layer === "complete"
    ? hero
    : { hair: mask, skin: mask, outfit: mask, cloak: mask, accent: mask, weapon: mask, shadow: mask };
  const wants = (name) => layer === "complete" || layer === name || layer.startsWith(`${name}:`);

  if (layer === "complete") {
    px(canvas, s, 17, 74, 62, 10, rgba("#020617", 0.26));
    px(canvas, s, 25, 20, 46, 58, hero.shadow);
    px(canvas, s, 19, 39, 58, 42, hero.shadow);
  }
  if (wants("cloak")) {
    drawPortraitCloak(canvas, s, layer.split(":")[1] ?? "starter-cloak", colors.cloak);
  }
  if (wants("outfit")) {
    drawPortraitOutfit(canvas, s, layer.split(":")[1] ?? "village-defender", colors.outfit, hero.classShape);
  }
  if (wants("skin")) {
    px(canvas, s, 33, 21, 30, 28, colors.skin);
    px(canvas, s, 27, 58, 9, 13, colors.skin);
    px(canvas, s, 61, 58, 9, 13, colors.skin);
  }
  if (wants("hair")) {
    drawPortraitHair(canvas, s, layer.split(":")[1] ?? "storm-swept", colors.hair);
  }
  if (wants("accent")) {
    drawPortraitAccent(canvas, s, hero.classShape, colors.accent);
  }
  if (wants("weapon")) {
    drawPortraitWeapon(canvas, s, hero.classShape, colors.weapon);
  }
  if (layer === "complete") {
    px(canvas, s, 40, 34, 5, 4, "#07111f");
    px(canvas, s, 55, 34, 5, 4, "#07111f");
    px(canvas, s, 44, 43, 11, 3, rgba("#ffffff", 0.42));
  }
  return canvas;
}

function drawPortraitHair(canvas, s, style, color) {
  if (style === "soft-bob") {
    px(canvas, s, 28, 18, 41, 15, color);
    px(canvas, s, 24, 28, 13, 28, color);
    px(canvas, s, 60, 28, 13, 28, color);
    return;
  }
  if (style === "crest") {
    px(canvas, s, 40, 9, 18, 14, color);
    px(canvas, s, 29, 20, 39, 13, color);
    px(canvas, s, 47, 4, 7, 10, color);
    return;
  }
  px(canvas, s, 27, 17, 42, 14, color);
  px(canvas, s, 29, 28, 14, 19, color);
  px(canvas, s, 58, 14, 16, 13, color);
}

function drawPortraitOutfit(canvas, s, variant, color, shape) {
  px(canvas, s, 31, 52, 35, 31, color);
  px(canvas, s, 24, 62, 50, 10, color);
  if (variant === "traveler") {
    px(canvas, s, 30, 66, 36, 10, "#2f4156");
  }
  if (variant === "ceremonial") {
    px(canvas, s, 33, 54, 6, 26, "#ffffff");
    px(canvas, s, 58, 54, 6, 26, "#ffffff");
  }
  if (shape === "launcher") {
    px(canvas, s, 22, 53, 15, 29, "#2a1e18");
  }
}

function drawPortraitCloak(canvas, s, cloak, color) {
  if (cloak === "wing-cape") {
    px(canvas, s, 16, 47, 20, 36, color);
    px(canvas, s, 61, 47, 20, 36, color);
    return;
  }
  px(canvas, s, 22, 44, 52, cloak === "long-cloak" ? 42 : 34, color);
}

function drawPortraitAccent(canvas, s, shape, color) {
  px(canvas, s, 36, 52, 26, 6, color);
  if (shape === "bow") {
    px(canvas, s, 71, 28, 5, 43, color);
    px(canvas, s, 67, 26, 8, 8, color);
    px(canvas, s, 67, 65, 8, 8, color);
  } else if (shape === "water-staff") {
    px(canvas, s, 16, 19, 12, 12, color);
    px(canvas, s, 12, 16, 6, 6, color);
  } else if (shape === "launcher") {
    px(canvas, s, 66, 53, 20, 12, color);
  } else if (shape === "flask") {
    px(canvas, s, 68, 49, 14, 19, color);
  } else {
    px(canvas, s, 15, 20, 19, 19, color);
    px(canvas, s, 23, 14, 4, 31, color);
  }
}

function drawPortraitWeapon(canvas, s, shape, color) {
  if (shape === "bow") {
    px(canvas, s, 74, 22, 5, 54, color);
    px(canvas, s, 70, 23, 5, 9, color);
    px(canvas, s, 70, 67, 5, 9, color);
  } else if (shape === "launcher") {
    px(canvas, s, 66, 46, 23, 15, color);
    px(canvas, s, 80, 38, 8, 9, color);
  } else if (shape === "flask") {
    px(canvas, s, 69, 49, 13, 21, color);
    px(canvas, s, 72, 44, 7, 6, color);
  } else {
    px(canvas, s, 17, 23, 7, 56, color);
    px(canvas, s, 11, 20, 19, 8, color);
  }
}

function drawFallbackPortrait(size) {
  const canvas = createCanvas(size, size);
  const s = size / 96;
  px(canvas, s, 24, 23, 48, 55, "#111827");
  px(canvas, s, 30, 18, 36, 22, "#1f2937");
  px(canvas, s, 34, 39, 28, 29, "#2f3a4a");
  px(canvas, s, 38, 28, 6, 5, "#cbd5e1");
  px(canvas, s, 53, 28, 6, 5, "#cbd5e1");
  px(canvas, s, 25, 68, 46, 8, "#f3c969");
  return canvas;
}

function drawFallbackSheet(action) {
  const canvas = createCanvas(frame.width * frame.columns, frame.height * frame.rows);
  directions.forEach((_direction, row) => {
    sourceFrameNames.forEach((_anim, col) => {
      const ox = col * frame.width;
      const oy = row * frame.height;
      const bob = action === "idle" ? col % 2 : action === "attack" ? 0 : col % 2 === 0 ? 0 : -2;
      rect(canvas, ox + 16, oy + 56, 32, 4, rgba("#020617", 0.28));
      rect(canvas, ox + 24, oy + 18 + bob, 20, 34, "#111827");
      rect(canvas, ox + 26, oy + 14 + bob, 14, 14, "#1f2937");
      rect(canvas, ox + 25, oy + 51, 16, 3, "#f3c969");
    });
  });
  return canvas;
}

function drawStormActionSheet(action) {
  const source = decodePng(readFileSync(stormSources[action]));
  const canvas = createCanvas(frame.width * frame.columns, frame.height * frame.rows);
  directions.forEach((direction, row) => {
    const directionFrame = extractStormDirectionFrame(source, action, direction);
    for (let col = 0; col < frame.columns; col++) {
      const raw = action === "idle" ? directionFrame : extractStormFrame(source, action, row, col);
      const transform = normalizedFrameTransform(raw);
      blitNormalized(canvas, raw, transform, col * frame.width, row * frame.height);
    }
  });
  return canvas;
}

function extractStormDirectionFrame(source, action, direction) {
  if (action !== "idle") {
    return extractStormFrame(source, action, directions.indexOf(direction), 0);
  }
  const quadrantByDirection = {
    down: [0, 0],
    left: [1, 0],
    right: [0, 1],
    up: [1, 1]
  };
  const [row, col] = quadrantByDirection[direction];
  return extractStormCell(source, 2, 2, row, col);
}

function extractStormFrame(source, action, row, col) {
  return extractStormCell(source, action === "idle" ? 2 : 4, action === "idle" ? 2 : 4, row, col);
}

function extractStormCell(source, rows, columns, row, col) {
  const x0 = Math.floor((source.width / columns) * col);
  const x1 = Math.floor((source.width / columns) * (col + 1));
  const y0 = Math.floor((source.height / rows) * row);
  const y1 = Math.floor((source.height / rows) * (row + 1));
  const cell = createCanvas(x1 - x0, y1 - y0);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const sourceIndex = (y * source.width + x) * 4;
      const r = source.data[sourceIndex];
      const g = source.data[sourceIndex + 1];
      const b = source.data[sourceIndex + 2];
      const targetIndex = ((y - y0) * cell.width + (x - x0)) * 4;
      const greenScreen = g > 145 && r < 80 && b < 90 && g > r * 1.7 && g > b * 1.7;
      if (greenScreen) {
        continue;
      }
      cell.data[targetIndex] = r;
      cell.data[targetIndex + 1] = g;
      cell.data[targetIndex + 2] = b;
      cell.data[targetIndex + 3] = 255;
    }
  }
  return cell;
}

function normalizedFrameTransform(raw) {
  const bounds = alphaBounds(raw);
  if (!bounds) {
    return { bounds: { minX: 0, minY: 0, maxX: raw.width - 1, maxY: raw.height - 1 }, scale: 1, dx: 0, dy: 0 };
  }
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  const scale = Math.min(56 / width, 58 / height);
  const centerX = (bounds.minX + bounds.maxX + 1) / 2;
  const dx = Math.round(frame.width / 2 - centerX * scale);
  const baseline = Math.round(frame.height * origin.y);
  const dy = Math.round(baseline - (bounds.maxY + 1) * scale);
  return { bounds, scale, dx, dy };
}

function blitNormalized(target, raw, transform, ox, oy) {
  const { scale, dx, dy } = transform;
  for (let y = 0; y < raw.height; y++) {
    for (let x = 0; x < raw.width; x++) {
      const sourceIndex = (y * raw.width + x) * 4;
      const alpha = raw.data[sourceIndex + 3];
      if (alpha === 0) {
        continue;
      }
      const targetX = ox + Math.round(dx + x * scale);
      const targetY = oy + Math.round(dy + y * scale);
      const size = Math.max(1, Math.ceil(scale));
      for (let yy = 0; yy < size; yy++) {
        for (let xx = 0; xx < size; xx++) {
          const pxX = targetX + xx;
          const pxY = targetY + yy;
          if (pxX < ox || pxX >= ox + frame.width || pxY < oy || pxY >= oy + frame.height) {
            continue;
          }
          const targetIndex = (pxY * target.width + pxX) * 4;
          blend(target.data, targetIndex, raw.data[sourceIndex], raw.data[sourceIndex + 1], raw.data[sourceIndex + 2], alpha);
        }
      }
    }
  }
}

function alphaBounds(canvas) {
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (canvas.data[(y * canvas.width + x) * 4 + 3] === 0) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

function px(canvas, scale, x, y, w, h, color) {
  rect(canvas, Math.round(x * scale), Math.round(y * scale), Math.round(w * scale), Math.round(h * scale), color);
}

function rgba(hex, alpha) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function rect(canvas, x, y, w, h, color) {
  const [r, g, b, a] = parseColor(color);
  for (let yy = Math.max(0, y); yy < Math.min(canvas.height, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(canvas.width, x + w); xx++) {
      const i = (yy * canvas.width + xx) * 4;
      blend(canvas.data, i, r, g, b, a);
    }
  }
}

function blend(data, i, r, g, b, a) {
  if (a === 255) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
    return;
  }
  const srcA = a / 255;
  const dstA = data[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) return;
  data[i] = Math.round((r * srcA + data[i] * dstA * (1 - srcA)) / outA);
  data[i + 1] = Math.round((g * srcA + data[i + 1] * dstA * (1 - srcA)) / outA);
  data[i + 2] = Math.round((b * srcA + data[i + 2] * dstA * (1 - srcA)) / outA);
  data[i + 3] = Math.round(outA * 255);
}

function parseColor(color) {
  if (color.startsWith("rgba(")) {
    const parts = color.slice(5, -1).split(",").map((part) => Number(part.trim()));
    return [parts[0], parts[1], parts[2], Math.round(parts[3] * 255)];
  }
  return [...parseHex(color), 255];
}

function parseHex(hex) {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function createCanvas(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function writePng(path, canvas) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(canvas.width, canvas.height, canvas.data));
}

function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error("Unsupported PNG signature");
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
      if (data[8] !== 8 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
        throw new Error("Unsupported PNG compression/filter/interlace settings");
      }
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) {
    throw new Error(`Unsupported PNG color type: ${colorType}`);
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * 4);
  const previous = Buffer.alloc(stride);
  let inputOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[inputOffset++];
    const row = Buffer.from(raw.subarray(inputOffset, inputOffset + stride));
    inputOffset += stride;
    unfilterRow(row, previous, channels, filter);
    for (let x = 0; x < width; x++) {
      const sourceIndex = x * channels;
      const targetIndex = (y * width + x) * 4;
      pixels[targetIndex] = row[sourceIndex];
      pixels[targetIndex + 1] = row[sourceIndex + 1];
      pixels[targetIndex + 2] = row[sourceIndex + 2];
      pixels[targetIndex + 3] = channels === 4 ? row[sourceIndex + 3] : 255;
    }
    row.copy(previous);
  }
  return { width, height, data: pixels };
}

function unfilterRow(row, previous, channels, filter) {
  for (let i = 0; i < row.length; i++) {
    const left = i >= channels ? row[i - channels] : 0;
    const up = previous[i] ?? 0;
    const upLeft = i >= channels ? previous[i - channels] : 0;
    if (filter === 1) {
      row[i] = (row[i] + left) & 255;
    } else if (filter === 2) {
      row[i] = (row[i] + up) & 255;
    } else if (filter === 3) {
      row[i] = (row[i] + Math.floor((left + up) / 2)) & 255;
    } else if (filter === 4) {
      row[i] = (row[i] + paeth(left, up, upLeft)) & 255;
    } else if (filter !== 0) {
      throw new Error(`Unsupported PNG filter: ${filter}`);
    }
  }
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function heroPreviewHtml() {
  const actionList = actions.map((action) => `<button type="button" data-action="${action}">${action}</button>`).join("");
  const cards = heroes
    .map(
      (hero) => `<article>
        <h2>${hero.name}</h2>
        <div class="stage">
          <div class="playback" data-hero="${hero.id}"></div>
          <img class="grid-image" src="../${hero.id}/idle.png" alt="${hero.name} idle spritesheet" />
        </div>
        <dl>
          <div><dt>Hero</dt><dd>${hero.id}</dd></div>
          <div><dt>Sheet</dt><dd><code>idle.png / walk.png / run.png / attack.png</code></dd></div>
          <div><dt>Dimensions</dt><dd>${frame.width * frame.columns}x${frame.height * frame.rows}</dd></div>
          <div><dt>Frame</dt><dd>${frame.width}x${frame.height}</dd></div>
          <div><dt>Rows</dt><dd>${directions.join(", ")}</dd></div>
          <div><dt>Columns</dt><dd>4 animation frames</dd></div>
          <div><dt>Origin</dt><dd>${origin.x}, ${origin.y}</dd></div>
        </dl>
      </article>`
    )
    .join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SolTower Hero Sprite Standard Preview</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #07111d; color: #f5f7fb; }
      body { margin: 0; padding: 24px; background: #07111d; }
      header { display: grid; gap: 8px; margin: 0 0 20px; }
      h1, h2 { margin: 0; font-family: Georgia, serif; color: #fff4d6; }
      p { margin: 0; color: #b8c7da; max-width: 880px; }
      .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 24px; }
      button { border: 1px solid rgba(243, 201, 105, .45); border-radius: 8px; background: rgba(12, 20, 34, .9); color: #f5f7fb; padding: 8px 12px; text-transform: uppercase; letter-spacing: .08em; font-weight: 800; }
      button.active { background: linear-gradient(180deg, rgba(243, 201, 105, .28), rgba(48, 33, 11, .66)); color: #fff4d6; }
      main { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
      article { border: 1px solid rgba(243, 201, 105, .26); border-radius: 8px; background: rgba(12, 20, 34, .86); padding: 16px; display: grid; gap: 14px; }
      .stage { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: start; }
      .playback { width: 128px; height: 128px; image-rendering: pixelated; background-repeat: no-repeat; background-size: 512px 512px; border: 1px solid rgba(119, 212, 242, .25); border-radius: 8px; background-color: rgba(2, 6, 23, .65); }
      .grid-image { width: min(100%, 256px); image-rendering: pixelated; border: 1px solid rgba(243, 201, 105, .18); background-image: linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px); background-size: 64px 64px; }
      dl { display: grid; gap: 6px; margin: 0; }
      dl div { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 8px; }
      dt { color: #8fa4be; text-transform: uppercase; font-size: 11px; font-weight: 800; }
      dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
      code { color: #c7ecf7; }
      @media (max-width: 560px) { body { padding: 16px; } .stage { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <header>
      <h1>SolTower Hero Sprite Standard Preview</h1>
      <p>All Hero animation sheets use 64x64 transparent frames, 4 direction rows, 4 animation columns, and Phaser origin ${origin.x}, ${origin.y}.</p>
      <div class="toolbar">${actionList}</div>
    </header>
    <main>${cards}</main>
    <script>
      const actions = ${JSON.stringify(actions)};
      let action = "idle";
      let frame = 0;
      const buttons = [...document.querySelectorAll("button[data-action]")];
      function render() {
        buttons.forEach((button) => button.classList.toggle("active", button.dataset.action === action));
        document.querySelectorAll(".playback").forEach((el) => {
          el.style.backgroundImage = "url('../" + el.dataset.hero + "/" + action + ".png')";
          el.style.backgroundPosition = "-" + (frame * 128) + "px 0";
        });
        document.querySelectorAll(".grid-image").forEach((img) => {
          const hero = img.closest("article").querySelector(".playback").dataset.hero;
          img.src = "../" + hero + "/" + action + ".png";
        });
      }
      buttons.forEach((button) => button.addEventListener("click", () => { action = button.dataset.action; frame = 0; render(); }));
      setInterval(() => { frame = (frame + 1) % 4; render(); }, 220);
      render();
    </script>
  </body>
</html>
`;
}

function encodePng(width, height, rgbaData) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
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
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

main();
