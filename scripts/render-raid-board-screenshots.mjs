import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(root, "apps/web/public");
const outputRoot = join(root, "tmp");
const asset = (path) => join(publicRoot, path);

const stageAssets = [
  ["1-1", "SPROUTLING PATH", "/assets/raids/stages/map1-01-sproutling-path.png"],
  ["1-2", "CINDER CROSSING", "/assets/raids/stages/map1-02-cinder-crossing.png"],
  ["1-3", "BRIAR HOLLOW", "/assets/raids/stages/map1-03-briar-hollow.png"],
  ["1-4", "GLASS BEETLE", "/assets/raids/stages/map1-04-glass-beetle-grotto.png"],
  ["1-5", "MISTWOOD WATCH", "/assets/raids/stages/map1-05-mistwood-watch.png"],
  ["1-10", "SOLHEART SENTINEL", "/assets/raids/stages/map1-10-solheart-sentinel.png"]
];

const enemyAssets = [
  ["SPROUTLING", "/assets/raids/enemies/sproutling.png"],
  ["CINDER MOTE", "/assets/raids/enemies/cinder-mote.png"],
  ["BRIAR IMP", "/assets/raids/enemies/briar-imp.png"],
  ["GLASS BEETLE", "/assets/raids/enemies/glass-beetle.png"],
  ["MIST WISP", "/assets/raids/enemies/mist-wisp.png"],
  ["STORM WARDEN", "/assets/raids/enemies/storm-warden.png"],
  ["SHARDLING", "/assets/raids/enemies/shardling.png"]
];

const rewardAssets = [
  ["GOLD", "/assets/raids/rewards/earned-gold.png"],
  ["XP", "/assets/raids/rewards/xp.png"],
  ["SHARD", "/assets/raids/rewards/tower-shard.png"],
  ["GEAR", "/assets/raids/rewards/gear-chest.png"]
];

function main() {
  mkdirSync(outputRoot, { recursive: true });
  const grid = drawGridScreenshot();
  const selected = drawSelectedScreenshot();
  writeFileSync(join(outputRoot, "raid-board-stage-grid.png"), encodePng(grid.width, grid.height, grid.data));
  writeFileSync(join(outputRoot, "raid-board-selected-stage.png"), encodePng(selected.width, selected.height, selected.data));
}

function drawGridScreenshot() {
  const c = createCanvas(1200, 780, color("#08101c"));
  drawPanel(c, 26, 24, 1148, 732, "#0d1728", "#d8af4f");
  drawText(c, "RAIDS", 58, 58, 2, color("#f6c453"));
  drawText(c, "CHOOSE A TOWER RUN", 58, 84, 4, color("#f8e7b2"));
  drawText(c, "STAGE THUMBNAILS GENERATED LOCAL PNG ASSETS", 58, 132, 2, color("#b8c7d9"));

  const banner = decodePng(readFileSync(asset("/assets/raids/chapters/solheart-outskirts-banner.png")));
  drawImage(c, banner, 720, 52, 390, 134);
  drawPanel(c, 54, 205, 1092, 308, "#101b2d", "#40516a");
  drawText(c, "MAP 1: SOLHEART OUTSKIRTS", 78, 226, 3, color("#f8e7b2"));
  drawText(c, "PAGE 1 / 2", 978, 230, 2, color("#d7e5f5"));

  const cardW = 202;
  for (let index = 0; index < 5; index += 1) {
    const [number, name, path] = stageAssets[index];
    const x = 78 + index * (cardW + 12);
    drawPanel(c, x, 270, cardW, 204, index === 0 ? "#172238" : "#111b2e", index === 0 ? "#f6c453" : "#40516a");
    drawImage(c, decodePng(readFileSync(asset(path))), x + 10, 282, cardW - 20, 102);
    drawText(c, number, x + 12, 400, 3, color("#f8e7b2"));
    drawText(c, name, x + 12, 432, 2, color("#dbeafe"));
    drawText(c, index < 3 ? "CLEARED" : "OPEN", x + 12, 456, 2, color(index < 3 ? "#9ff0c8" : "#a6f7ff"));
  }

  drawPanel(c, 54, 538, 1092, 160, "#0f1a2b", "#40516a");
  drawText(c, "SELECTED STAGE PREVIEW", 78, 562, 2, color("#f6c453"));
  drawImage(c, decodePng(readFileSync(asset(stageAssets[0][2]))), 78, 592, 220, 124);
  for (let i = 0; i < 5; i += 1) {
    const [label, path] = enemyAssets[i];
    const x = 338 + i * 104;
    drawImage(c, decodePng(readFileSync(asset(path))), x, 594, 70, 70);
    drawText(c, label, x - 6, 674, 1, color("#dbeafe"));
  }
  return c;
}

function drawSelectedScreenshot() {
  const c = createCanvas(1200, 760, color("#08101c"));
  drawPanel(c, 28, 22, 1144, 714, "#0d1728", "#d8af4f");
  drawText(c, "SELECTED STAGE", 58, 58, 2, color("#f6c453"));
  drawText(c, "1-10 SOLHEART SENTINEL", 58, 84, 4, color("#f8e7b2"));

  drawPanel(c, 58, 148, 548, 368, "#101b2d", "#40516a");
  drawImage(c, decodePng(readFileSync(asset(stageAssets[5][2]))), 82, 174, 500, 282);
  drawText(c, "LARGE STAGE PREVIEW", 82, 478, 2, color("#dbeafe"));

  drawPanel(c, 642, 148, 474, 368, "#101b2d", "#40516a");
  drawText(c, "WAVES AND ENEMIES", 668, 176, 2, color("#f6c453"));
  const shownEnemies = [enemyAssets[5], enemyAssets[6], ["SOLHEART BOSS", "/assets/raids/bosses/solheart-sentinel.png"]];
  for (let index = 0; index < shownEnemies.length; index += 1) {
    const [label, path] = shownEnemies[index];
    const y = 220 + index * 92;
    drawPanel(c, 668, y, 410, 72, index === 2 ? "#201b19" : "#111b2e", index === 2 ? "#f6c453" : "#40516a");
    drawImage(c, decodePng(readFileSync(asset(path))), 682, y + 8, 56, 56);
    drawText(c, index === 2 ? "BOSS WAVE" : `WAVE ${index + 1}`, 756, y + 16, 2, color(index === 2 ? "#f8e7b2" : "#a6f7ff"));
    drawText(c, label, 756, y + 44, 2, color("#dbeafe"));
  }

  drawPanel(c, 58, 548, 1058, 132, "#101b2d", "#40516a");
  drawText(c, "REWARD ICONS", 82, 572, 2, color("#f6c453"));
  for (let index = 0; index < rewardAssets.length; index += 1) {
    const [label, path] = rewardAssets[index];
    const x = 82 + index * 134;
    drawImage(c, decodePng(readFileSync(asset(path))), x, 604, 56, 56);
    drawText(c, label, x + 68, 622, 2, color("#dbeafe"));
  }
  drawText(c, "BOSS PORTRAIT AND BADGE VISIBLE", 700, 622, 2, color("#f8e7b2"));
  return c;
}

function drawPanel(c, x, y, width, height, fill, border) {
  fillRect(c, x, y, width, height, color(fill));
  strokeRect(c, x, y, width, height, color(border, 210));
  fillRect(c, x + 2, y + 2, width - 4, 2, color("#ffffff", 24));
}

function decodePng(buffer) {
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const chunks = [];
  let offset = 33;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IDAT") chunks.push(data);
    if (type === "IEND") break;
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const data = new Uint8Array(width * height * 4);
  const stride = width * 4;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    if (filter !== 0) throw new Error("Only filter type 0 PNG assets are supported by this preview renderer");
    raw.copy(data, y * stride, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  }
  return { width, height, data };
}

function drawImage(target, source, dx, dy, dw, dh) {
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const sx = Math.floor((x / dw) * source.width);
      const sy = Math.floor((y / dh) * source.height);
      const index = (sy * source.width + sx) * 4;
      putPixel(target, dx + x, dy + y, [
        source.data[index],
        source.data[index + 1],
        source.data[index + 2],
        source.data[index + 3]
      ]);
    }
  }
}

const font = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "A": ["111", "101", "111", "101", "101"],
  "B": ["110", "101", "110", "101", "110"],
  "C": ["111", "100", "100", "100", "111"],
  "D": ["110", "101", "101", "101", "110"],
  "E": ["111", "100", "110", "100", "111"],
  "F": ["111", "100", "110", "100", "100"],
  "G": ["111", "100", "101", "101", "111"],
  "H": ["101", "101", "111", "101", "101"],
  "I": ["111", "010", "010", "010", "111"],
  "J": ["001", "001", "001", "101", "111"],
  "K": ["101", "101", "110", "101", "101"],
  "L": ["100", "100", "100", "100", "111"],
  "M": ["101", "111", "111", "101", "101"],
  "N": ["101", "111", "111", "111", "101"],
  "O": ["111", "101", "101", "101", "111"],
  "P": ["111", "101", "111", "100", "100"],
  "Q": ["111", "101", "101", "111", "001"],
  "R": ["111", "101", "111", "110", "101"],
  "S": ["111", "100", "111", "001", "111"],
  "T": ["111", "010", "010", "010", "010"],
  "U": ["101", "101", "101", "101", "111"],
  "V": ["101", "101", "101", "101", "010"],
  "W": ["101", "101", "111", "111", "101"],
  "X": ["101", "101", "010", "101", "101"],
  "Y": ["101", "101", "010", "010", "010"],
  "Z": ["111", "001", "010", "100", "111"],
  "-": ["000", "000", "111", "000", "000"],
  ":": ["0", "1", "0", "1", "0"],
  "/": ["001", "001", "010", "100", "100"],
  " ": ["000", "000", "000", "000", "000"]
};

function drawText(c, text, x, y, scale, rgba) {
  let cursor = x;
  for (const character of text.toUpperCase()) {
    const glyph = font[character] ?? font[" "];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] === "1") fillRect(c, cursor + col * scale, y + row * scale, scale, scale, rgba);
      }
    }
    cursor += (glyph[0].length + 1) * scale;
  }
}

function createCanvas(width, height, fill = [0, 0, 0, 0]) {
  const canvas = { width, height, data: new Uint8Array(width * height * 4) };
  if (fill[3] > 0) fillRect(canvas, 0, 0, width, height, fill);
  return canvas;
}

function color(hex, alpha = 255) {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
    alpha
  ];
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
    for (let xx = Math.round(x); xx < Math.round(x + width); xx += 1) putPixel(canvas, xx, yy, rgba);
  }
}

function strokeRect(canvas, x, y, width, height, rgba) {
  fillRect(canvas, x, y, width, 1, rgba);
  fillRect(canvas, x, y + height - 1, width, 1, rgba);
  fillRect(canvas, x, y, 1, height, rgba);
  fillRect(canvas, x + width - 1, y, 1, height, rgba);
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
