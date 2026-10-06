/**
 * Record the pond to a video, with the music if it's on. Each drawn frame is
 * copied (with the swans' remarks) onto a canvas whose stream, together with
 * the music's audio track, goes to a MediaRecorder. MP4 where the browser can
 * write it, WebM otherwise.
 */

import type { PondController } from "./swan-pond-engine";
import type { Music } from "./swan-pond-music";

const FPS = 30;
const MAX_SECONDS = 180;
/** Videos are rendered at this width whatever size the pond is on screen. */
const VIDEO_WIDTH = 1920;

const TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1,opus",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

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

export function mountRecorder(
  container: HTMLElement,
  ctl: PondController,
  save: SaveFile = browserSave,
  music?: Music,
): () => void {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pond-tuner-button is-record";
  btn.textContent = "● Record video";
  const note = document.createElement("span");
  note.className = "pond-tuner-status";
  note.setAttribute("role", "status");
  container.append(btn, note);

  const type = typeof MediaRecorder === "undefined" ? undefined : TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  const canvas = document.createElement("canvas");
  if (!type || typeof canvas.captureStream !== "function") {
    btn.disabled = true;
    note.textContent = "this browser can't record video";
    return () => {
      btn.remove();
      note.remove();
    };
  }
  const cx = canvas.getContext("2d")!;
  let rec: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let started = 0;
  let lastShot = 0;
  let unsub: (() => void) | null = null;

  const start = async () => {
    const { width, height } = ctl.size();
    // the pond renders itself at video size while recording, not screen size
    ctl.setHighQuality(VIDEO_WIDTH);
    // video encoders want even dimensions
    canvas.width = VIDEO_WIDTH;
    canvas.height = Math.round((VIDEO_WIDTH * height) / width / 2) * 2;
    ctl.snapshot(cx, canvas.width, canvas.height);

    // the song goes in the video too, so start it if it isn't playing
    if (music && !music.playing) {
      try {
        await music.play();
      } catch {
        /* no sound allowed: record the picture alone */
      }
    }
    const stream = canvas.captureStream(FPS);
    for (const t of music?.tracks() ?? []) stream.addTrack(t);

    chunks = [];
    rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 16_000_000, audioBitsPerSecond: 192_000 });
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => void finish(stream);
    rec.start(1000);
    started = performance.now();
    lastShot = 0;
    btn.textContent = "■ Stop & save";
    btn.classList.add("is-live");
    unsub = ctl.onFrame(() => {
      const now = performance.now();
      if (now - lastShot < 1000 / FPS - 4) return;
      lastShot = now;
      ctl.snapshot(cx, canvas.width, canvas.height);
      const secs = (now - started) / 1000;
      note.textContent = `recording ${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
      if (secs >= MAX_SECONDS) stop();
    });
  };

  const stop = () => {
    if (!rec || rec.state === "inactive") return;
    unsub?.();
    unsub = null;
    ctl.setHighQuality(null);
    btn.disabled = true;
    note.textContent = "saving video…";
    rec.stop();
  };

  const finish = async (stream: MediaStream) => {
    // the music's track belongs to the player, so only stop the canvas one
    for (const t of stream.getVideoTracks()) t.stop();
    const blob = new Blob(chunks, { type: type.split(";")[0] });
    chunks = [];
    rec = null;
    btn.disabled = false;
    btn.classList.remove("is-live");
    btn.textContent = "● Record video";
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    try {
      await save(blob, `swan-pond-${stamp}.${type.startsWith("video/mp4") ? "mp4" : "webm"}`);
      note.textContent = `saved (${(blob.size / 1048576).toFixed(1)} MB)`;
    } catch {
      note.textContent = "not saved";
    }
  };

  const onClick = () => {
    if (rec) stop();
    else void start();
  };
  btn.addEventListener("click", onClick);
  return () => {
    unsub?.();
    if (rec && rec.state !== "inactive") {
      ctl.setHighQuality(null);
      rec.onstop = null;
      rec.stop();
    }
    btn.removeEventListener("click", onClick);
    btn.remove();
    note.remove();
  };
}
