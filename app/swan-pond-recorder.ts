/**
 * Record the pond to an animated GIF. Frames are captured as the pond draws,
 * quantised to a 256-colour palette per frame (median cut) and LZW-encoded a
 * frame at a time in idle moments, so recording doesn't stutter the scene.
 */

import type { PondController } from "./swan-pond-engine";

const FPS = 12;
const MAX_SECONDS = 30;
const MAX_WIDTH = 520;

/* --------------------------------------------------------------------------
   GIF encoding
   -------------------------------------------------------------------------- */

type Box = { px: Uint8Array; n: number; rmin: number; rmax: number; gmin: number; gmax: number; bmin: number; bmax: number };

function boxOf(px: Uint8Array, n: number): Box {
  const b: Box = { px, n, rmin: 255, rmax: 0, gmin: 255, gmax: 0, bmin: 255, bmax: 0 };
  for (let i = 0; i < n; i++) {
    const r = px[i * 3];
    const g = px[i * 3 + 1];
    const bl = px[i * 3 + 2];
    if (r < b.rmin) b.rmin = r;
    if (r > b.rmax) b.rmax = r;
    if (g < b.gmin) b.gmin = g;
    if (g > b.gmax) b.gmax = g;
    if (bl < b.bmin) b.bmin = bl;
    if (bl > b.bmax) b.bmax = bl;
  }
  return b;
}

/** Median-cut palette from a sample of RGB pixels. */
function medianCut(sample: Uint8Array, n: number, size = 256): Uint8Array {
  let boxes: Box[] = [boxOf(sample, n)];
  while (boxes.length < size) {
    // split the box with the widest channel range
    let bi = -1;
    let best = 0;
    boxes.forEach((b, i) => {
      const range = Math.max(b.rmax - b.rmin, b.gmax - b.gmin, b.bmax - b.bmin);
      if (b.n > 1 && range > best) {
        best = range;
        bi = i;
      }
    });
    if (bi < 0) break;
    const b = boxes[bi];
    const ch = b.rmax - b.rmin >= b.gmax - b.gmin && b.rmax - b.rmin >= b.bmax - b.bmin ? 0 : b.gmax - b.gmin >= b.bmax - b.bmin ? 1 : 2;
    const idx = Array.from({ length: b.n }, (_, i) => i).sort((x, y) => b.px[x * 3 + ch] - b.px[y * 3 + ch]);
    const half = b.n >> 1;
    const a = new Uint8Array(half * 3);
    const c = new Uint8Array((b.n - half) * 3);
    idx.forEach((p, i) => {
      const dst = i < half ? a : c;
      const o = (i < half ? i : i - half) * 3;
      dst[o] = b.px[p * 3];
      dst[o + 1] = b.px[p * 3 + 1];
      dst[o + 2] = b.px[p * 3 + 2];
    });
    boxes.splice(bi, 1, boxOf(a, half), boxOf(c, b.n - half));
  }
  const pal = new Uint8Array(size * 3);
  boxes.forEach((b, i) => {
    let r = 0;
    let g = 0;
    let bl = 0;
    for (let j = 0; j < b.n; j++) {
      r += b.px[j * 3];
      g += b.px[j * 3 + 1];
      bl += b.px[j * 3 + 2];
    }
    const k = Math.max(1, b.n);
    pal[i * 3] = Math.round(r / k);
    pal[i * 3 + 1] = Math.round(g / k);
    pal[i * 3 + 2] = Math.round(bl / k);
  });
  return pal;
}

/** RGBA → palette indices, with a per-frame cache of nearest colours. */
function quantise(rgba: Uint8ClampedArray, count: number): { pal: Uint8Array; idx: Uint8Array } {
  const step = Math.max(1, Math.floor(count / 6000));
  const n = Math.floor(count / step);
  const sample = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) {
    const o = i * step * 4;
    sample[i * 3] = rgba[o];
    sample[i * 3 + 1] = rgba[o + 1];
    sample[i * 3 + 2] = rgba[o + 2];
  }
  const pal = medianCut(sample, n);
  const cache = new Int16Array(32768).fill(-1);
  const idx = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let c = cache[key];
    if (c < 0) {
      let bestD = Infinity;
      for (let p = 0; p < 256; p++) {
        const dr = pal[p * 3] - r;
        const dg = pal[p * 3 + 1] - g;
        const db = pal[p * 3 + 2] - b;
        const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
        if (d < bestD) {
          bestD = d;
          c = p;
        }
      }
      cache[key] = c;
    }
    idx[i] = c;
  }
  return { pal, idx };
}

/** GIF LZW, packed into 255-byte sub-blocks. */
function lzw(idx: Uint8Array, minCode = 8): Uint8Array {
  const out: number[] = [];
  let cur = 0;
  let curBits = 0;
  const block: number[] = [];
  const flushByte = (b: number) => {
    block.push(b);
    if (block.length === 255) {
      out.push(255, ...block);
      block.length = 0;
    }
  };
  const clear = 1 << minCode;
  const eoi = clear + 1;
  let size = minCode + 1;
  let next = eoi + 1;
  let dict = new Map<number, number>();
  const emit = (code: number) => {
    cur |= code << curBits;
    curBits += size;
    while (curBits >= 8) {
      flushByte(cur & 255);
      cur >>>= 8;
      curBits -= 8;
    }
  };
  emit(clear);
  let prefix = idx[0];
  for (let i = 1; i < idx.length; i++) {
    const k = idx[i];
    const key = (prefix << 8) | k;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << size && size < 12) size++;
    } else {
      emit(clear);
      dict = new Map();
      size = minCode + 1;
      next = eoi + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (curBits > 0) flushByte(cur & 255);
  if (block.length) out.push(block.length, ...block);
  out.push(0);
  return Uint8Array.from(out);
}

function frameBytes(w: number, h: number, pal: Uint8Array, idx: Uint8Array, delayCs: number): Uint8Array {
  const head = [
    // graphic control: no transparency, delay
    0x21, 0xf9, 0x04, 0x00, delayCs & 255, delayCs >> 8, 0x00, 0x00,
    // image descriptor with a local 256-colour table
    0x2c, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0x87,
  ];
  const data = lzw(idx);
  const out = new Uint8Array(head.length + pal.length + 1 + data.length);
  out.set(head, 0);
  out.set(pal, head.length);
  out[head.length + pal.length] = 8;
  out.set(data, head.length + pal.length + 1);
  return out;
}

function gifHeader(w: number, h: number): Uint8Array {
  return Uint8Array.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
    w & 255, w >> 8, h & 255, h >> 8, 0x70, 0, 0,
    // loop forever
    0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00,
  ]);
}

/* --------------------------------------------------------------------------
   Recorder UI
   -------------------------------------------------------------------------- */

export type SaveFile = (blob: Blob, filename: string) => Promise<void>;

/** Default: an ordinary browser download. */
export const browserSave: SaveFile = async (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export function mountRecorder(container: HTMLElement, ctl: PondController, save: SaveFile = browserSave): () => void {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pond-tuner-button is-record";
  btn.textContent = "● Record GIF";
  const note = document.createElement("span");
  note.className = "pond-tuner-status";
  note.setAttribute("role", "status");
  container.append(btn, note);

  const canvas = document.createElement("canvas");
  const cx = canvas.getContext("2d", { willReadFrequently: true })!;
  let recording = false;
  let encoding = false;
  let started = 0;
  let lastShot = 0;
  let w = 0;
  let h = 0;
  let parts: Uint8Array[] = [];
  const queue: ImageData[] = [];
  let unsub: (() => void) | null = null;
  let tick = 0;

  // encode queued frames a little at a time, between animation frames
  const pump = () => {
    if (!queue.length) return;
    const img = queue.shift()!;
    const { pal, idx } = quantise(img.data, img.width * img.height);
    parts.push(frameBytes(img.width, img.height, pal, idx, Math.round(100 / FPS)));
    if (queue.length) setTimeout(pump, 0);
  };

  const start = () => {
    const { width, height } = ctl.size();
    const k = Math.min(1, MAX_WIDTH / width);
    w = Math.round(width * k);
    h = Math.round(height * k);
    canvas.width = w;
    canvas.height = h;
    parts = [gifHeader(w, h)];
    queue.length = 0;
    recording = true;
    started = performance.now();
    lastShot = 0;
    btn.textContent = "■ Stop & save";
    btn.classList.add("is-live");
    unsub = ctl.onFrame(() => {
      const now = performance.now();
      if (now - lastShot < 1000 / FPS - 4) return;
      lastShot = now;
      ctl.snapshot(cx, w, h);
      queue.push(cx.getImageData(0, 0, w, h));
      setTimeout(pump, 0);
      const secs = (now - started) / 1000;
      note.textContent = `recording ${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
      if (secs >= MAX_SECONDS) stop();
    });
  };

  const stop = async () => {
    if (!recording) return;
    recording = false;
    unsub?.();
    unsub = null;
    btn.classList.remove("is-live");
    btn.disabled = true;
    encoding = true;
    const total = queue.length + parts.length - 1;
    // finish whatever is still queued, showing progress
    await new Promise<void>((resolve) => {
      const step = () => {
        if (queue.length) {
          pump();
          note.textContent = `saving GIF… ${Math.round(((total - queue.length) / Math.max(1, total)) * 100)}%`;
          tick = window.setTimeout(step, 0);
        } else resolve();
      };
      step();
    });
    parts.push(Uint8Array.from([0x3b]));
    const blob = new Blob(parts as BlobPart[], { type: "image/gif" });
    parts = [];
    encoding = false;
    btn.disabled = false;
    btn.textContent = "● Record GIF";
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    try {
      await save(blob, `swan-pond-${stamp}.gif`);
      note.textContent = `saved (${(blob.size / 1048576).toFixed(1)} MB)`;
    } catch {
      note.textContent = "not saved";
    }
  };

  const onClick = () => {
    if (encoding) return;
    if (recording) void stop();
    else start();
  };
  btn.addEventListener("click", onClick);
  return () => {
    unsub?.();
    clearTimeout(tick);
    btn.removeEventListener("click", onClick);
    btn.remove();
    note.remove();
  };
}
