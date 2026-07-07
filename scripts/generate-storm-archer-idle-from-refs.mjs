import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const heroId = process.argv[2] ?? "storm-archer";
const heroRoot = join(root, "apps/web/public/assets/soltower/heroes", heroId);
const outputPath = join(heroRoot, "idle.png");
const frame = { width: 64, height: 64, columns: 4, rows: 4 };
const idleSourceNames =
  heroId === "tide-mage"
    ? [
        ["down", "walk-bottom.png"],
        ["left", "walk-left.png"],
        ["right", "walk-right.png"],
        ["up", "walk-top.png"]
      ]
    : [
        ["down", "walk-bottom.png"],
        ["left", "walk-top-left.png"],
        ["right", "walk-right.png"],
        ["up", "walk-top.png"]
      ];
const idleSources = idleSourceNames.map(([row, fileName]) => ({ row, path: join(heroRoot, fileName) }));

function main() {
  const sheet = createCanvas(frame.width * frame.columns, frame.height * frame.rows);

  idleSources.forEach((source, row) => {
    const reference = decodePng(readFileSync(source.path));
    const cell = normalizeReferenceFrame(reference);
    for (let col = 0; col < frame.columns; col += 1) {
      blitFrame(sheet, cell, col * frame.width, row * frame.height);
    }
  });

  writeFileSync(outputPath, encodePng(sheet.width, sheet.height, sheet.data));
  console.info(`Generated ${outputPath}`);
}

function normalizeReferenceFrame(source) {
  const mask = extractBlackKeyedMask(source);
  const bounds = maskBounds(mask, source.width, source.height);
  const canvas = createCanvas(frame.width, frame.height);
  const maxWidth = 58;
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
      const a = source.data[index + 3];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (a > 0 && (max > 12 || max - min > 14)) {
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
  const centerLeft = Math.floor(width * 0.12);
  const centerRight = Math.ceil(width * 0.88);
  const centerTop = Math.floor(height * 0.06);
  const centerBottom = Math.ceil(height * 0.96);

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
        const neighbors = [current - 1, current + 1, current - width, current + width];
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

function blitFrame(targetCanvas, cell, ox, oy) {
  for (let y = 0; y < cell.height; y += 1) {
    for (let x = 0; x < cell.width; x += 1) {
      const sourceIndex = (y * cell.width + x) * 4;
      const alpha = cell.data[sourceIndex + 3];
      if (alpha === 0) {
        continue;
      }
      const targetIndex = ((oy + y) * targetCanvas.width + ox + x) * 4;
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
