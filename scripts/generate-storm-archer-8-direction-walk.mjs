import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const heroRoot = join(root, "apps/web/public/assets/soltower/heroes/storm-archer");
const inputPath = join(heroRoot, "profile.png");
const outputPath = join(heroRoot, "walk-8dir.png");
const frame = { width: 64, height: 64, columns: 4, rows: 8 };
const rowOrder = [
  "top-left",
  "left",
  "bottom-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom"
];
const videoRowSources = [
  { direction: "top-left", path: join(heroRoot, "walk-top-left.mp4") },
  { direction: "left", path: join(heroRoot, "walk-left.mp4") },
  { direction: "bottom-left", path: join(heroRoot, "walk-bottom-left.mp4") },
  { direction: "top", path: join(heroRoot, "walk-top.mp4") },
  { direction: "top-right", path: join(heroRoot, "walk-top-right.mp4"), frames: [0, 6, 12, 18] },
  { direction: "right", path: join(heroRoot, "walk-right.mp4"), frames: [0, 6, 12, 18] },
  { direction: "bottom-right", path: join(heroRoot, "walk-bottom-right.mp4"), frames: [0, 6, 12, 18] },
  { direction: "bottom", path: join(heroRoot, "walk-bottom.mp4"), frames: [0, 6, 12, 18] }
];
const walkOffsets = [
  { x: -1, y: 0, cape: -1 },
  { x: 0, y: -1, cape: 1 },
  { x: 1, y: 0, cape: -1 },
  { x: 0, y: 1, cape: 1 }
];

function main() {
  const profile = decodePng(readFileSync(inputPath));
  const extracted = extractCharacter(profile);
  const target = createCanvas(frame.width * frame.columns, frame.height * frame.rows);

  rowOrder.forEach((direction, row) => {
    walkOffsets.forEach((offset, col) => {
      const cell = drawWalkFrame(extracted, direction, offset);
      blitFrame(target, cell, col * frame.width, row * frame.height);
    });
  });

  for (const source of videoRowSources) {
    if (existsSync(source.path)) {
      applyVideoRow(target, source);
    }
  }

  writeFileSync(outputPath, encodePng(target.width, target.height, target.data));
}

function applyVideoRow(sheet, source) {
  const row = rowOrder.indexOf(source.direction);
  if (row === -1) {
    throw new Error(`Unsupported video row direction: ${source.direction}`);
  }
  const frames = extractVideoFrames(source.path, source.frames ?? [12, 48, 84, 120]);
  for (let col = 0; col < frame.columns; col += 1) {
    clearFrame(sheet, col * frame.width, row * frame.height);
    const cell = normalizeVideoWalkFrame(frames[col]);
    blitFrame(sheet, cell, col * frame.width, row * frame.height);
  }
}

function extractVideoFrames(videoPath, indexes) {
  const scratch = mkdtempSync(join(tmpdir(), "soltower-storm-archer-"));
  try {
    const select = `select=${indexes.map((index) => `eq(n\\,${index})`).join("+")}`;
    execFileSync("ffmpeg", ["-y", "-i", videoPath, "-vf", select, "-fps_mode", "passthrough", join(scratch, "frame-%02d.png")], {
      stdio: "ignore"
    });
    return indexes.map((_, index) => decodePng(readFileSync(join(scratch, `frame-${String(index + 1).padStart(2, "0")}.png`))));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function normalizeVideoWalkFrame(source) {
  const mask = extractBlackKeyedMask(source);
  const bounds = maskBounds(mask, source.width, source.height);
  const canvas = createCanvas(frame.width, frame.height);
  const maxWidth = 50;
  const maxHeight = 61;
  const scale = Math.min(maxWidth / bounds.width, maxHeight / bounds.height);
  const targetWidth = Math.max(1, Math.round(bounds.width * scale));
  const targetHeight = Math.max(1, Math.round(bounds.height * scale));
  const x = Math.round((frame.width - targetWidth) / 2);
  const y = 63 - targetHeight;

  for (let ty = 0; ty < targetHeight; ty += 1) {
    for (let tx = 0; tx < targetWidth; tx += 1) {
      const sx = bounds.x + Math.min(bounds.width - 1, Math.floor((tx / targetWidth) * bounds.width));
      const sy = bounds.y + Math.min(bounds.height - 1, Math.floor((ty / targetHeight) * bounds.height));
      if (!mask[sy * source.width + sx]) {
        continue;
      }
      const sourceIndex = (sy * source.width + sx) * 4;
      const targetX = x + tx;
      const targetY = y + ty;
      if (targetX < 0 || targetX >= canvas.width || targetY < 0 || targetY >= canvas.height) {
        continue;
      }
      const targetIndex = (targetY * canvas.width + targetX) * 4;
      canvas.data[targetIndex] = quantize(source.data[sourceIndex], 8);
      canvas.data[targetIndex + 1] = quantize(source.data[sourceIndex + 1], 8);
      canvas.data[targetIndex + 2] = quantize(source.data[sourceIndex + 2], 8);
      canvas.data[targetIndex + 3] = 255;
    }
  }

  return canvas;
}

function extractBlackKeyedMask(source) {
  const seed = new Uint8Array(source.width * source.height);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = (y * source.width + x) * 4;
      const r = source.data[index];
      const g = source.data[index + 1];
      const b = source.data[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 12 || max - min > 14) {
        seed[y * source.width + x] = 1;
      }
    }
  }
  return growMask(centerForegroundMask(seed, source.width, source.height), source.width, source.height, 2);
}

function centerForegroundMask(seed, width, height) {
  const visited = new Uint8Array(seed.length);
  const kept = new Uint8Array(seed.length);
  const queue = [];
  const component = [];
  const centerLeft = Math.floor(width * 0.18);
  const centerRight = Math.ceil(width * 0.82);
  const centerTop = Math.floor(height * 0.08);
  const centerBottom = Math.ceil(height * 0.94);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!seed[start] || visited[start]) {
        continue;
      }
      queue.length = 0;
      component.length = 0;
      queue.push(start);
      visited[start] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        component.push(current);
        const cx = current % width;
        const cy = Math.floor(current / width);
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        const neighbors = [
          current - 1,
          current + 1,
          current - width,
          current + width
        ];
        for (const next of neighbors) {
          const nx = next % width;
          const ny = Math.floor(next / width);
          const wrapsRow = Math.abs(nx - cx) > 1;
          if (next < 0 || next >= seed.length || wrapsRow || Math.abs(ny - cy) > 1 || !seed[next] || visited[next]) {
            continue;
          }
          visited[next] = 1;
          queue.push(next);
        }
      }

      const touchesEdge = minX <= 1 || maxX >= width - 2 || minY <= 1 || maxY >= height - 2;
      const inCharacterArea = maxX >= centerLeft && minX <= centerRight && maxY >= centerTop && minY <= centerBottom;
      if (!touchesEdge && inCharacterArea && component.length > 8) {
        for (const index of component) {
          kept[index] = 1;
        }
      }
    }
  }

  return kept;
}

function extractCharacter(profile) {
  const seedMask = new Uint8Array(profile.width * profile.height);
  for (let y = 0; y < profile.height; y += 1) {
    for (let x = 0; x < profile.width; x += 1) {
      const i = (y * profile.width + x) * 4;
      const r = profile.data[i];
      const g = profile.data[i + 1];
      const b = profile.data[i + 2];
      const a = profile.data[i + 3];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max - min;
      const colorful = saturation > 26;
      const deepBlue = b > r + 18 && b > g - 8;
      const warmGear = r > b + 22 && g > b + 6;
      const darkOutline = max < 62 && y > 150 && y < 860 && x > 180 && x < 820;
      if (a > 0 && (colorful || deepBlue || warmGear || darkOutline)) {
        seedMask[y * profile.width + x] = 1;
      }
    }
  }
  const mask = growMask(seedMask, profile.width, profile.height, 4);
  const bounds = maskBounds(mask, profile.width, profile.height);
  const crop = createCanvas(bounds.width, bounds.height);
  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const sourceX = bounds.x + x;
      const sourceY = bounds.y + y;
      if (!mask[sourceY * profile.width + sourceX]) {
        continue;
      }
      const sourceIndex = (sourceY * profile.width + sourceX) * 4;
      const targetIndex = (y * crop.width + x) * 4;
      crop.data[targetIndex] = quantize(profile.data[sourceIndex], 8);
      crop.data[targetIndex + 1] = quantize(profile.data[sourceIndex + 1], 8);
      crop.data[targetIndex + 2] = quantize(profile.data[sourceIndex + 2], 8);
      crop.data[targetIndex + 3] = 255;
    }
  }
  return crop;
}

function drawWalkFrame(character, direction, offset) {
  const canvas = createCanvas(frame.width, frame.height);
  const targetWidth = direction.includes("left") || direction.includes("right") ? 43 : 46;
  const scale = targetWidth / character.width;
  const targetHeight = Math.round(character.height * scale);
  const baseline = 58;
  const x = Math.round((frame.width - targetWidth) / 2 + directionalX(direction) + offset.x);
  const y = baseline - targetHeight + offset.y;
  const transformed = transformCharacter(character, direction, offset);
  nearestBlit(canvas, transformed, x, y, targetWidth, targetHeight);
  cleanupFootPixels(canvas);
  return canvas;
}

function transformCharacter(character, direction, offset) {
  const mirrored = direction.includes("left") || direction === "top-left" || direction === "bottom-left";
  const canvas = createCanvas(character.width, character.height);
  for (let y = 0; y < character.height; y += 1) {
    for (let x = 0; x < character.width; x += 1) {
      const sourceX = mirrored ? character.width - 1 - x : x;
      const sourceIndex = (y * character.width + sourceX) * 4;
      const alpha = character.data[sourceIndex + 3];
      if (alpha === 0) {
        continue;
      }
      const lowerBody = y > character.height * 0.68;
      const capeZone = y > character.height * 0.42 && x > character.width * 0.62;
      const targetX = x + (lowerBody ? offset.x : 0) + (capeZone ? offset.cape : 0);
      const targetY = y + (lowerBody ? Math.abs(offset.x) : 0);
      if (targetX < 0 || targetX >= canvas.width || targetY < 0 || targetY >= canvas.height) {
        continue;
      }
      const targetIndex = (targetY * canvas.width + targetX) * 4;
      canvas.data[targetIndex] = character.data[sourceIndex];
      canvas.data[targetIndex + 1] = character.data[sourceIndex + 1];
      canvas.data[targetIndex + 2] = character.data[sourceIndex + 2];
      canvas.data[targetIndex + 3] = alpha;
    }
  }
  if (direction === "top" || direction.startsWith("top-")) {
    coverFaceWithHairAndCape(canvas);
  }
  return canvas;
}

function coverFaceWithHairAndCape(canvas) {
  const hair = [18, 64, 154, 255];
  const cloak = [9, 45, 116, 255];
  fillRect(canvas, Math.round(canvas.width * 0.34), Math.round(canvas.height * 0.22), Math.round(canvas.width * 0.32), Math.round(canvas.height * 0.14), hair);
  fillRect(canvas, Math.round(canvas.width * 0.28), Math.round(canvas.height * 0.42), Math.round(canvas.width * 0.46), Math.round(canvas.height * 0.26), cloak);
}

function nearestBlit(target, source, ox, oy, width, height) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor((x / width) * source.width));
      const sy = Math.min(source.height - 1, Math.floor((y / height) * source.height));
      const sourceIndex = (sy * source.width + sx) * 4;
      const alpha = source.data[sourceIndex + 3];
      if (alpha === 0) {
        continue;
      }
      const tx = ox + x;
      const ty = oy + y;
      if (tx < 0 || tx >= target.width || ty < 0 || ty >= target.height) {
        continue;
      }
      const targetIndex = (ty * target.width + tx) * 4;
      target.data[targetIndex] = source.data[sourceIndex];
      target.data[targetIndex + 1] = source.data[sourceIndex + 1];
      target.data[targetIndex + 2] = source.data[sourceIndex + 2];
      target.data[targetIndex + 3] = alpha;
    }
  }
}

function cleanupFootPixels(canvas) {
  for (let y = 59; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      canvas.data[(y * canvas.width + x) * 4 + 3] = 0;
    }
  }
}

function clearFrame(targetCanvas, ox, oy) {
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const index = ((oy + y) * targetCanvas.width + ox + x) * 4;
      targetCanvas.data[index] = 0;
      targetCanvas.data[index + 1] = 0;
      targetCanvas.data[index + 2] = 0;
      targetCanvas.data[index + 3] = 0;
    }
  }
}

function directionalX(direction) {
  if (direction.includes("left")) return -2;
  if (direction.includes("right")) return 2;
  return 0;
}

function growMask(seed, width, height, radius) {
  const grown = new Uint8Array(seed.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!seed[y * width + x]) {
        continue;
      }
      for (let yy = -radius; yy <= radius; yy += 1) {
        for (let xx = -radius; xx <= radius; xx += 1) {
          const tx = x + xx;
          const ty = y + yy;
          if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
            grown[ty * width + tx] = 1;
          }
        }
      }
    }
  }
  return grown;
}

function maskBounds(mask, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function quantize(value, step) {
  return Math.max(0, Math.min(255, Math.round(value / step) * step));
}

function fillRect(canvas, x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      if (xx < 0 || xx >= canvas.width || yy < 0 || yy >= canvas.height) {
        continue;
      }
      const index = (yy * canvas.width + xx) * 4;
      canvas.data[index] = color[0];
      canvas.data[index + 1] = color[1];
      canvas.data[index + 2] = color[2];
      canvas.data[index + 3] = color[3];
    }
  }
}

function blitFrame(targetCanvas, cell, ox, oy) {
  for (let y = 0; y < cell.height; y += 1) {
    for (let x = 0; x < cell.width; x += 1) {
      const sourceIndex = (y * cell.width + x) * 4;
      const alpha = cell.data[sourceIndex + 3];
      if (alpha === 0) {
        continue;
      }
      const tx = ox + x;
      const ty = oy + y;
      const targetIndex = (ty * targetCanvas.width + tx) * 4;
      targetCanvas.data[targetIndex] = cell.data[sourceIndex];
      targetCanvas.data[targetIndex + 1] = cell.data[sourceIndex + 1];
      targetCanvas.data[targetIndex + 2] = cell.data[sourceIndex + 2];
      targetCanvas.data[targetIndex + 3] = alpha;
    }
  }
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
        throw new Error("Unsupported PNG settings");
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
  for (let y = 0; y < height; y += 1) {
    const filter = raw[inputOffset++];
    const row = Buffer.from(raw.subarray(inputOffset, inputOffset + stride));
    inputOffset += stride;
    unfilterRow(row, previous, channels, filter);
    for (let x = 0; x < width; x += 1) {
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
  for (let i = 0; i < row.length; i += 1) {
    const left = i >= channels ? row[i - channels] : 0;
    const up = previous[i] ?? 0;
    const upLeft = i >= channels ? previous[i - channels] : 0;
    if (filter === 1) row[i] = (row[i] + left) & 255;
    else if (filter === 2) row[i] = (row[i] + up) & 255;
    else if (filter === 3) row[i] = (row[i] + Math.floor((left + up) / 2)) & 255;
    else if (filter === 4) row[i] = (row[i] + paeth(left, up, upLeft)) & 255;
    else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);
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

function createCanvas(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
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
  for (let k = 0; k < 8; k += 1) {
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
