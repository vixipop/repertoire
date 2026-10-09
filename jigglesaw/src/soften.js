import * as THREE from 'three';

// A gentle finishing pass. The scene renders (multisampled) into a target,
// then one full-screen draw blends each pixel a little towards its
// neighbours: very slightly everywhere, and more where depth jumps — the
// silhouettes against the table and between pieces — so no edge reads as a
// hard cut. Tone mapping and sRGB happen here, at the very end.

export function createSoften(renderer) {
  const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
  target.depthTexture = new THREE.DepthTexture(1, 1);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: target.texture },
      tDepth: { value: target.depthTexture },
      texel: { value: new THREE.Vector2() },
      near: { value: 0.1 },
      far: { value: 200 },
      base: { value: 0.16 }, // everywhere: barely there
      edge: { value: 0.7 }, // on silhouettes
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform vec2 texel;
      uniform float near, far, base, edge;
      varying vec2 vUv;
      float viewZ(vec2 uv) {
        float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
        return 2.0 * near * far / (far + near - z * (far - near));
      }
      void main() {
        vec3 c = texture2D(tColor, vUv).rgb;
        float z0 = viewZ(vUv);
        vec3 sum = c * 4.0;
        float w = 4.0;
        float jump = 0.0;
        // 8 neighbours, a pixel and a quarter out; diagonals count less.
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.7853982;
          vec2 o = vec2(cos(a), sin(a)) * 1.25 * texel;
          float k = mod(float(i), 2.0) < 0.5 ? 2.0 : 1.0;
          sum += texture2D(tColor, vUv + o).rgb * k;
          w += k;
          jump = max(jump, abs(viewZ(vUv + o) - z0) / z0);
        }
        vec3 soft = sum / w;
        float e = smoothstep(0.003, 0.02, jump);
        gl_FragColor = vec4(mix(c, soft, clamp(base + edge * e, 0.0, 1.0)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.Camera();
  const size = new THREE.Vector2();

  return {
    // Match the drawing buffer; call after any size or pixel-ratio change.
    resize() {
      renderer.getDrawingBufferSize(size);
      target.setSize(size.x, size.y);
      material.uniforms.texel.value.set(1 / size.x, 1 / size.y);
    },
    render(world, camera) {
      material.uniforms.near.value = camera.near;
      material.uniforms.far.value = camera.far;
      renderer.setRenderTarget(target);
      renderer.render(world, camera);
      renderer.setRenderTarget(null);
      renderer.render(scene, cam);
    },
  };
}
