import * as THREE from 'three';

// The foam is cut from a 3D field, not a texture: bubbles are spheres in
// space, so wherever a wall slices through one you get a pore with the
// right shape, curved edges included. Each piece samples the field at its
// place in the uncut slab, so pores carry on across a seam.
const FOAM_GLSL = /* glsl */ `
  uniform vec3 uFoam;
  uniform vec3 uFoamDeep;
  uniform vec3 uCard;
  uniform vec3 uBacking;
  uniform float uTop;
  uniform float uCardT;
  uniform float uBackT;
  uniform float uBump;
  uniform sampler2D uPrint;
  uniform vec2 uSheet;
  uniform float uPad;
  varying vec3 vFoamP;
  float foamH = 0.0;

  vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
  }

  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash33(i).x, b = hash33(i + vec3(1, 0, 0)).x;
    float c = hash33(i + vec3(0, 1, 0)).x, d = hash33(i + vec3(1, 1, 0)).x;
    float e = hash33(i + vec3(0, 0, 1)).x, g = hash33(i + vec3(1, 0, 1)).x;
    float k = hash33(i + vec3(0, 1, 1)).x, l = hash33(i + vec3(1, 1, 1)).x;
    return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(k, l, f.x), f.y), f.z);
  }

  // 0 on solid foam, rising towards 1 at the bottom of a pore.
  float pores(vec3 p, float aa, float fill) {
    vec3 i = floor(p), f = fract(p);
    float best = 0.0;
    for (int z = -1; z <= 1; z++)
    for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 h = hash33(i + g);
      if (h.z > fill) continue;            // not every cell holds a bubble
      vec3 c = g + 0.2 + 0.6 * h;
      float r = mix(0.16, 0.5, h.x * h.y);
      float d = length(f - c);
      float edge = 1.0 - smoothstep(r - aa, r + aa, d);
      float depth = sqrt(clamp(1.0 - d / r, 0.0, 1.0));
      best = max(best, edge * (0.35 + 0.65 * depth));
    }
    return best;
  }
`;

export function foamMaterial({ top, cardT, backT, print, sheet, pad }) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0 });
  const uniforms = {
    uFoam: { value: new THREE.Color('#2a7349') },
    uFoamDeep: { value: new THREE.Color('#103522') },
    uCard: { value: new THREE.Color('#e9e4d8') },
    uBacking: { value: new THREE.Color('#ebe8e1') },
    uTop: { value: top },
    uCardT: { value: cardT },
    uBackT: { value: backT },
    uBump: { value: 1.1 },
    uPrint: { value: print },
    uSheet: { value: sheet },
    uPad: { value: pad },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 slab;\nvarying vec3 vFoamP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoamP = position + slab;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FOAM_GLSL}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          float y = vFoamP.y;
          vec3 p1 = vFoamP * 21.0;
          vec3 p2 = vFoamP * 52.0 + 17.0;
          vec3 p3 = vFoamP * 120.0 + 41.0;
          float a3 = length(fwidth(p3)) * 0.6 + 0.02;
          float a1 = length(fwidth(p1)) * 0.6 + 0.02;
          float a2 = length(fwidth(p2)) * 0.6 + 0.02;
          // Far away the small pores would shimmer; fade them out instead.
          float fine = 1.0 - smoothstep(0.25, 0.6, a2);
          float big = pores(p1, a1, 0.62);
          float small = pores(p2, a2, 0.95) * fine;
          // Open cells: a dense field of tiny pits that gives the surface its tooth.
          float cells = pores(p3, a3, 1.0) * (1.0 - smoothstep(0.2, 0.5, a3));
          float pore = max(big, small * 0.8);

          float grain = vnoise(vFoamP * 260.0) * fine;
          float mottle = vnoise(vFoamP * 140.0 + 3.0);
          float tone = vnoise(vFoamP * 5.0);
          vec3 foam = uFoam * (0.82 + 0.24 * tone + 0.22 * (grain - 0.5) + 0.18 * (mottle - 0.5));
          foam *= 1.0 - 0.28 * cells;
          foam = mix(foam, uFoamDeep, smoothstep(0.05, 0.85, pore));

          // The printed card on top and the white backing card underneath.
          float card = smoothstep(uTop - uCardT - 0.002, uTop - uCardT + 0.002, y);
          float back = 1.0 - smoothstep(uBackT - 0.002, uBackT + 0.002, y);
          // Darker where the foam meets the table.
          foam *= mix(0.62, 1.0, smoothstep(0.0, 0.14, y));
          // The card's cut edge: print colour wrapping over the bevel, with a
          // hairline of white card core under it. Sheet coords come from slab.
          vec2 sheet = vec2(vFoamP.x, -vFoamP.z);
          vec3 printed = texture2D(uPrint, (sheet + uPad) / uSheet).rgb * 0.82;
          float core = smoothstep(uTop - uCardT * 0.45, uTop - uCardT * 0.35, y);
          vec3 edge = mix(uCard, printed, core);
          vec3 col = mix(foam, edge, card);
          col = mix(col, uBacking, back);
          diffuseColor.rgb = col;
          foamH = (-pore * 0.9 - cells * 0.35 + (grain - 0.5) * 0.15) * (1.0 - max(card, back));
        }`
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        {
          // Bump from the pore height, same maths as three's bumpmap chunk.
          vec3 sx = normalize(dFdx(-vViewPosition)), sy = normalize(dFdy(-vViewPosition));
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
          float det = dot(sx, r1) * faceDirection;
          vec2 dh = vec2(dFdx(foamH), dFdy(foamH)) * uBump;
          vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
          normal = normalize(abs(det) * normal - grad);
        }`
      );
  };
  mat.customProgramCacheKey = () => 'foam-v2';
  return mat;
}

// The laminated print: glossy on top, plain card underneath.
export function printMaterial(map) {
  const mat = new THREE.MeshPhysicalMaterial({
    map,
    roughness: 0.42,
    clearcoat: 0.8,
    clearcoatRoughness: 0.22,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = normal.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vUp;')
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\nif (vUp < 0.0) diffuseColor.rgb = vec3(0.83, 0.81, 0.77);'
      );
  };
  mat.customProgramCacheKey = () => 'print-v1';
  return mat;
}
