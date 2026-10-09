// A picture is what gets printed on the puzzle:
//   name, aspect          what it's called, and width / height
//   animated              whether it moves once the puzzle is solved
//   draw(ctx, w, h, t)    paint it at time t (seconds since solving; 0 = the still)
//   drawStill(ctx, w, h)  paint the still without touching playback, for showing
//                         the finished picture while a video may be running
//   frame(t)              a key that changes when the picture does, so the
//                         print is only re-uploaded when there's something new
//
// Presets are short videos that play once solved. Uploads are still images.

// The pictures offered at the top, in order. Each video comes as WebM (VP9,
// small) with an MP4 fallback for browsers without VP9; files live in
// public/presets/. `still` is the moment shown while the puzzle is in pieces,
// chosen by eye (a first frame can be a bad one); once solved, playback picks
// up from there. `crop` trims a border baked into the video, in source pixels
// per side.
export const PRESETS = [
  { name: 'Swans', video: ['presets/swans.webm', 'presets/swans.mp4'], still: 2, crop: 56 },
  { name: 'Tiger', video: ['presets/tiger.webm', 'presets/tiger.mp4'], still: 9, crop: 48 },
  { name: 'Landscape', video: ['presets/open-sky.webm', 'presets/open-sky.mp4'], still: 2, crop: 64 },
];

// Resolve a preset to a picture, loading its video the first time.
const loaded = new Map();
export function loadPreset(entry) {
  if (!loaded.has(entry)) loaded.set(entry, pictureFromVideo(playable(entry.video), entry.name, entry));
  return loaded.get(entry);
}

// A still image: PNG or JPEG.
export async function pictureFromImage(file, name = file.name) {
  const img = await bitmapOf(file);
  return {
    name,
    aspect: img.width / img.height,
    animated: false,
    frame: () => 0,
    draw: (ctx, w, h) => cover(ctx, img, w, h),
    drawStill: (ctx, w, h) => cover(ctx, img, w, h),
  };
}

// A video, muted and inline so browsers let it play on its own. The frame at
// `still` is kept for the unsolved puzzle; playback starts from that moment.
async function pictureFromVideo(url, name, { still: at = 0, crop = 0 } = {}) {
  const v = document.createElement('video');
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = url;
  await new Promise((resolve, reject) => {
    v.addEventListener('loadeddata', resolve, { once: true });
    v.addEventListener('error', () => reject(new Error(`can't play ${name}`)), { once: true });
  });
  await seek(v, at);

  const sw = v.videoWidth - crop * 2;
  const sh = v.videoHeight - crop * 2;
  const still = canvas(sw, sh);
  still.getContext('2d').drawImage(v, crop, crop, sw, sh, 0, 0, sw, sh);
  const live = canvas(sw, sh);
  const lctx = live.getContext('2d');

  return {
    name,
    aspect: sw / sh,
    animated: true,
    frame: (t) => (t === 0 ? -1 : Math.floor(v.currentTime * 60)),
    drawStill: (ctx, w, h) => cover(ctx, still, w, h),
    draw(ctx, w, h, t) {
      if (t === 0) {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - at) > 0.001) v.currentTime = at;
        cover(ctx, still, w, h);
        return;
      }
      if (v.paused) v.play().catch(() => {});
      lctx.drawImage(v, crop, crop, sw, sh, 0, 0, sw, sh);
      cover(ctx, live, w, h);
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

// Cover-crop, like a photo printed edge to edge.
function cover(ctx, img, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  ctx.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
}

function seek(v, time) {
  return new Promise((resolve) => {
    if (Math.abs(v.currentTime - time) < 0.001) return resolve();
    v.addEventListener('seeked', resolve, { once: true });
    v.currentTime = time;
  });
}

// The first source this browser says it can play.
function playable(sources) {
  const probe = document.createElement('video');
  const type = (src) => (/\.webm$/i.test(src) ? 'video/webm; codecs="vp9"' : 'video/mp4; codecs="avc1.640028"');
  return sources.find((src) => probe.canPlayType(type(src))) || sources[sources.length - 1];
}

async function bitmapOf(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    // Older Safari: decode through an <img> instead.
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const el = new Image();
      el.onload = () => {
        URL.revokeObjectURL(url);
        resolve(el);
      };
      el.onerror = reject;
      el.src = url;
    });
  }
}
