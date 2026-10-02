/**
 * Colour and paint controls for the pond. Plain DOM so the same panel works
 * in the React component and in the standalone preview page.
 */

import { DEFAULT_PARAMS, PARAM_SPECS, PRESETS, type PondController, type PondParams } from "./swan-pond-engine";

const STORAGE_KEY = "swan-pond-params";

export function loadSavedParams(): Partial<PondParams> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PondParams>) : {};
  } catch {
    return {};
  }
}

function save(p: PondParams) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* private mode or blocked storage: the sliders still work */
  }
}

const hueTrack = (s: number, l: number) =>
  `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => `hsl(${h} ${s}% ${l}%)`).join(", ")})`;

export function mountTuner(container: HTMLElement, ctl: PondController): () => void {
  const root = document.createElement("div");
  root.className = "pond-tuner";

  const head = document.createElement("div");
  head.className = "pond-tuner-presets";
  const presetLabel = document.createElement("span");
  presetLabel.className = "pond-tuner-label";
  presetLabel.textContent = "Presets";
  head.appendChild(presetLabel);
  const presetButtons: HTMLButtonElement[] = [];
  for (const preset of PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pond-tuner-chip";
    b.textContent = preset.name;
    b.addEventListener("click", () => apply(preset.params));
    head.appendChild(b);
    presetButtons.push(b);
  }
  root.appendChild(head);

  const groups = document.createElement("div");
  groups.className = "pond-tuner-groups";
  const inputs = new Map<keyof PondParams, { input: HTMLInputElement; out: HTMLOutputElement }>();
  for (const group of ["Water", "Swans", "Painting"] as const) {
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
      input.className = spec.kind === "hue" ? "pond-tuner-range is-hue" : "pond-tuner-range";
      const out = document.createElement("output");
      out.htmlFor.add(id);
      input.addEventListener("input", () => {
        apply({ [spec.key]: Number(input.value) } as Partial<PondParams>);
      });
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
    const text = JSON.stringify(ctl.getParams());
    const done = () => {
      status.textContent = "Copied";
      setTimeout(() => (status.textContent = ""), 1600);
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
  reset.addEventListener("click", () => apply(DEFAULT_PARAMS));

  function sync() {
    const p = ctl.getParams();
    const waterL = Math.round(28 + p.waterLight * 30);
    for (const spec of PARAM_SPECS) {
      const ui = inputs.get(spec.key)!;
      const v = p[spec.key];
      ui.input.value = String(v);
      ui.out.textContent = spec.kind === "hue" ? `${Math.round(v)}°` : `${Math.round((v / spec.max) * 100)}`;
    }
    // tracks preview the colour you're choosing
    inputs.get("waterHue")!.input.style.background = hueTrack(Math.round(p.waterSat * 100), waterL);
    inputs.get("waterSat")!.input.style.background = `linear-gradient(to right, hsl(${p.waterHue} 0% ${waterL}%), hsl(${p.waterHue} 100% ${waterL}%))`;
    inputs.get("waterLight")!.input.style.background = `linear-gradient(to right, hsl(${p.waterHue} ${p.waterSat * 100}% 6%), hsl(${p.waterHue} ${p.waterSat * 100}% 60%))`;
    inputs.get("swanHue")!.input.style.background = hueTrack(60, 78);
    inputs.get("swanTint")!.input.style.background = `linear-gradient(to right, #fbfaf7, hsl(${p.swanHue} 60% 72%))`;
    root.style.setProperty("--pond-swatch", `hsl(${p.waterHue} ${p.waterSat * 100}% ${waterL}%)`);
    const match = PRESETS.findIndex((pr) => (Object.keys(pr.params) as Array<keyof PondParams>).every((k) => Math.abs(pr.params[k] - p[k]) < 1e-6));
    presetButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(i === match)));
  }

  function apply(p: Partial<PondParams>) {
    ctl.setParams(p);
    save(ctl.getParams());
    sync();
  }

  sync();
  container.appendChild(root);
  return () => root.remove();
}
