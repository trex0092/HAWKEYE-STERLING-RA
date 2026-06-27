/* PWA icon generator — dependency-free (node:zlib only).

   Rasterises the Hawkeye Sterling brand mark (a neon "hawk-eye / radar target"
   on the #0A0E16 command-center background) to the PNG install icons the
   manifest and iOS need. Kept in the repo so the icons are reproducible:
     node scripts/gen-icons.mjs
   Emits assets/icon-192.png, icon-512.png, icon-512-maskable.png,
   apple-touch-icon-180.png. The vector source of truth is assets/icon.svg;
   this draws the same geometric mark with 3x supersampled anti-aliasing.

   Pure helpers (encodePng, crc32) are unit-tested in test/gen-icons.test.mjs. */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

/* ── PNG encoding (8-bit RGBA, colour type 6) ── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
/* Encode an RGBA pixel buffer (w*h*4) as a PNG Buffer. */
export function encodePng(rgba, w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ── brand-mark rasteriser ── */
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG_TOP = hex('#0A0E16'), BG_BOT = hex('#0B101A');
const TEAL = hex('#2af0d2'), TEAL_BRIGHT = hex('#5cffe6'), GLOW = hex('#14e0c0');
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
/* Smooth coverage of a ring of radius r, half-width hw, with ~1px feather. */
function ring(d, r, hw, feather) { return clamp01((hw - Math.abs(d - r)) / feather + 0.5); }
function disc(d, r, feather) { return clamp01((r - d) / feather + 0.5); }

/* Colour at normalised coords u,v ∈ [-1,1]. `scale` shrinks the mark (maskable
   safe zone). Returns [r,g,b] 0-255, fully opaque. */
function sample(u, v, scale, feather) {
  const bg = mix(BG_TOP, BG_BOT, clamp01((v + 1) / 2));
  let col = bg.slice();
  const x = u / scale, y = v / scale;
  const d = Math.hypot(x, y);
  // central glow
  col = mix(col, GLOW, clamp01(0.55 - d) * 0.5);
  // outer ring, inner ring, pupil, crosshair ticks (painter's order)
  col = mix(col, TEAL, ring(d, 0.62, 0.045, feather));
  col = mix(col, TEAL, ring(d, 0.34, 0.038, feather));
  col = mix(col, TEAL_BRIGHT, disc(d, 0.15, feather));
  const ang = Math.atan2(y, x);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    const along = x * Math.cos(a) + y * Math.sin(a);
    const perp = Math.abs(-x * Math.sin(a) + y * Math.cos(a));
    if (along > 0.66 && along < 0.82 && perp < 0.035) col = mix(col, TEAL_BRIGHT, 0.95);
  }
  void ang;
  return col;
}

function render(size, { scale = 0.84 } = {}) {
  const SS = 3, W = size * SS;
  const out = Buffer.alloc(size * size * 4);
  const featherN = (2 / W) / scale; // ~1 device px in normalised units
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = (px * SS + sx + 0.5) / W, fy = (py * SS + sy + 0.5) / W;
          const c = sample(fx * 2 - 1, fy * 2 - 1, scale, featherN);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS, i = (py * size + px) * 4;
      out[i] = Math.round(r / n); out[i + 1] = Math.round(g / n); out[i + 2] = Math.round(b / n); out[i + 3] = 255;
    }
  }
  return out;
}

function emit(path, size, opts) {
  const buf = encodePng(render(size, opts), size, size);
  writeFileSync(path, buf);
  return buf.length;
}

/* Run as a script (not when imported by the test). */
if (import.meta.url === `file://${process.argv[1]}`) {
  const jobs = [
    ['assets/icon-192.png', 192, { scale: 0.84 }],
    ['assets/icon-512.png', 512, { scale: 0.84 }],
    ['assets/icon-512-maskable.png', 512, { scale: 0.66 }], // content inside the ~80% safe zone
    ['assets/apple-touch-icon-180.png', 180, { scale: 0.84 }],
  ];
  for (const [p, s, o] of jobs) console.log('wrote ' + p + ' (' + emit(p, s, o) + ' bytes)');
}

export { render, sample };
