"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import SplineLoader from "@splinetool/loader";

const SCENE_URL = "https://prod.spline.design/uUFFhtz6UzQYnRGG/scene.splinecode";

/** Fraction of the container the model should fill once framed. */
const FILL = 0.82;

type Status = "loading" | "ready" | "error";

/**
 * Spline scene rendered through plain three.js.
 *
 * Adapted from Spline's Three.js code export, which targets a full-window
 * demo: it sized to `window`, appended to `document.body`, and painted an
 * opaque #111111 background. Here it's scoped to its container, transparent so
 * the page's own palette shows through, and torn down on unmount.
 */
export default function SplineScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;

    const scene = new THREE.Scene();

    // Orthographic, as authored in Spline. The frustum is in pixels, so it's
    // derived from the container rather than the window; `zoom` does the
    // fitting once we know how big the model actually is.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100000, 100000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearAlpha(0); // let the page background show through
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.125;
    // Wheel-zoom and pan would swallow page scrolling over the canvas, and
    // one-finger rotate would trap touch scrolling on mobile. Drag to orbit on
    // a pointer; everywhere else the auto-rotate carries it.
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.touches = { ONE: null as unknown as THREE.TOUCH, TWO: null as unknown as THREE.TOUCH };
    // OrbitControls writes `touch-action: none` onto the canvas, which kills
    // vertical page scrolling over it even with touch gestures disabled above.
    renderer.domElement.style.touchAction = "pan-y";
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.6;

    function resize() {
      const { clientWidth: w, clientHeight: h } = host!;
      if (!w || !h) return;
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }

    /**
     * Frame whatever loaded.
     *
     * The export hard-codes camera position (43.69, 2015.9, 1000) with an
     * identity rotation — a straight-on front view of content sitting far up
     * the Y axis. Those numbers only frame correctly at the window size it was
     * exported at, and OrbitControls would immediately swing to its (0,0,0)
     * target anyway. So: keep the authored front-on angle, derive position and
     * zoom from the model's bounds.
     */
    function frame(model: THREE.Object3D) {
      const box = new THREE.Box3().setFromObject(model);
      if (box.isEmpty()) return;

      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      controls.target.copy(center);
      camera.position.set(center.x, center.y, center.z + 10000);
      camera.lookAt(center);

      const { clientWidth: w, clientHeight: h } = host!;
      camera.zoom = Math.min(w / (size.x || 1), h / (size.y || 1)) * FILL;
      camera.updateProjectionMatrix();
      controls.update();
    }

    const loader = new SplineLoader();
    loader.load(
      SCENE_URL,
      (splineScene: THREE.Object3D) => {
        if (disposed) return;
        scene.add(splineScene);

        // .splinecode carries the scene's own lights, unlike a GLB export.
        // Only add fallback lighting if it turns out there aren't any.
        let hasLight = false;
        splineScene.traverse((o) => {
          if ((o as THREE.Light).isLight) hasLight = true;
        });
        if (!hasLight) {
          scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
          const key = new THREE.DirectionalLight(0xffffff, 1.4);
          key.position.set(1, 2, 3);
          scene.add(key);
        }

        resize();
        frame(splineScene);
        setStatus("ready");
      },
      undefined,
      () => {
        if (!disposed) setStatus("error");
      },
    );

    // Don't burn frames when the canvas is scrolled out of view.
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), {
      threshold: 0,
    });
    io.observe(host);

    renderer.setAnimationLoop(() => {
      if (!visible) return;
      controls.update();
      renderer.render(scene, camera);
    });

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      io.disconnect();
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="spline-stage" data-status={status}>
      <div className="spline-canvas" ref={hostRef} aria-hidden="true" />
      {status !== "ready" && (
        <p className="spline-fallback">
          {status === "loading" ? "Loading…" : "The 3D scene couldn’t load."}
        </p>
      )}
    </div>
  );
}
