/**
 * Tuning panel for the pond. Plain DOM so the same panel works in the React
 * component and in the standalone preview page.
 *
 * "Auto" follows the viewer's clock; picking a time previews it. The lettering
 * controls try out fonts for what the swans say; "Copy settings" copies the
 * chosen lettering so it can be made the default.
 */

import type { PondController, PondParams, TimeName } from "./swan-pond-engine";
import { TIME_HOURS, TIME_NAMES, defaultLooks, followClock, lookAt, type Looks } from "./swan-pond-time";
import { browserSave, mountRecorder, type SaveFile } from "./swan-pond-recorder";

const STORAGE_KEY = "swan-pond-looks-v7";

/** Handwritten Google fonts to try for the swans' remarks. */
export const HAND_FONTS = [
  "Homemade Apple",
  "Caveat",
  "Nothing You Could Do",
  "La Belle Aurore",
  "Reenie Beanie",
  "Shadows Into Light",
  "Indie Flower",
  "Gochi Hand",
  "Patrick Hand",
  "Kalam",
  "Gaegu",
  "Nanum Pen Script",
  "Covered By Your Grace",
  "Just Another Hand",
  "Gloria Hallelujah",
  "Architects Daughter",
  "Annie Use Your Telescope",
  "Loved by the King",
  "Over the Rainbow",
  "Dawning of a New Day",
  "Waiting for the Sunrise",
  "Sue Ellen Francisco",
  "Zeyada",
  "Cedarville Cursive",
  "Mynerve",
  "Schoolbell",
  "Coming Soon",
  "Short Stack",
  "Swanky and Moo Moo",
  "Sedgwick Ave",
  "Rock Salt",
  "Pangolin",
];

export type Lettering = { font: string; size: number; bold: boolean; italic: boolean };
export const DEFAULT_LETTERING: Lettering = { font: "Homemade Apple", size: 13, bold: false, italic: false };

type Saved = { looks: Looks; mode: "Auto" | TimeName; lettering?: Lettering };

export function loadSaved(): Saved {
  const base = defaultLooks();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Saved>;
      // the colour sliders are gone, so the looks are always the locked-in defaults
      return { looks: base, mode: s.mode ?? "Auto", lettering: { ...DEFAULT_LETTERING, ...s.lettering } };
    }
  } catch {
    /* storage blocked: start from the defaults */
  }
  return { looks: base, mode: "Auto", lettering: { ...DEFAULT_LETTERING } };
}

function save(s: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private mode or blocked storage: the sliders still work */
  }
}

/** Params the pond should open with, before the panel mounts. */
export function initialParams(): PondParams {
  const s = loadSaved();
  return s.mode === "Auto" ? lookAt(s.looks).params : { ...s.looks[s.mode] };
}

let fontsLoaded = false;
/** Fetch every font on the list at once (tuner only), so switching is instant. */
function loadFonts() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${HAND_FONTS.map((f) => `family=${f.replace(/ /g, "+")}`).join("&")}&display=swap`;
  document.head.appendChild(link);
}

/** Point the swans' lettering at a font, size and style. */
export function applyLettering(l: Lettering) {
  const root = document.documentElement.style;
  loadFonts();
  // the default font is bundled with the site, so leave it to the stylesheet
  if (l.font === DEFAULT_LETTERING.font) root.removeProperty("--say-font");
  else root.setProperty("--say-font", `"${l.font}"`);
  root.setProperty("--say-size", `${l.size}px`);
  root.setProperty("--say-weight", l.bold ? "700" : "400");
  root.setProperty("--say-style", l.italic ? "italic" : "normal");
}

export function mountTuner(container: HTMLElement, ctl: PondController, opts: { save?: SaveFile } = {}): () => void {
  const state = loadSaved();
  let stopClock: (() => void) | null = null;

  const root = document.createElement("div");
  root.className = "pond-tuner";

  const head = document.createElement("div");
  head.className = "pond-tuner-presets";
  const headLabel = document.createElement("span");
  headLabel.className = "pond-tuner-label";
  headLabel.textContent = "Time of day";
  head.appendChild(headLabel);
  const chips = new Map<"Auto" | TimeName, HTMLButtonElement>();
  for (const name of ["Auto", ...TIME_NAMES] as const) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pond-tuner-chip";
    b.textContent = name;
    if (name !== "Auto") b.title = TIME_HOURS[name];
    b.addEventListener("click", () => setMode(name));
    head.appendChild(b);
    chips.set(name, b);
  }
  const note = document.createElement("span");
  note.className = "pond-tuner-status";
  head.appendChild(note);
  root.appendChild(head);

  const lettering: Lettering = state.lettering ?? { ...DEFAULT_LETTERING };
  state.lettering = lettering;
  const fonts = document.createElement("div");
  fonts.className = "pond-tuner-fonts";
  const fontLabel = document.createElement("label");
  fontLabel.className = "pond-tuner-label";
  fontLabel.textContent = "Lettering";
  fontLabel.htmlFor = "pond-font";
  const select = document.createElement("select");
  select.id = "pond-font";
  select.className = "pond-tuner-select";
  for (const f of HAND_FONTS) {
    const o = document.createElement("option");
    o.value = f;
    o.textContent = f;
    o.style.fontFamily = `"${f}", cursive`;
    select.appendChild(o);
  }
  const size = document.createElement("label");
  size.className = "pond-tuner-size";
  const sizeText = document.createElement("span");
  sizeText.textContent = "Size";
  const sizeInput = document.createElement("input");
  sizeInput.type = "range";
  sizeInput.className = "pond-tuner-range";
  sizeInput.min = "8";
  sizeInput.max = "30";
  sizeInput.step = "1";
  const sizeOut = document.createElement("output");
  size.append(sizeText, sizeInput, sizeOut);
  const toggle = (text: string, style: string) => {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "pond-tuner-chip";
    t.innerHTML = `<span style="${style}">${text}</span>`;
    return t;
  };
  const boldBtn = toggle("B", "font-weight:700");
  boldBtn.setAttribute("aria-label", "Bold");
  const italicBtn = toggle("I", "font-style:italic");
  italicBtn.setAttribute("aria-label", "Italic");
  const speak = document.createElement("button");
  speak.type = "button";
  speak.className = "pond-tuner-button is-quiet";
  speak.textContent = "Make them talk";
  const sample = document.createElement("div");
  sample.className = "pond-tuner-sample";
  sample.textContent = "corn pls <3 · bruh! · dibs! · glutton! · yummm";
  fonts.append(fontLabel, select, size, boldBtn, italicBtn, speak, sample);
  root.appendChild(fonts);

  const setLettering = (patch: Partial<Lettering>, talk = true) => {
    Object.assign(lettering, patch);
    save(state);
    applyLettering(lettering);
    syncLettering();
    if (talk) ctl.chatter();
  };
  const syncLettering = () => {
    select.value = lettering.font;
    sizeInput.value = String(lettering.size);
    sizeOut.textContent = `${lettering.size}px`;
    boldBtn.setAttribute("aria-pressed", String(lettering.bold));
    italicBtn.setAttribute("aria-pressed", String(lettering.italic));
    sample.style.fontFamily = `"${lettering.font}", cursive`;
    sample.style.fontWeight = lettering.bold ? "700" : "400";
    sample.style.fontStyle = lettering.italic ? "italic" : "normal";
  };
  select.addEventListener("change", () => setLettering({ font: select.value }));
  sizeInput.addEventListener("input", () => setLettering({ size: Number(sizeInput.value) }, false));
  sizeInput.addEventListener("change", () => ctl.chatter());
  boldBtn.addEventListener("click", () => setLettering({ bold: !lettering.bold }));
  italicBtn.addEventListener("click", () => setLettering({ italic: !lettering.italic }));
  speak.addEventListener("click", () => ctl.chatter());
  applyLettering(lettering);
  syncLettering();

  const actions = document.createElement("div");
  actions.className = "pond-tuner-actions";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "pond-tuner-button";
  copy.textContent = "Copy settings";
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "pond-tuner-button is-quiet";
  reset.textContent = "Reset";
  const status = document.createElement("span");
  status.className = "pond-tuner-status";
  status.setAttribute("role", "status");
  const fallback = document.createElement("textarea");
  fallback.className = "pond-tuner-fallback";
  fallback.readOnly = true;
  fallback.hidden = true;
  fallback.setAttribute("aria-label", "Pond settings");
  actions.append(copy, reset, status);
  const recRow = document.createElement("div");
  recRow.className = "pond-tuner-actions";
  const unmountRecorder = mountRecorder(recRow, ctl, opts.save ?? browserSave);
  root.append(actions, recRow, fallback);

  copy.addEventListener("click", () => {
    const text = JSON.stringify({ lettering });
    const done = () => {
      status.textContent = "Copied the lettering";
      setTimeout(() => (status.textContent = ""), 1800);
    };
    const manual = () => {
      fallback.hidden = false;
      fallback.value = text;
      fallback.select();
      status.textContent = "Select and copy the text below";
    };
    try {
      navigator.clipboard.writeText(text).then(done, manual);
    } catch {
      manual();
    }
  });
  reset.addEventListener("click", () => setLettering({ ...DEFAULT_LETTERING }));

  /** The time of day showing right now. */
  const editing = (): TimeName => (state.mode === "Auto" ? lookAt(state.looks).name : state.mode);

  function setMode(mode: "Auto" | TimeName) {
    state.mode = mode;
    save(state);
    stopClock?.();
    stopClock = null;
    if (mode === "Auto") stopClock = followClock(ctl, () => state.looks, false);
    else ctl.setParams(state.looks[mode]);
    sync();
  }

  function sync() {
    const name = editing();
    for (const [n, b] of chips) b.setAttribute("aria-pressed", String(n === state.mode));
    chips.get("Auto")!.textContent = state.mode === "Auto" ? `Auto · ${name}` : "Auto";
    note.textContent = state.mode === "Auto" ? "follows your clock" : `showing ${name} (${TIME_HOURS[name]})`;
  }

  setMode(state.mode);
  container.appendChild(root);
  return () => {
    stopClock?.();
    unmountRecorder();
    root.remove();
  };
}
