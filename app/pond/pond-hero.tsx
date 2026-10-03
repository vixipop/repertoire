"use client";

import { useEffect, useRef } from "react";
import { BUFFER_A, IMAGE, RIPPLE, VERT } from "./shaders";
import { SWAN_SPECS, SwanSim } from "./swans";
import { currentHour, resolveLook } from "./time-of-day";

/** Tuned by eye in the standalone pond; these are its final values. */
const WAVE_SCALE = 1.7; // caustic pattern scale
const SPEED = 0.35; // sim-time per real second
const RIPPLE_SCALE = 0.13; // the wave sim runs at this fraction of canvas size
const MAX_DPR = 1.5; // the water is soft; past 1.5x only costs fill rate

/**
 * The swan pond, as a hero.
 *
 * Three fragment-shader passes per frame (advected caustics, a wave-equation
 * ripple sim, and a composite) with no geometry beyond one full-screen
 * triangle. Swans are DOM sprites steered by `SwanSim`; the instant one is
 * turning it injects a ripple into the wave buffer, the same buffer a press or
 * drag feeds. The water palette follows the local clock: dawn, day, dusk, dark.
 *
 * Lifecycle: the canvas is created inside the effect (so React strict-mode's
 * double mount gets a fresh context rather than a lost one), the loop pauses
 * while the hero is off-screen, and everything is released on unmount.
 */
export default function PondHero() {
  const hostRef = useRef<HTMLDivElement>(null);
  const swanRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- time of day -------------------------------------------------------
    let look = resolveLook(currentHour(window.location.search));
    const applyLook = () => {
      look = resolveLook(currentHour(window.location.search));
      host.style.setProperty("--pond-plate", look.plate);
      host.style.setProperty("--swan-brightness", look.swanBrightness.toFixed(3));
      host.style.setProperty("--swan-sepia", look.swanSepia.toFixed(3));
      host.dataset.phase = look.phase;
    };
    applyLook();
    // The clock moves slowly, so a coarse refresh is invisible — and the
    // caustic feedback buffer smooths whatever step remains.
    const clock = window.setInterval(applyLook, 30_000);

    // ---- GL setup ----------------------------------------------------------
    const canvas = document.createElement("canvas");
    canvas.className = "pond-canvas";
    host.prepend(canvas);

    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: false });
    if (!gl) {
      host.dataset.status = "unsupported";
      return () => {
        window.clearInterval(clock);
        canvas.remove();
      };
    }

    const floatOK = !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));

    const compile = (type: number, source: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };
    const link = (fragment: string) => {
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fs = compile(gl.FRAGMENT_SHADER, fragment);
      if (!vs || !fs) return null;
      const p = gl.createProgram()!;
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(p));
        return null;
      }
      return p;
    };

    const progA = link(BUFFER_A);
    const progRipple = link(RIPPLE);
    const progImg = link(IMAGE);
    if (!progA || !progRipple || !progImg) {
      host.dataset.status = "unsupported";
      return () => {
        window.clearInterval(clock);
        canvas.remove();
      };
    }

    // One oversized triangle covers the screen.
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const drawQuad = () => {
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const u = (p: WebGLProgram, name: string) => gl.getUniformLocation(p, name);
    const uA = {
      res: u(progA, "iResolution"), time: u(progA, "iTime"), frame: u(progA, "iFrame"),
      prev: u(progA, "iChannel0"), scale: u(progA, "uScale"), deep: u(progA, "uDeep"), bright: u(progA, "uBright"),
    };
    const uR = {
      res: u(progRipple, "iResolution"), frame: u(progRipple, "iFrame"), prev: u(progRipple, "iChannel0"),
      impulses: u(progRipple, "uImpulses"), count: u(progRipple, "uImpulseCount"),
    };
    const uI = {
      res: u(progImg, "iResolution"), time: u(progImg, "iTime"), mouse: u(progImg, "iMouse"),
      water: u(progImg, "iChannel0"), ripple: u(progImg, "iChannel1"), rippleRes: u(progImg, "uRippleRes"),
      light: u(progImg, "uLight"),
    };

    type Target = { fbo: WebGLFramebuffer; tex: WebGLTexture };
    const made: Target[] = [];

    function makeTarget(w: number, h: number, float: boolean): Target | null {
      const tex = gl!.createTexture()!;
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
      // The ripple heightfield swings through negative values, so it needs real
      // (unclamped) float storage — an 8-bit target clips the wave and the clipping
      // feeds back into the sim until it blows up.
      gl!.texImage2D(
        gl!.TEXTURE_2D, 0, float ? gl!.RGBA16F : gl!.RGBA8, w, h, 0, gl!.RGBA,
        float ? gl!.HALF_FLOAT : gl!.UNSIGNED_BYTE, null,
      );
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      // Caustics tile; the ripple buffer must not wrap around its edges.
      const wrap = float ? gl!.CLAMP_TO_EDGE : gl!.REPEAT;
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, wrap);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, wrap);
      const fbo = gl!.createFramebuffer()!;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
      gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
      const ok = gl!.checkFramebufferStatus(gl!.FRAMEBUFFER) === gl!.FRAMEBUFFER_COMPLETE;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      const t = { fbo, tex };
      made.push(t);
      return ok ? t : null;
    }

    const free = () => {
      for (const t of made.splice(0)) {
        gl.deleteFramebuffer(t.fbo);
        gl.deleteTexture(t.tex);
      }
    };

    let W = 0, H = 0, RW = 1, RH = 1;
    let water: [Target, Target] | null = null;
    let waves: [Target, Target] | null = null;
    let rippleLive = false;
    let frame = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = Math.max(1, Math.round(host!.clientWidth * dpr));
      const h = Math.max(1, Math.round(host!.clientHeight * dpr));
      if (w === W && h === H) return false;
      W = w; H = h;
      canvas.width = w; canvas.height = h;
      free();
      const a = makeTarget(w, h, false)!;
      const b = makeTarget(w, h, false)!;
      water = [a, b];
      RW = Math.max(2, Math.round(w * RIPPLE_SCALE));
      RH = Math.max(2, Math.round(h * RIPPLE_SCALE));
      const r0 = makeTarget(RW, RH, floatOK);
      const r1 = makeTarget(RW, RH, floatOK);
      rippleLive = floatOK && !!r0 && !!r1;
      // No renderable float format: bind plain targets and skip the wave pass, so
      // the surface stays calm rather than showing what an 8-bit wave sim does.
      waves = rippleLive
        ? [r0!, r1!]
        : [makeTarget(RW, RH, false)!, makeTarget(RW, RH, false)!];
      frame = 0; // reseed caustics + ripple at the new size
      return true;
    }

    // ---- input -------------------------------------------------------------
    const mouse = { x: 0, y: 0, down: 0 };
    const setMouse = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      mouse.y = canvas.height - (e.clientY - r.top) * (canvas.height / r.height);
    };
    const onDown = (e: PointerEvent) => { mouse.down = 1; setMouse(e); };
    const onMove = (e: PointerEvent) => { if (mouse.down) setMouse(e); };
    const onUp = () => { mouse.down = 0; };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp); // a touch that turns into a page scroll

    // ---- swans -------------------------------------------------------------
    const sim = new SwanSim();
    const placeSwans = (t: number) => {
      sim.step(t).forEach((f, i) => {
        const el = swanRefs.current[i];
        if (!el) return;
        el.style.left = f.left.toFixed(2) + "%";
        el.style.top = f.top.toFixed(2) + "%";
        el.style.transform = f.transform;
      });
    };
    placeSwans(0);

    // ---- one frame ---------------------------------------------------------
    let simTime = 0;
    const impulseBuf = new Float32Array(12);

    function draw(dt: number) {
      if (!water || !waves) return;
      simTime += dt * SPEED;
      const t = simTime;

      const toB = frame % 2 === 0;
      const writeW = toB ? water[1] : water[0];
      const readW = toB ? water[0] : water[1];
      const writeR = toB ? waves[1] : waves[0];
      const readR = toB ? waves[0] : waves[1];

      placeSwans(t);

      // Pass 1 — caustics, advected by last frame's own output.
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, writeW.fbo);
      gl!.viewport(0, 0, W, H);
      gl!.useProgram(progA);
      gl!.uniform2f(uA.res, W, H);
      gl!.uniform1f(uA.time, t);
      gl!.uniform1i(uA.frame, frame);
      gl!.uniform1f(uA.scale, WAVE_SCALE);
      gl!.uniform3f(uA.deep, look.deep[0], look.deep[1], look.deep[2]);
      gl!.uniform3f(uA.bright, look.bright[0], look.bright[1], look.bright[2]);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, readW.tex);
      gl!.uniform1i(uA.prev, 0);
      drawQuad();

      // Pass 2 — wave equation. Skipped when there is no float target; the
      // surface then simply stays calm.
      if (rippleLive) {
        const impulses = sim.impulses();
        if (mouse.down) {
          impulses.push({ xFrac: mouse.x / W, yFrac: mouse.y / H, radiusFrac: 0.022, strength: 0.35 });
        }
        const rMax = Math.max(RW, RH);
        for (let k = 0; k < 3; k++) {
          const im = impulses[k];
          impulseBuf[k * 4 + 0] = im ? im.xFrac * RW : 0;
          impulseBuf[k * 4 + 1] = im ? im.yFrac * RH : 0;
          impulseBuf[k * 4 + 2] = im ? im.radiusFrac * rMax : 1;
          impulseBuf[k * 4 + 3] = im ? im.strength : 0;
        }
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, writeR.fbo);
        gl!.viewport(0, 0, RW, RH);
        gl!.useProgram(progRipple);
        gl!.uniform2f(uR.res, RW, RH);
        gl!.uniform1i(uR.frame, frame);
        gl!.uniform4fv(uR.impulses, impulseBuf);
        gl!.uniform1i(uR.count, Math.min(impulses.length, 3));
        gl!.activeTexture(gl!.TEXTURE0);
        gl!.bindTexture(gl!.TEXTURE_2D, readR.tex);
        gl!.uniform1i(uR.prev, 0);
        drawQuad();
      }

      // Pass 3 — composite to screen.
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      gl!.viewport(0, 0, W, H);
      gl!.useProgram(progImg);
      gl!.uniform2f(uI.res, W, H);
      gl!.uniform1f(uI.time, t);
      gl!.uniform4f(uI.mouse, mouse.x, mouse.y, mouse.down, 0);
      gl!.uniform2f(uI.rippleRes, RW, RH);
      gl!.uniform1f(uI.light, look.light);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, writeW.tex);
      gl!.uniform1i(uI.water, 0);
      gl!.activeTexture(gl!.TEXTURE1);
      gl!.bindTexture(gl!.TEXTURE_2D, rippleLive ? writeR.tex : readR.tex);
      gl!.uniform1i(uI.ripple, 1);
      drawQuad();

      frame++;
    }

    /** A few frames, so a static pond still has its caustics developed. */
    const drawStill = () => {
      for (let i = 0; i < 4; i++) draw(1 / 60);
    };

    // ---- loop --------------------------------------------------------------
    let raf = 0;
    let running = false;
    let visible = true;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1); // clamp: no jump after a pause
      last = now;
      draw(dt);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running || reduceMotion) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    if (reduceMotion) drawStill();
    else start();

    // Don't spend frames on a pond nobody can see.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(host);

    const ro = new ResizeObserver(() => {
      if (resize() && !running) drawStill(); // keep a paused / still pond from going blank
    });
    ro.observe(host);

    host.dataset.status = "live";

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      window.clearInterval(clock);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      free();
      gl.deleteBuffer(quad);
      gl.deleteProgram(progA);
      gl.deleteProgram(progRipple);
      gl.deleteProgram(progImg);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, []);

  return (
    <div
      className="pond-hero appear"
      ref={hostRef}
      role="img"
      aria-label="A pond with two swans. Press and drag on the water to make ripples."
      data-status="loading"
    >
      <div className="pond-swans" aria-hidden="true">
        {SWAN_SPECS.map((s, i) => (
          <div
            key={s.key}
            className="pond-swan"
            style={{ width: `${s.widthPct}%` }}
            ref={(el) => {
              swanRefs.current[i] = el;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/swans/swan-${s.key}.png`} alt="" draggable={false} />
          </div>
        ))}
      </div>
    </div>
  );
}
