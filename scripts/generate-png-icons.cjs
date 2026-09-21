const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(typeAndData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function createPng(width, height, drawPixel) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image data with 0 filter byte per row
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawPixel(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const idatData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Brand graphic drawer for UsiCorte
function drawUsiCorteIcon(x, y, w, h) {
  // Normalize to -1.0 to 1.0
  const nx = (x / w) * 2 - 1;
  const ny = (y / h) * 2 - 1;
  const dist = Math.sqrt(nx * nx + ny * ny);

  // Base background: #0f172a (15, 23, 42) with rounded corners
  const cornerR = 0.25;
  const dx = Math.max(0, Math.abs(nx) - (1 - cornerR));
  const dy = Math.max(0, Math.abs(ny) - (1 - cornerR));
  const outsideDist = Math.sqrt(dx * dx + dy * dy);
  
  if (outsideDist > cornerR) {
    // Outside rounded border (transparent)
    return [0, 0, 0, 0];
  }

  // Smooth border edge
  let bgAlpha = 255;
  if (outsideDist > cornerR - 0.02) {
    bgAlpha = Math.floor(255 * (1 - (outsideDist - (cornerR - 0.02)) / 0.02));
  }

  // Slate gradient: #0f172a (top) to #1e293b (middle) to #090d16 (bottom)
  const gradT = (ny + 1) / 2;
  let bgR = Math.floor(15 + 15 * (1 - Math.abs(gradT - 0.5) * 2));
  let bgG = Math.floor(23 + 18 * (1 - Math.abs(gradT - 0.5) * 2));
  let bgB = Math.floor(42 + 25 * (1 - Math.abs(gradT - 0.5) * 2));

  // Subtle inner border (slate-700 / #334155)
  const innerDx = Math.max(0, Math.abs(nx) - (0.94 - cornerR));
  const innerDy = Math.max(0, Math.abs(ny) - (0.94 - cornerR));
  const innerDist = Math.sqrt(innerDx * innerDy);
  if (Math.abs(Math.max(Math.abs(nx), Math.abs(ny)) - 0.94) < 0.015) {
    bgR = 51; bgG = 65; bgB = 85;
  }

  // Laser circular ring (dist around 0.65)
  const ringDist = Math.abs(dist - 0.62);
  if (ringDist < 0.035 && ny < 0.55) {
    const angle = Math.atan2(ny, nx);
    // dashed laser ring
    if (Math.sin(angle * 12) > -0.2) {
      return [56, 189, 248, bgAlpha]; // Cyan
    }
  }

  // Central Disc background
  if (dist < 0.56 && ny < 0.55) {
    bgR = 15; bgG = 23; bgB = 42;
  }

  // Diamond cutting guide
  const diamondDist = Math.abs(Math.abs(nx) + Math.abs(ny - 0.05) - 0.46);
  if (diamondDist < 0.02 && ny < 0.5) {
    return [37, 99, 235, bgAlpha]; // Electric Blue
  }

  // "U" shape in central disc
  // Left pillar: nx ~ -0.22, ny between -0.25 and 0.1
  // Right pillar: nx ~ 0.22, ny between -0.25 and 0.1
  // Bottom curve: nx between -0.22 and 0.22, ny around 0.1
  const uPillarLeft = Math.abs(nx - (-0.20)) < 0.05 && ny >= -0.25 && ny <= 0.12;
  const uPillarRight = Math.abs(nx - (0.20)) < 0.05 && ny >= -0.25 && ny <= 0.0;
  const uBottomDist = Math.abs(Math.sqrt(nx * nx + (ny - 0.02) * (ny - 0.02)) - 0.20);
  const uBottom = uBottomDist < 0.05 && ny >= 0.02 && ny <= 0.24 && Math.abs(nx) <= 0.20;

  if (uPillarLeft || uPillarRight || uBottom) {
    return [37, 99, 235, bgAlpha]; // Royal Blue
  }

  // "C" arc notch (cyan & white cut through)
  const cArcDist = Math.abs(Math.sqrt((nx - 0.04) * (nx - 0.04) + (ny + 0.05) * (ny + 0.05)) - 0.18);
  if (cArcDist < 0.035 && (nx < 0.12 || Math.abs(ny + 0.05) > 0.08)) {
    return [240, 249, 255, bgAlpha]; // White-Cyan spark
  }

  // Laser Spark Point (golden yellow flare at center ny ~ 0.02, nx ~ 0.0)
  const sparkDist = Math.sqrt(nx * nx + (ny - 0.02) * (ny - 0.02));
  if (sparkDist < 0.06) {
    return [254, 240, 138, bgAlpha]; // Laser core
  }
  if (sparkDist < 0.12 && (Math.abs(nx) < 0.02 || Math.abs(ny - 0.02) < 0.02)) {
    return [245, 158, 11, bgAlpha]; // Golden spark beams
  }

  // Bottom Label Area: "USICORTE" letters block
  if (ny >= 0.58 && ny <= 0.76 && Math.abs(nx) <= 0.72) {
    // Stylized high-contrast lettering bar
    // Let's render a crisp modern badge
    if (Math.abs(ny - 0.67) < 0.065 && Math.abs(nx) < 0.65) {
      // White contrast emblem band with blue lettering
      const letterBar = Math.floor((nx + 0.65) / 0.16);
      if (letterBar % 2 === 0 || Math.abs(ny - 0.67) < 0.04) {
        return [255, 255, 255, bgAlpha];
      }
    }
  }

  // Bottom accent line: Cyan
  if (Math.abs(ny - 0.82) < 0.015 && Math.abs(nx) < 0.45) {
    return [56, 189, 248, bgAlpha];
  }

  return [bgR, bgG, bgB, bgAlpha];
}

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PWA icons...');
const buf512 = createPng(512, 512, drawUsiCorteIcon);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), buf512);
console.log('Created icon-512.png (' + buf512.length + ' bytes)');

const buf192 = createPng(192, 192, drawUsiCorteIcon);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), buf192);
console.log('Created icon-192.png (' + buf192.length + ' bytes)');

const bufApple = createPng(180, 180, drawUsiCorteIcon);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), bufApple);
console.log('Created apple-touch-icon.png (' + bufApple.length + ' bytes)');
