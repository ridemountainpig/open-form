// A tank of still water that the fragrance is mixed in. Each note chosen is a
// drop of ink: top notes stay near the surface, heart notes hang in the
// middle, base notes sink and pool at the bottom. The plumes billow through a
// slowly drifting flow field and mix like real pigment (subtractive on light
// water, glowing on dark). The concentration darkens the ink, and on success
// the whole tank turns slowly into one vortex.

struct Params {
  time: f32,
  aspect: f32,
  dark: f32,
  strength: f32,
  swirl: f32,
  calm: f32,
  look: vec2f,
  // rgb + how present the drop is (it fades out when replaced)
  ink: array<vec4f, 6>,
  // x where it fell in, seconds since it fell, how deep it sinks, seed
  drop: array<vec4f, 6>,
}
@group(0) @binding(0) var<uniform> params: Params;

fn hash2(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i), hash2(i + vec2f(1.0, 0.0)), u.x),
    mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), u.x),
    u.y,
  );
}

fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var a = 0.5;
  var s = 0.0;
  for (var i = 0; i < 5; i++) {
    s += a * noise(p);
    p = mat2x2f(1.6, 1.2, -1.2, 1.6) * p + vec2f(3.1, 1.7);
    a *= 0.5;
  }
  return s;
}

fn rot(a: f32) -> mat2x2f {
  let c = cos(a);
  let s = sin(a);
  return mat2x2f(c, s, -s, c);
}

fn segment(p: vec2f, a: vec2f, b: vec2f) -> vec2f {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return vec2f(length(pa - ba * h), h);
}

// The water's slow drift, plus the vortex that gathers everything at the end.
fn flow(p0: vec2f, seed: f32) -> vec2f {
  let t = params.time * 0.045;
  var p = p0;
  let r = length(p);
  p = rot(params.swirl * (2.6 / (0.35 + r)) + params.swirl * t * 6.0) * p;
  p *= 1.0 - params.swirl * 0.35;
  let q = vec2f(fbm(p * 1.3 + vec2f(seed, t)), fbm(p * 1.3 + vec2f(5.2 - t, seed * 1.7)));
  let w = vec2f(fbm(p * 1.9 + q * 2.2 + vec2f(1.7, 9.2 + t)), fbm(p * 1.9 + q * 2.2 + vec2f(8.3 - t, 2.8)));
  return p + (w - 0.5) * (0.55 - 0.25 * params.calm);
}

fn plume(p: vec2f, i: i32) -> f32 {
  let d = params.drop[i];
  let ink = params.ink[i];
  if (ink.a < 0.005) {
    return 0.0;
  }
  let age = d.y;
  let seed = d.w;
  let q = flow(p, seed);
  let sink = d.z * (1.0 - exp(-age * 0.55));
  let top = vec2f(d.x, 1.05);
  let head = vec2f(d.x + 0.18 * sin(seed * 3.0), 1.0 - sink);
  let s = segment(q, top, head);
  let grow = 1.0 - exp(-age * 0.4);
  let r = 0.03 + mix(0.045, 0.2, grow) * (0.4 + 0.6 * s.y);
  // the falling head rolls into a ring, the trail behind it thins out
  let ring = length(q - head);
  let headR = 0.05 + 0.17 * grow;
  let body = exp(-pow(s.x / r, 2.0) * 1.6) * mix(0.45, 1.0, s.y);
  let curl = exp(-pow((ring - headR * 0.6) / (headR * 0.55), 2.0) * 1.4);
  let fil = fbm(q * 5.5 + vec2f(seed * 3.0, params.time * 0.02));
  let wisps = smoothstep(0.35, 0.85, 1.0 - abs(fil - 0.5) * 2.0);
  let dens = (body + curl * 0.9) * mix(0.55, 1.35, wisps);
  // a drop starts as a bead and opens up
  let bead = exp(-dot(p - top + vec2f(0.0, age * 1.4), p - top + vec2f(0.0, age * 1.4)) * 900.0) * (1.0 - smoothstep(0.0, 0.25, age));
  return (dens * smoothstep(0.0, 0.35, age) + bead) * ink.a;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = vec2f((uv.x * 2.0 - 1.0) * params.aspect, 1.0 - uv.y * 2.0) + params.look * 0.04;

  // the water: pale and lit from above, or deep and dark
  let lightWater = mix(vec3f(0.985, 0.978, 0.965), vec3f(0.9, 0.91, 0.92), smoothstep(1.0, -1.2, p.y));
  let darkWater = mix(vec3f(0.055, 0.06, 0.075), vec3f(0.018, 0.02, 0.028), smoothstep(1.0, -1.1, p.y));
  let caustic = fbm(vec2f(p.x * 3.0, p.y * 0.6 + params.time * 0.05)) * smoothstep(-0.6, 1.0, p.y);
  let rays = pow(caustic, 3.0);

  // each ink is a dye: at full density it tints the water exactly its own
  // colour, and dyes multiply where they overlap
  var absorb = vec3f(0.0);
  var glow = vec3f(0.0);
  var blend = vec3f(0.0);
  var total = 0.0;
  for (var i = 0; i < 6; i++) {
    let raw = plume(p, i) * params.strength;
    let dens = 1.15 * (1.0 - exp(-raw * 0.95));
    let c = params.ink[i].rgb;
    absorb += dens * -log(max(c, vec3f(0.03)));
    let bright = mix(c, c / max(max(c.r, max(c.g, c.b)), 0.05), 0.6);
    glow += dens * mix(bright, vec3f(1.0), 0.1);
    blend += dens * c;
    total += dens;
  }

  // where dyes overlap, lean partly on their average so mixes don't go muddy
  let average = mix(vec3f(1.0), blend / max(total, 1e-4), min(total, 1.0));
  let tint = mix(exp(-absorb), average, 0.35 * smoothstep(0.6, 1.6, total));
  // a faint pearly sheen where the ink is thin, like light through silk
  let sheen = smoothstep(0.05, 0.4, total) * (1.0 - smoothstep(0.4, 1.2, total));
  let light = lightWater * (1.0 + rays * 0.06) * tint + vec3f(1.0, 0.97, 0.95) * sheen * 0.035;
  let lit = darkWater + rays * vec3f(0.035, 0.04, 0.05) + glow * 0.8 / (1.0 + total * 0.4);
  var col = mix(light, lit, params.dark);

  // a soft glint along the surface and a vignette
  col += vec3f(0.6) * exp(-pow((p.y - 0.985) * 60.0, 2.0)) * 0.08;
  let v = 1.0 - 0.18 * dot(p * vec2f(0.6 / params.aspect, 0.55), p * vec2f(0.6 / params.aspect, 0.55));
  col *= mix(1.0, v, 0.6);
  let grain = (hash2(uv * 931.0 + fract(params.time)) - 0.5) * 0.012;
  return vec4f(clamp(col + grain, vec3f(0.0), vec3f(1.0)), 1.0);
}
