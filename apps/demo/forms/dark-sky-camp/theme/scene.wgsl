// The sky over the campsite you are booking. The weekend picks the season
// (how bright the Milky Way is, how busy the meteor shower), the site picks
// the horizon (dunes, a mountain lake that mirrors the stars, sea cliffs),
// each person in the group lights a tent, and your birthday draws your star
// sign line by line. Light mode is the blue hour, dark mode full night. On
// success one bright meteor crosses the sky.

struct Params {
  time: f32,
  aspect: f32,
  dark: f32,
  site: f32,
  milky: f32,
  meteors: f32,
  tents: f32,
  reveal: f32,
  fireball: f32,
  look: vec2f,
  // constellation stars: x, y, size, unused
  stars: array<vec4f, 8>,
  // constellation lines: from xy, to xy (zero length = none)
  lines: array<vec4f, 8>,
}
@group(0) @binding(0) var<uniform> params: Params;

fn hash2(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn hash22(p: vec2f) -> vec2f {
  return vec2f(hash2(p), hash2(p + vec2f(17.3, 41.9)));
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
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return vec2f(length(pa - ba * h), h);
}

// A field of stars: one candidate per cell, most of them faint.
fn starfield(p: vec2f, scale: f32, px: f32) -> f32 {
  let g = p * scale;
  let id = floor(g);
  var s = 0.0;
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let c = id + vec2f(f32(i), f32(j));
      let h = hash22(c);
      let pos = c + h;
      let mag = pow(hash2(c + vec2f(5.1, 2.3)), 12.0);
      let d = length(g - pos) / scale;
      let tw = 0.75 + 0.25 * sin(params.time * (1.5 + h.x * 3.0) + h.y * 40.0);
      let r = px * (0.9 + mag * 2.2);
      s += (exp(-d * d / (r * r)) * (0.06 + mag * 2.4)) * step(0.55, h.y + mag) * tw;
    }
  }
  return s;
}

fn horizon(x: f32) -> f32 {
  let site = params.site;
  let dunes = -0.6 + 0.07 * sin(x * 1.7 + 1.0) + 0.04 * sin(x * 4.3 + 0.3) + 0.015 * sin(x * 11.0);
  let ridge = 1.0 - abs(fbm(vec2f(x * 1.1 + 3.0, 1.0)) * 2.0 - 1.0);
  let peaks = -0.5 + 0.42 * ridge * ridge + 0.05 * fbm(vec2f(x * 7.0, 4.0)) - 0.08 * cos(x * 0.8);
  let cliff = -0.56 + 0.34 * smoothstep(-0.2, -0.75, x) + 0.03 * fbm(vec2f(x * 6.0, 0.0));
  let a = mix(dunes, peaks, clamp(site, 0.0, 1.0));
  return mix(a, cliff, clamp(site - 1.0, 0.0, 1.0));
}

fn waterline() -> f32 {
  // the lake and the sea have a mirror below the land
  return mix(-0.66, -0.6, clamp(params.site - 1.0, 0.0, 1.0));
}

fn skyColor(p: vec2f, px: f32) -> vec3f {
  let h = horizon(p.x);
  let up = clamp((p.y - h) / 1.6, 0.0, 1.0);
  let nightTop = vec3f(0.008, 0.012, 0.035);
  let nightLow = vec3f(0.05, 0.065, 0.13);
  let blueTop = vec3f(0.035, 0.07, 0.2);
  let blueLow = vec3f(0.42, 0.36, 0.5);
  let glow = vec3f(0.85, 0.52, 0.38);
  let top = mix(blueTop, nightTop, params.dark);
  let low = mix(blueLow, nightLow, params.dark);
  var col = mix(low, top, pow(up, 0.55));
  col += mix(glow * 0.35, vec3f(0.06, 0.05, 0.08), params.dark) * exp(-up * 9.0);

  // the sky turns slowly about a pole above the top left
  let q = rot(params.time * 0.004) * (p - vec2f(-1.2, 1.6)) + params.look * 0.02;

  // the Milky Way: a dusty band across the sky
  let band = q * rot(0.9);
  let along = band.x;
  let across = band.y + 0.25 * sin(along * 0.8) + 1.25;
  let core = exp(-across * across * 3.2);
  let dust = fbm(band * vec2f(1.4, 4.0) + 3.0);
  let lanes = smoothstep(0.42, 0.7, fbm(band * vec2f(2.5, 9.0) + 11.0));
  let mw = core * (0.4 + 0.9 * dust) * (1.0 - 0.75 * lanes * core) * params.milky;
  let starsVis = mix(0.45, 1.0, params.dark) * smoothstep(-0.05, 0.25, p.y - h);
  col += vec3f(0.55, 0.58, 0.75) * mw * 0.28 * starsVis;
  col += vec3f(0.9, 0.78, 0.65) * pow(core, 3.0) * dust * 0.12 * params.milky * starsVis;

  var stars = starfield(q, 22.0, px) + starfield(q + 7.3, 48.0, px) * 0.3;
  stars += starfield(q + 3.1, 90.0, px * 0.8) * 0.9 * core * params.milky;
  col += vec3f(0.9, 0.93, 1.0) * stars * 0.5 * starsVis;
  return col;
}

fn constellation(p: vec2f, px: f32) -> vec3f {
  if (params.reveal < 0.001) {
    return vec3f(0.0);
  }
  let c = vec2f(0.2 * params.aspect, 0.38);
  let q = (p - c) / 0.7;
  var line = 0.0;
  var count = 0.0;
  for (var i = 0; i < 8; i++) {
    let l = params.lines[i];
    if (dot(l.zw - l.xy, l.zw - l.xy) < 1e-6) {
      continue;
    }
    count += 1.0;
  }
  var k = 0.0;
  for (var i = 0; i < 8; i++) {
    let l = params.lines[i];
    if (dot(l.zw - l.xy, l.zw - l.xy) < 1e-6) {
      continue;
    }
    // each line draws in after the one before it
    let grow = clamp(params.reveal * count - k, 0.0, 1.0);
    k += 1.0;
    let b = mix(l.xy, l.zw, grow);
    let s = segment(q, l.xy, b);
    let w = px / 0.7;
    line += (exp(-pow(s.x / (w * 1.2), 2.0)) * 0.8 + exp(-s.x / (w * 10.0)) * 0.12) * step(0.001, grow);
  }
  var star = 0.0;
  for (var i = 0; i < 8; i++) {
    let s = params.stars[i];
    if (s.z < 0.001) {
      continue;
    }
    let d = length(q - s.xy) * 0.7;
    let on = smoothstep(f32(i) / 8.0, f32(i) / 8.0 + 0.2, params.reveal);
    let tw = 0.85 + 0.15 * sin(params.time * 2.3 + f32(i) * 1.7);
    star += (exp(-d * d / pow(px * 2.4 * s.z, 2.0)) * 1.6 + exp(-d / (px * 9.0)) * 0.25) * on * tw;
  }
  return vec3f(0.62, 0.78, 1.0) * line * 0.55 + vec3f(1.0, 0.95, 0.85) * star;
}

// A streak over the last fraction of a second. `slot` keeps each one apart.
fn meteor(p: vec2f, slot: f32, rate: f32, px: f32) -> f32 {
  let t = params.time * rate + slot * 0.37;
  let k = floor(t);
  let f = fract(t);
  if (hash2(vec2f(k, slot)) > 0.75) {
    return 0.0;
  }
  let a = hash22(vec2f(k * 1.3, slot + 4.0));
  let start = vec2f((a.x * 2.0 - 1.0) * params.aspect * 0.9, 0.3 + a.y * 0.7);
  let dir = normalize(vec2f(-0.6 - a.y * 0.5, -0.45) * vec2f(sign(a.x - 0.5) * -1.0, 1.0));
  let life = 0.35;
  if (f > life) {
    return 0.0;
  }
  let u = f / life;
  let head = start + dir * u * 0.9;
  let tail = head - dir * 0.28 * (1.0 - u * 0.4);
  let s = segment(p, tail, head);
  return exp(-pow(s.x / (px * 1.3), 2.0)) * s.y * s.y * sin(u * 3.14159);
}

fn fireball(p: vec2f, px: f32) -> f32 {
  let u = params.fireball;
  if (u <= 0.0 || u >= 1.0) {
    return 0.0;
  }
  let start = vec2f(params.aspect * 0.95, 0.92);
  let dir = normalize(vec2f(-1.0, -0.42));
  let head = start + dir * u * (params.aspect * 1.9);
  let tail = head - dir * 0.75;
  let s = segment(p, tail, head);
  let fade = sin(min(u * 1.2, 1.0) * 3.14159);
  return (exp(-pow(s.x / (px * 2.2), 2.0)) * pow(s.y, 1.5) + exp(-length(p - head) / (px * 14.0)) * 0.8) * fade;
}

fn tentAt(p: vec2f, c: vec2f, size: f32) -> vec2f {
  let q = (p - c) / size;
  let inside = max(abs(q.x) * 1.1 + q.y - 1.0, -q.y);
  let door = max(abs(q.x) * 3.0 + q.y - 0.95, -q.y);
  return vec2f(inside, door);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p0 = vec2f((uv.x * 2.0 - 1.0) * params.aspect, 1.0 - uv.y * 2.0);
  let px = 2.0 / 900.0 * max(1.0, 1.0 / params.aspect);
  let h = horizon(p0.x);
  let wl = waterline();
  let mirrorOn = clamp(params.site, 0.0, 1.0) * (1.0 - clamp(params.site - 1.0, 0.0, 1.0)) + clamp(params.site - 1.0, 0.0, 1.0);

  var col = vec3f(0.0);
  var p = p0;
  var mirrored = false;
  if (p0.y < wl && mirrorOn > 0.01) {
    // under the waterline the sky is mirrored, rippled and darker
    let ripple = (fbm(vec2f(p0.x * 3.0, p0.y * 30.0 - params.time * 0.4)) - 0.5) * 0.03;
    p = vec2f(p0.x + ripple, 2.0 * wl - p0.y);
    mirrored = true;
  }
  let hp = horizon(p.x);
  col = skyColor(p, px);
  col += constellation(p, px) * step(hp, p.y);
  var streaks = 0.0;
  for (var i = 0; i < 3; i++) {
    streaks += meteor(p, f32(i), params.meteors, px);
  }
  col += vec3f(0.85, 0.92, 1.0) * streaks * step(hp, p.y);
  col += vec3f(1.0, 0.9, 0.75) * fireball(p, px) * step(hp, p.y);

  // the land
  let land = mix(vec3f(0.11, 0.09, 0.12), vec3f(0.012, 0.012, 0.02), params.dark);
  let rim = mix(vec3f(0.55, 0.38, 0.4), vec3f(0.08, 0.08, 0.13), params.dark);
  if (mirrored) {
    // the mirror only shows where the land does not cover it
    let reflectLand = 2.0 * wl - hp;
    col = mix(col, land * 1.2, step(p0.y, wl) * step(reflectLand, p0.y));
    col *= mix(0.55, 0.7, params.dark);
    col += vec3f(0.6, 0.7, 0.9) * exp(-pow((p0.y - wl) * 90.0, 2.0)) * 0.08;
    col = mix(col, land, step(p0.y, wl - 0.5 * (1.0 - mirrorOn)) * (1.0 - mirrorOn));
  } else if (p0.y < h) {
    let edge = exp(-(h - p0.y) * 40.0);
    col = mix(land, rim, edge * 0.5);
  } else {
    col = mix(col, rim, exp(-(p0.y - h) * 260.0) * 0.6);
  }

  // tents, lit from inside, one per person
  for (var i = 0; i < 6; i++) {
    let on = clamp(params.tents - f32(i), 0.0, 1.0);
    if (on < 0.01) {
      continue;
    }
    let fi = f32(i);
    let x = (-0.2 + (fi - 2.5) * 0.17 + 0.03 * sin(fi * 3.3)) * min(params.aspect, 1.4);
    let size = 0.055 + 0.012 * hash2(vec2f(fi, 2.0));
    let base = select(horizon(x), wl, mirrorOn > 0.5) - 0.005;
    let t = tentAt(p0, vec2f(x, base), size);
    let flicker = 0.88 + 0.12 * sin(params.time * 6.0 + fi * 2.0) * sin(params.time * 3.1 + fi);
    let warm = vec3f(1.0, 0.62, 0.26);
    let body = 1.0 - smoothstep(-0.002 / size, 0.004 / size, t.x);
    let doorway = 1.0 - smoothstep(-0.01, 0.02, t.y);
    col = mix(col, mix(warm * 0.75, warm * 1.25, doorway) * flicker, body * on);
    col += warm * exp(-length(p0 - vec2f(x, base + size * 0.3)) * 18.0) * 0.18 * on * flicker;
  }

  let grain = (hash2(uv * 811.0 + fract(params.time)) - 0.5) * 0.01;
  return vec4f(clamp(col + grain, vec3f(0.0), vec3f(1.0)), 1.0);
}
