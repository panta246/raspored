// Generates build/icon.png (1024x1024 master) and build/icon.ico (multi-res)
// for the app icon. Pure Node (zlib for PNG deflate + hand-rolled CRC32), no
// image libraries required. Re-run with `node scripts/generate-icon.js` after
// editing the design below.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'build');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------- colors ----------
const BG_TOP = [79, 70, 229]; // indigo-600
const BG_BOTTOM = [109, 40, 217]; // violet-700
const TAB_COLOR = [55, 48, 163]; // indigo-800
const CARD_COLOR = [248, 250, 252]; // slate-50
const HEADER_COLOR = [67, 56, 202]; // indigo-700
const OUTLINE_COLOR = [203, 213, 225]; // slate-300
const CELL_COLORS = [
  [99, 102, 241], // indigo-500
  [16, 185, 129], // emerald-500
  null, // outline only
  null, // outline only
  [245, 158, 11], // amber-500
  [99, 102, 241], // indigo-500
];

function lerp(a, b, t) { return a + (b - a) * t; }

function insideRoundedRect(x, y, x0, y0, x1, y1, r, corners) {
  const { tl = true, tr = true, bl = true, br = true } = corners || {};
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  if (tl && x < x0 + r && y < y0 + r) {
    const dx = x - (x0 + r), dy = y - (y0 + r);
    return dx * dx + dy * dy <= r * r;
  }
  if (tr && x > x1 - r && y < y0 + r) {
    const dx = x - (x1 - r), dy = y - (y0 + r);
    return dx * dx + dy * dy <= r * r;
  }
  if (bl && x < x0 + r && y > y1 - r) {
    const dx = x - (x0 + r), dy = y - (y1 - r);
    return dx * dx + dy * dy <= r * r;
  }
  if (br && x > x1 - r && y > y1 - r) {
    const dx = x - (x1 - r), dy = y - (y1 - r);
    return dx * dx + dy * dy <= r * r;
  }
  return true;
}

function buildLayout(S) {
  const bg = { x0: 0, y0: 0, x1: S, y1: S, r: 0.22 * S };
  const card = { x0: 0.16 * S, y0: 0.18 * S, x1: 0.84 * S, y1: 0.88 * S, r: 0.09 * S };
  const header = { x0: card.x0, y0: card.y0, x1: card.x1, y1: card.y0 + 0.30 * (card.y1 - card.y0), r: card.r, corners: { tl: true, tr: true, bl: false, br: false } };
  const tabW = 0.05 * S;
  const tabY0 = 0.13 * S, tabY1 = header.y1;
  const tabR = 0.02 * S;
  const tabs = [0.32 * S, 0.68 * S].map((cx) => ({ x0: cx - tabW / 2, y0: tabY0, x1: cx + tabW / 2, y1: tabY1, r: tabR }));

  const gap = 0.025 * S;
  const ix0 = card.x0 + 0.07 * S, ix1 = card.x1 - 0.07 * S;
  const iy0 = header.y1 + 0.06 * S, iy1 = card.y1 - 0.07 * S;
  const cellW = (ix1 - ix0 - 2 * gap) / 3;
  const cellH = (iy1 - iy0 - gap) / 2;
  const cellR = 0.018 * S;
  const cells = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const x0 = ix0 + col * (cellW + gap);
      const y0 = iy0 + row * (cellH + gap);
      cells.push({ x0, y0, x1: x0 + cellW, y1: y0 + cellH, r: cellR, color: CELL_COLORS[row * 3 + col] });
    }
  }
  const borderW = Math.max(0.008 * S, 1);
  return { bg, card, header, tabs, cells, borderW };
}

function sampleColor(x, y, layout) {
  const { bg, card, header, tabs, cells, borderW } = layout;
  if (!insideRoundedRect(x, y, bg.x0, bg.y0, bg.x1, bg.y1, bg.r)) return [0, 0, 0, 0];
  const t = Math.min(1, Math.max(0, y / bg.y1));
  let color = [lerp(BG_TOP[0], BG_BOTTOM[0], t), lerp(BG_TOP[1], BG_BOTTOM[1], t), lerp(BG_TOP[2], BG_BOTTOM[2], t)];

  for (const tab of tabs) {
    if (insideRoundedRect(x, y, tab.x0, tab.y0, tab.x1, tab.y1, tab.r)) color = TAB_COLOR;
  }
  if (insideRoundedRect(x, y, card.x0, card.y0, card.x1, card.y1, card.r)) color = CARD_COLOR;
  if (insideRoundedRect(x, y, header.x0, header.y0, header.x1, header.y1, header.r, header.corners)) color = HEADER_COLOR;

  for (const cell of cells) {
    const outer = insideRoundedRect(x, y, cell.x0, cell.y0, cell.x1, cell.y1, cell.r);
    if (!outer) continue;
    if (cell.color) {
      color = cell.color;
    } else {
      const inner = insideRoundedRect(x, y, cell.x0 + borderW, cell.y0 + borderW, cell.x1 - borderW, cell.y1 - borderW, Math.max(cell.r - borderW, 0));
      if (!inner) color = OUTLINE_COLOR;
    }
  }
  return [color[0], color[1], color[2], 255];
}

function renderPNGBuffer(S) {
  const SS = 4; // supersampling factor per axis
  const layout = buildLayout(S);
  const raw = Buffer.alloc((S * (1 + S * 4)));
  let pos = 0;
  for (let y = 0; y < S; y++) {
    raw[pos++] = 0; // filter type: none
    for (let x = 0; x < S; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      for (let sy = 0; sy < SS; sy++) {
        const fy = y + (sy + 0.5) / SS;
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const [r, g, b, a] = sampleColor(fx, fy, layout);
          rSum += r * a; gSum += g * a; bSum += b * a; aSum += a;
        }
      }
      const n = SS * SS;
      const aOut = Math.round(aSum / n);
      const rOut = aSum > 0 ? Math.round(rSum / aSum) : 0;
      const gOut = aSum > 0 ? Math.round(gSum / aSum) : 0;
      const bOut = aSum > 0 ? Math.round(bSum / aSum) : 0;
      raw[pos++] = rOut; raw[pos++] = gOut; raw[pos++] = bOut; raw[pos++] = aOut;
    }
  }
  return encodePNG(S, S, raw);
}

// ---------- minimal PNG encoder ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rawRGBA) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idatData = zlib.deflateSync(rawRGBA, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatData), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- ICO packer ----------
function buildICO(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const entries = [];
  const datas = [];
  let offset = 6 + 16 * count;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
    datas.push(png);
  }
  return Buffer.concat([header, ...entries, ...datas]);
}

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const icoImages = ICO_SIZES.map((size) => ({ size, png: renderPNGBuffer(size) }));
fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), buildICO(icoImages));

const master = renderPNGBuffer(1024);
fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), master);

console.log('Wrote build/icon.ico and build/icon.png');
