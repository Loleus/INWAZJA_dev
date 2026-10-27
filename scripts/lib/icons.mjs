/* Ikona gry generowana przy budowaniu — w repozytorium nie ma plików binarnych.
   Jeden opis kształtów daje i SVG (tekst), i PNG (własna rasteryzacja z wygładzaniem krawędzi).
   Motyw: głowica wieży „Strzała” — biała tarcza z zieloną źrenicą i lufą na zielonej blasze. */
import zlib from 'node:zlib';

const NIGHT = '#0b1220';
const GREEN = '#2ecc71';
const GREEN_DARK = '#27ae60';
const WHITE = '#f8fafc';
const STEEL = '#f1f5f9';
const GOLD = '#fbbf24';
const BLACK = '#000000';

const SUPERSAMPLING = 4;

/** Kształty w układzie 0..1 (oś Y w dół), rysowane od spodu. Wariant „maskable” ma tło na całą
    ikonę, a cała treść mieści się w bezpiecznym kole o promieniu 0,4 od środka. */
function shapes(maskable) {
  return [
    { type: 'rrect', cx: 0.5, cy: 0.5, hw: 0.5, hh: 0.5, r: maskable ? 0 : 0.2, fill: NIGHT },
    { type: 'circle', cx: 0.5, cy: 0.5, r: 0.43, fill: GREEN, alpha: 0.1 },
    { type: 'circle', cx: 0.5, cy: 0.5, r: 0.36, fill: GREEN, alpha: 0.1 },
    { type: 'rrect', cx: 0.5, cy: 0.512, hw: 0.31, hh: 0.31, r: 0.13, fill: BLACK, alpha: 0.35 },
    { type: 'rrect', cx: 0.5, cy: 0.5, hw: 0.3, hh: 0.3, r: 0.12, fill: GREEN },
    { type: 'rrect', cx: 0.5, cy: 0.5, hw: 0.265, hh: 0.265, r: 0.09, fill: GREEN_DARK },
    { type: 'poly', points: [[0.5, 0.12], [0.42, 0.32], [0.58, 0.32]], fill: STEEL },
    { type: 'rrect', cx: 0.5, cy: 0.39, hw: 0.035, hh: 0.13, r: 0, fill: STEEL },
    { type: 'circle', cx: 0.5, cy: 0.5, r: 0.19, fill: BLACK, alpha: 0.25 },
    { type: 'circle', cx: 0.5, cy: 0.5, r: 0.17, fill: WHITE },
    { type: 'circle', cx: 0.5, cy: 0.5, r: 0.105, fill: GREEN },
    { type: 'circle', cx: 0.5, cy: 0.5, r: 0.045, fill: GOLD },
  ];
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function iconSvg() {
  const size = 512;
  const n = (value) => +(value * size).toFixed(2);
  const elements = shapes(false).map((s) => {
    const fill = `fill="${s.fill}"${s.alpha === undefined ? '' : ` fill-opacity="${s.alpha}"`}`;
    if (s.type === 'circle') return `<circle cx="${n(s.cx)}" cy="${n(s.cy)}" r="${n(s.r)}" ${fill}/>`;
    if (s.type === 'rrect') {
      return `<rect x="${n(s.cx - s.hw)}" y="${n(s.cy - s.hh)}" width="${n(s.hw * 2)}" height="${n(s.hh * 2)}" rx="${n(s.r)}" ${fill}/>`;
    }
    return `<polygon points="${s.points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" ${fill}/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n  ${elements.join('\n  ')}\n</svg>\n`;
}

function inside(s, x, y) {
  if (s.type === 'circle') {
    const dx = x - s.cx;
    const dy = y - s.cy;
    return dx * dx + dy * dy <= s.r * s.r;
  }
  if (s.type === 'rrect') {
    const qx = Math.abs(x - s.cx) - (s.hw - s.r);
    const qy = Math.abs(y - s.cy) - (s.hh - s.r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) <= s.r;
  }
  let hit = false;
  const p = s.points;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Surowe RGBA (nie-premnożone) po wygładzeniu krawędzi. */
function rasterize(size, maskable) {
  const list = shapes(maskable).map((s) => ({ ...s, rgb: hexToRgb(s.fill), a: s.alpha ?? 1 }));
  const pixels = Buffer.alloc(size * size * 4);
  const samples = SUPERSAMPLING * SUPERSAMPLING;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let pr = 0;
      let pg = 0;
      let pb = 0;
      let pa = 0;
      for (let sy = 0; sy < SUPERSAMPLING; sy++) {
        for (let sx = 0; sx < SUPERSAMPLING; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLING) / size;
          const y = (py + (sy + 0.5) / SUPERSAMPLING) / size;
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;
          for (const s of list) {
            if (!inside(s, x, y)) continue;
            r = s.rgb[0] * s.a + r * (1 - s.a);
            g = s.rgb[1] * s.a + g * (1 - s.a);
            b = s.rgb[2] * s.a + b * (1 - s.a);
            a = s.a + a * (1 - s.a);
          }
          pr += r;
          pg += g;
          pb += b;
          pa += a;
        }
      }
      const o = (py * size + px) * 4;
      const alpha = pa / samples;
      if (alpha > 0) {
        pixels[o] = Math.round(pr / pa);
        pixels[o + 1] = Math.round(pg / pa);
        pixels[o + 2] = Math.round(pb / pa);
        pixels[o + 3] = Math.round(alpha * 255);
      }
    }
  }
  return pixels;
}

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 bitów na kanał
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function iconPng(size, maskable = false) {
  return encodePng(size, rasterize(size, maskable));
}
