import zlib from 'node:zlib';

/** Minimal PNG encoder (RGBA) so we can draw the app icon at build time without an image library. */
function crc32(buf: Uint8Array): number {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]!) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, data.length);
  const td = new Uint8Array(type.length + data.length); td.set(Buffer.from(type, 'ascii')); td.set(data, 4);
  const crc = new Uint8Array(4); new DataView(crc.buffer).setUint32(0, crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1); }
  const ihdr = new Uint8Array(13); const v = new DataView(ihdr.buffer);
  v.setUint32(0, width); v.setUint32(4, height); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', new Uint8Array(0))]);
}

function hexRgb(hex: string): [number, number, number] { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

/** The brand mark: rounded square in primary with a ring in accent (progress motif). Anti-aliased by 4× supersampling. */
export function appIconPng(size: number, primary: string, accent: string): Uint8Array {
  const [pr, pg, pb] = hexRgb(primary), [ar, ag, ab] = hexRgb(accent);
  const ss = 4, S = size * ss, r = S * 0.22, cx = S / 2, cy = S / 2, ringR = S * 0.235, ringW = S * 0.11;
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let R = 0, G = 0, B = 0, A = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const px = x * ss + sx + 0.5, py = y * ss + sy + 0.5;
      // rounded square
      const dx = Math.max(Math.abs(px - cx) - (S / 2 - r), 0), dy = Math.max(Math.abs(py - cy) - (S / 2 - r), 0);
      if (dx * dx + dy * dy > r * r) continue;
      const d = Math.hypot(px - cx, py - cy);
      const ring = Math.abs(d - ringR) <= ringW / 2;
      R += ring ? ar : pr; G += ring ? ag : pg; B += ring ? ab : pb; A += 255;
    }
    const n = ss * ss, i = (y * size + x) * 4;
    const cov = A / n;
    if (cov > 0) { out[i] = Math.round(R / (A / 255)); out[i + 1] = Math.round(G / (A / 255)); out[i + 2] = Math.round(B / (A / 255)); out[i + 3] = Math.round(cov); }
  }
  return encodePng(size, size, out);
}
