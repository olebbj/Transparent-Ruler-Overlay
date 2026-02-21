#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "icons");
const SIZES = [16, 32, 48, 128];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createBuffer(width, height) {
  return new Uint8Array(width * height * 4);
}

function setPixel(buffer, width, x, y, rgba) {
  if (x < 0 || y < 0 || x >= width) {
    return;
  }
  const idx = (y * width + x) * 4;
  buffer[idx] = rgba[0];
  buffer[idx + 1] = rgba[1];
  buffer[idx + 2] = rgba[2];
  buffer[idx + 3] = rgba[3];
}

function fillRect(buffer, width, x, y, w, h, rgba) {
  const xStart = Math.floor(x);
  const yStart = Math.floor(y);
  const xEnd = Math.ceil(x + w);
  const yEnd = Math.ceil(y + h);

  for (let py = yStart; py < yEnd; py += 1) {
    for (let px = xStart; px < xEnd; px += 1) {
      setPixel(buffer, width, px, py, rgba);
    }
  }
}

function fillRoundedRect(buffer, width, height, x, y, w, h, r, rgba) {
  const xStart = Math.floor(x);
  const yStart = Math.floor(y);
  const xEnd = Math.ceil(x + w);
  const yEnd = Math.ceil(y + h);
  const radius = Math.max(0, Math.floor(r));

  for (let py = yStart; py < yEnd; py += 1) {
    for (let px = xStart; px < xEnd; px += 1) {
      if (px < 0 || py < 0 || px >= width || py >= height) {
        continue;
      }

      const nx = clamp(px, xStart + radius, xEnd - radius - 1);
      const ny = clamp(py, yStart + radius, yEnd - radius - 1);
      const dx = px - nx;
      const dy = py - ny;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(buffer, width, px, py, rgba);
      }
    }
  }
}

function drawIcon(size) {
  const buffer = createBuffer(size, size);
  const frameRadius = Math.max(2, Math.round(size * 0.2));
  const margin = Math.max(1, Math.round(size * 0.12));
  const rulerThickness = Math.max(2, Math.round(size * 0.2));

  const bg = [12, 88, 190, 255];
  const surface = [244, 248, 253, 235];
  const tick = [26, 39, 56, 255];
  const border = [8, 57, 124, 255];

  fillRoundedRect(buffer, size, size, 0, 0, size, size, frameRadius, bg);
  fillRoundedRect(buffer, size, size, 1, 1, size - 2, size - 2, frameRadius - 1, border);
  fillRoundedRect(
    buffer,
    size,
    size,
    margin,
    margin,
    size - margin * 2,
    size - margin * 2,
    Math.max(2, frameRadius - margin),
    surface
  );

  fillRect(buffer, size, margin, margin, size - margin * 2, rulerThickness, [255, 255, 255, 230]);
  fillRect(buffer, size, margin, margin, rulerThickness, size - margin * 2, [255, 255, 255, 230]);

  const tickStep = Math.max(2, Math.round(size * 0.11));
  for (let x = margin + rulerThickness; x < size - margin; x += tickStep) {
    const isMajor = (x - margin) % (tickStep * 2) === 0;
    const tickLen = isMajor
      ? Math.max(2, Math.round(rulerThickness * 0.82))
      : Math.max(1, Math.round(rulerThickness * 0.55));
    fillRect(buffer, size, x, margin + 1, 1, tickLen, tick);
  }

  for (let y = margin + rulerThickness; y < size - margin; y += tickStep) {
    const isMajor = (y - margin) % (tickStep * 2) === 0;
    const tickLen = isMajor
      ? Math.max(2, Math.round(rulerThickness * 0.82))
      : Math.max(1, Math.round(rulerThickness * 0.55));
    fillRect(buffer, size, margin + 1, y, tickLen, 1, tick);
  }

  return buffer;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  const crcBuffer = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcBuffer);
  const crcOut = Buffer.alloc(4);
  crcOut.writeUInt32BE(crc, 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcOut]);
}

function encodePng(width, height, rgbaData) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (stride + 1);
    const srcOffset = y * stride;
    raw[rawOffset] = 0;
    Buffer.from(rgbaData.subarray(srcOffset, srcOffset + stride)).copy(raw, rawOffset + 1);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function writeIcons() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const size of SIZES) {
    const rgba = drawIcon(size);
    const png = encodePng(size, size, rgba);
    const outPath = path.join(OUT_DIR, `icon${size}.png`);
    fs.writeFileSync(outPath, png);
  }
}

writeIcons();
