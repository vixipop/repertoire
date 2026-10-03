/**
 * Pond shaders.
 *
 * Ported from the Shadertoy advecting-caustics pair plus a wave-equation
 * ripple sim. Three passes per frame:
 *   BUFFER_A  caustics, advected through a divergence-free flow field
 *             (feedback: reads last frame's output)
 *   RIPPLE    2D wave equation at a fraction of canvas resolution
 *             (touch + swan turns inject impulses)
 *   IMAGE     composites the two to screen, bump-mapping the water with the
 *             ripple heightfield
 *
 * Changes from the standalone version:
 *   - the sunlight toggle/branch is gone
 *   - IMAGE takes a uLight uniform that scales the ripple diffuse shading (which also sets the water's
 *     ambient floor) so the pond can go properly dark (uLight = 1 reproduces the original exactly)
 *   - IMAGE only evaluates gradient() while the pointer is down, which is the
 *     only place it was used (saves four 3D noise evaluations per pixel per
 *     frame; output is identical)
 */

export const COMMON = `
#define SHANES_SUNLIGHT
#define TIMESCALE 1.0
#define pi 3.1415926
#define tau (pi+pi)

vec2 hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx+33.33);
  return fract((p3.xx+p3.yz)*p3.zy);
}
vec3 hash33(vec3 p3){
  p3 = fract(p3 * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yxz+33.33);
  return fract((p3.xxy + p3.yxx)*p3.zyx);
}
vec2 grad(ivec2 z){ return hash22(vec2(z)*123.456) * 2.0 - 1.0; }
float noise(in vec2 p){
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix( mix( dot( grad( i+ivec2(0,0) ), f-vec2(0.0,0.0) ),
                   dot( grad( i+ivec2(1,0) ), f-vec2(1.0,0.0) ), u.x),
              mix( dot( grad( i+ivec2(0,1) ), f-vec2(0.0,1.0) ),
                   dot( grad( i+ivec2(1,1) ), f-vec2(1.0,1.0) ), u.x), u.y);
}
vec3 grad(ivec3 v){ return hash33(vec3(v))*2.0-1.0; }
float noise(vec3 p){
  ivec3 i = ivec3(floor(p));
  vec3  f = fract(p);
  vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(
    mix(
      mix( dot(grad(i+ivec3(0,0,0)), f-vec3(0,0,0)), dot(grad(i+ivec3(1,0,0)), f-vec3(1,0,0)), u.x),
      mix( dot(grad(i+ivec3(0,1,0)), f-vec3(0,1,0)), dot(grad(i+ivec3(1,1,0)), f-vec3(1,1,0)), u.x),
      u.y
    ),
    mix(
      mix( dot(grad(i+ivec3(0,0,1)), f-vec3(0,0,1)), dot(grad(i+ivec3(1,0,1)), f-vec3(1,0,1)), u.x),
      mix( dot(grad(i+ivec3(0,1,1)), f-vec3(0,1,1)), dot(grad(i+ivec3(1,1,1)), f-vec3(1,1,1)), u.x),
      u.y
    ),
    u.z
  );
}
float map(float t, vec2 p){ return noise(vec3(p, t*0.1*TIMESCALE)); }
vec2 gradient(float t, vec2 p){
  float eps = 0.001;
  vec2 h = vec2(1,0)*eps;
  return (vec2(map(t, p+h.xy) - map(t, p-h.xy),
               map(t, p+h.yx) - map(t, p-h.yx)))/eps/2.0;
}
vec2 tangent(float t, vec2 p){
  vec2 g = gradient(t, p);
  return vec2(-g.y, g.x);
}
// the ripple heightfield oscillates around 0, but our textures are plain 8-bit unsigned --
// so signed height is biased/scaled into 0..1 for storage and unpacked back out when read.
float rdecode(float v){ return (v-0.5)*2.0; }
float rencode(float v){ return clamp(v*0.5+0.5, 0.0, 1.0); }
`;

export const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
void main(){ gl_Position = vec4(aPos,0.0,1.0); }
`;

export const BUFFER_A = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 iResolution;
uniform float iTime;
uniform int iFrame;
uniform sampler2D iChannel0;
uniform float uScale;
uniform vec3 uDeep;
uniform vec3 uBright;
out vec4 fragColor;
${COMMON}
#define MAX_ITER 5

vec3 caustics(float time, vec2 uv){
  vec2 p = mod(uv*tau, tau)-250.0;
  vec2 i = vec2(p);
  float f = 1.0;
  float inten = .005;
  for (int n = 0; n < MAX_ITER; n++){
    float t = (time+5.0) * (1.0 - (3.5 / float(n+1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    f += 1.0/length(vec2(p.x/(sin(i.x+t)/inten),p.y/(cos(i.y+t)/inten)));
  }
  float v = clamp(pow(abs(1.17-pow(f / float(MAX_ITER), 1.4)), 8.0), 0.0, 1.0);
  v = pow(v, 1.6); // extra contrast: pushes midtones toward the deep color, keeps highlights punchy
  return mix(uDeep, uBright, v);
}

void mainImage(out vec4 o, in vec2 i){
  vec2 r = iResolution.xy;
  vec2 p = (i+i-r)/r.y;
  vec2 uv = i/r;
  vec3 water;
  if(iFrame <= 0){
    water = caustics(0.0, uv*uScale);
  } else {
    vec2 srcUV = uv - tangent(iTime, p*uScale)*0.01*TIMESCALE*r.y/r;
    water = mix(texture(iChannel0, srcUV).rgb, caustics(iTime*0.5, uv*uScale), 0.05);
  }
  o = vec4(water, 1.0);
}
void main(){ mainImage(fragColor, gl_FragCoord.xy); }
`;

export const RIPPLE = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 iResolution;
uniform int iFrame;
uniform sampler2D iChannel0;
uniform vec4 uImpulses[3]; // xy = pixel position, z = radius (px), w = strength (0 = inactive)
uniform int uImpulseCount;
out vec4 fragColor;
${COMMON}

void mainImage(out vec4 o, in vec2 fragCoord){
  vec2 res = iResolution.xy;
  vec2 q = fragCoord/res;
  vec3 e = vec3(vec2(1.0)/res, 0.0);

  vec4 c = texture(iChannel0, q);
  float p11 = c.y;
  float p10 = texture(iChannel0, q-e.zy).x;
  float p01 = texture(iChannel0, q-e.xz).x;
  float p21 = texture(iChannel0, q+e.xz).x;
  float p12 = texture(iChannel0, q+e.zy).x;

  float d = 0.0;
  for(int k=0; k<3; k++){
    if(k >= uImpulseCount) break;
    vec4 im = uImpulses[k];
    if(im.w <= 0.0) continue;
    float dist = length(fragCoord - im.xy);
    d += im.w * (1.0 - smoothstep(0.0, im.z, dist));
  }

  d += (p10 + p01 + p21 + p12) / 2.0 - p11;
  d *= 0.84; // dampening -- a single impulse should be essentially gone within ~1 second
  d *= float(iFrame >= 2); // clear the buffer at start
  if(fragCoord.x < 1.0 || fragCoord.x > res.x-1.0 || fragCoord.y < 1.0 || fragCoord.y > res.y-1.0) d = 0.0;

  o = vec4(d, c.x, 0.0, 1.0);
}
void main(){ mainImage(fragColor, gl_FragCoord.xy); }
`;

export const IMAGE = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform vec2 uRippleRes;
uniform float uLight; // 1.0 = the original look; <1 lowers the water's ambient lift (night)
out vec4 fragColor;
${COMMON}

float aastep(float s, float d){
  float r = iResolution.y;
  return smoothstep(-1.5*s/r, +1.5*s/r, d);
}

vec3 image(vec2 i){
  vec2 r = iResolution.xy;
  vec2 p = (i + i - r) / r.y;
  vec3 c = vec3(0);
  c = texture(iChannel0, i/r.xy).xyz;


  // --- real ripple wave physics: bump-map the water surface with the
  // simulated heightfield, driven by touch and by each swan's own turning -- applied last so
  // it always shows through on top, the way light catching a ripple would in real life ---
  {
    vec2 q = i/r;
    vec3 re = vec3(vec2(1.0)/uRippleRes, 0.0); // must match the ripple buffer's own texel size, not the canvas's
    float rp10 = texture(iChannel1, q-re.zy).x;
    float rp01 = texture(iChannel1, q-re.xz).x;
    float rp21 = texture(iChannel1, q+re.xz).x;
    float rp12 = texture(iChannel1, q+re.zy).x;
    vec3 rgrad = normalize(vec3((rp21-rp01)*45.0, (rp12-rp10)*45.0, 1.0));
    vec3 rlight = normalize(vec3(0.25,-0.5,0.75));
    float rdiffuse = dot(rgrad, rlight);
    float rspec = pow(max(0.0, -reflect(rlight, rgrad).z), 24.0);
    // Diffuse shading follows the light level, dips included -- scaling only the flat-water lift
    // lets a turning swan's trough clip to pure black at night. The specular glint stays at full
    // strength, so ripples still catch light after dark. uLight = 1 is the original, exactly.
    c += rdiffuse*0.09*uLight + rspec*0.32;
  }

  if(iMouse.z > 0.0){
    vec2 g = gradient(iTime, p); // only needed while pressed -- 4 noise evals saved per pixel otherwise
    c = max(c, vec3(pow(0.5+0.5*sin(map(iTime, p)*tau*10.0),0.1*r.y/dot(g,g))));
  }
  c = sqrt(c);
  return c;
}
void mainImage(out vec4 q, in vec2 p){ q = vec4(image(p), 1); }
void main(){ mainImage(fragColor, gl_FragCoord.xy); }
`;
