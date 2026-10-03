/**
 * Time-of-day and colour controls for the pond. Plain DOM so the same panel
 * works in the React component and in the standalone preview page.
 *
 * "Auto" follows the viewer's clock. Picking a time previews it, and the
 * sliders then edit that time's look. "Copy settings" copies all four looks.
 */

import { GLOBAL_KEYS, PARAM_SPECS, type PondController, type PondParams, type TimeName } from "./swan-pond-engine";
import { TIME_HOURS, TIME_NAMES, defaultLooks, followClock, lookAt, type Looks } from "./swan-pond-time";

const STORAGE_KEY = "swan-pond-looks-v3";

type Saved = { looks: Looks; mode: "Auto" | TimeName };

export function loadSaved(): Saved {
  const base = defaultLooks();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Saved>;
      for (const n of TIME_NAMES) if (s.looks?.[n]) base[n] = { ...base[n], ...s.looks[n] };
      return { looks: base, mode: s.mode ?? "Auto" };
    }
  } catch {
    /* storage blocked: start from the defaults */
  }
  return { looks: base, mode: "Auto" };
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

const hueTrack = (s: number, l: number) =>
  `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => `hsl(${h} ${s}% ${l}%)`).join(", ")})`;

export function mountTuner(container: HTMLElement, ctl: PondController): () => void {
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

  const groups = document.createElement("div");
  groups.className = "pond-tuner-groups";
  const inputs = new Map<keyof PondParams, { input: HTMLInputElement; out: HTMLOutputElement }>();
  for (const group of ["Water", "Light", "Swans", "Feeder", "Painting"] as const) {
    const fs = document.createElement("fieldset");
    fs.className = "pond-tuner-group";
    const lg = document.createElement("legend");
    lg.textContent = group;
    fs.appendChild(lg);
    for (const spec of PARAM_SPECS.filter((s) => s.group === group)) {
      const row = document.createElement("div");
      row.className = "pond-tuner-row";
      const id = `pond-${spec.key}`;
      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = spec.label;
      const input = document.createElement("input");
      input.type = "range";
      input.id = id;
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.className = "pond-tuner-range";
      const out = document.createElement("output");
      out.htmlFor.add(id);
      input.addEventListener("input", () => edit(spec.key, Number(input.value)));
      row.append(label, input, out);
      fs.appendChild(row);
      inputs.set(spec.key, { input, out });
    }
    groups.appendChild(fs);
  }
  root.appendChild(groups);

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
  root.append(actions, fallback);

  copy.addEventListener("click", () => {
    const text = JSON.stringify(state.looks);
    const done = () => {
      status.textContent = "Copied all four times of day";
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
  reset.addEventListener("click", () => {
    state.looks = defaultLooks();
    save(state);
    setMode(state.mode);
  });

  /** The look the sliders are editing right now. */
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

  function edit(key: keyof PondParams, v: number) {
    // the feeder's colour is part of the scene, not the hour: change it everywhere
    if (GLOBAL_KEYS.has(key)) {
      for (const n of TIME_NAMES) state.looks[n][key] = v;
      save(state);
      ctl.setParams({ [key]: v } as Partial<PondParams>);
      sync();
      return;
    }
    // editing while on Auto pins the time that's showing, so you see exactly what you change
    if (state.mode === "Auto") {
      state.mode = editing();
      stopClock?.();
      stopClock = null;
    }
    state.looks[state.mode as TimeName][key] = v;
    save(state);
    ctl.setParams({ [key]: v } as Partial<PondParams>);
    sync();
  }

  function sync() {
    const name = editing();
    const p = state.mode === "Auto" ? lookAt(state.looks).params : state.looks[name];
    for (const spec of PARAM_SPECS) {
      const ui = inputs.get(spec.key)!;
      const v = p[spec.key];
      ui.input.value = String(v);
      ui.out.textContent = spec.kind === "hue" ? `${Math.round(v)}°` : `${Math.round((v / spec.max) * 100)}`;
    }
    for (const [n, b] of chips) b.setAttribute("aria-pressed", String(n === state.mode));
    chips.get("Auto")!.textContent = state.mode === "Auto" ? `Auto · ${name}` : "Auto";
    note.textContent = state.mode === "Auto" ? "follows your clock" : `editing ${name} (${TIME_HOURS[name]})`;

    // tracks preview the colour you're choosing
    const waterL = Math.round(28 + p.waterLight * 30);
    inputs.get("waterHue")!.input.style.background = hueTrack(Math.round(p.waterSat * 100), waterL);
    inputs.get("waterSat")!.input.style.background = `linear-gradient(to right, hsl(${p.waterHue} 0% ${waterL}%), hsl(${p.waterHue} 100% ${waterL}%))`;
    inputs.get("waterLight")!.input.style.background = `linear-gradient(to right, hsl(${p.waterHue} ${p.waterSat * 100}% 6%), hsl(${p.waterHue} ${p.waterSat * 100}% 60%))`;
    inputs.get("lightHue")!.input.style.background = hueTrack(70, 70);
    inputs.get("lightSat")!.input.style.background = `linear-gradient(to right, hsl(${p.lightHue} 0% 78%), hsl(${p.lightHue} 90% 70%))`;
    inputs.get("skyHue")!.input.style.background = hueTrack(55, 72);
    inputs.get("skySat")!.input.style.background = `linear-gradient(to right, hsl(${p.skyHue} 0% 72%), hsl(${p.skyHue} 80% 65%))`;
    inputs.get("swanHue")!.input.style.background = hueTrack(60, 78);
    inputs.get("bowlHue")!.input.style.background = hueTrack(70, 45);
    inputs.get("bowlLight")!.input.style.background = `linear-gradient(to right, hsl(${p.bowlHue} 70% 12%), hsl(${p.bowlHue} 70% 50%), hsl(${p.bowlHue} 70% 84%))`;
    inputs.get("swanTint")!.input.style.background = `linear-gradient(to right, #fbfaf7, hsl(${p.swanHue} 60% 72%))`;
    root.style.setProperty("--pond-swatch", `hsl(${p.waterHue} ${p.waterSat * 100}% ${waterL}%)`);
  }

  setMode(state.mode);
  container.appendChild(root);
  return () => {
    stopClock?.();
    root.remove();
  };
}
