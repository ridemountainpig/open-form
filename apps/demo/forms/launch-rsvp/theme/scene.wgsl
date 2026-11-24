// The launch stage: chrome and black-chrome spheres bouncing in a dark
// studio, one per person coming, with a small satellite per session picked.
// On success they slow down and melt into one liquid drop. One fullscreen
// raymarch with a reflection bounce, so each sphere shows the others. The
// background is transparent; the stage behind it is the page's own.

struct Params {
  time: f32,
  aspect: f32,
  look: vec2f,
  px: f32,
  people: f32,
  sessions: f32,
  merge: f32,
  jiggle: f32,
}
@group(0) @binding(0) var<uniform> params: Params;

const FLOOR = -0.95;
const SILVER = 0.0;
const BLACK = 1.0;

fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

fn ellipsoid(p: vec3f, r: vec3f) -> f32 {
  let k0 = length(p / r);
  let k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

fn rot(a: f32) -> mat2x2f {
  let c = cos(a);
  let s = sin(a);
  return mat2x2f(c, s, -s, c);
}

// x, z, radius and bounce speed for each of the four people
fn seat(i: i32) -> vec4f {
  switch i {
    case 0: { return vec4f(0.0, 0.0, 0.72, 1.7); }
    case 1: { return vec4f(-1.45, -0.35, 0.42, 2.3); }
    case 2: { return vec4f(1.4, -0.15, 0.5, 2.0); }
    default: { return vec4f(-0.72, 1.05, 0.3, 2.6); }
  }
}

struct Ball {
  c: vec3f,
  r: vec3f,
}

fn ball(i: i32) -> Ball {
  let s = seat(i);
  let grow = clamp(params.people - f32(i), 0.0, 1.0);
  let r = s.z * grow;
  let t = params.time;
  let calm = 1.0 - params.merge;
  let phase = f32(i) * 1.7;
  let hop = abs(sin(t * s.w + phase)) * (0.55 - s.z * 0.35) * calm;
  let shake = params.jiggle * sin(t * 15.0 + phase) * 0.06;
  let low = 1.0 - smoothstep(0.0, 0.12, hop);
  let squash = 0.14 * low * calm + shake;
  let centre = vec3f(s.x, FLOOR + r * (1.0 - squash) + hop, s.y);
  var b: Ball;
  b.c = mix(centre, vec3f(s.x * 0.45, FLOOR + r + 0.25, s.y * 0.45), params.merge);
  b.r = r * vec3f(1.0 + squash * 0.7, 1.0 - squash, 1.0 + squash * 0.7);
  return b;
}

fn scene(p0: vec3f) -> vec2f {
  let xz = rot(params.look.x * 0.35) * p0.xz;
  let p = vec3f(xz.x, p0.y, xz.y);
  let k = 0.02 + 0.7 * params.merge;
  var d = 1e5;
  var id = SILVER;
  var nearest = 1e5;
  for (var i = 0; i < 4; i++) {
    let b = ball(i);
    if (b.r.y < 0.01) {
      continue;
    }
    let di = ellipsoid(p - b.c, b.r);
    if (di < nearest) {
      nearest = di;
      id = f32(i % 2);
    }
    d = smin(d, di, k);
  }

  // one small chrome moon per session, orbiting the first sphere
  let host = ball(0);
  for (var j = 0; j < 3; j++) {
    let grow = clamp(params.sessions - f32(j), 0.0, 1.0);
    if (grow < 0.01) {
      continue;
    }
    let a = params.time * (0.7 + f32(j) * 0.18) + f32(j) * 2.094;
    let tilt = 0.35 + f32(j) * 0.3;
    let orbit = vec3f(cos(a) * 1.05, sin(a) * sin(tilt) * 0.9 + 0.15, sin(a) * cos(tilt) * 1.05);
    let c = mix(host.c + orbit, host.c, params.merge * 0.8);
    let dm = length(p - c) - 0.13 * grow;
    if (dm < nearest) {
      nearest = dm;
      id = SILVER;
    }
    d = smin(d, dm, k);
  }

  // a few droplets drifting at the back of the studio
  for (var j = 0; j < 5; j++) {
    let fj = f32(j);
    let c = vec3f(
      -2.6 + fj * 1.3 + 0.2 * sin(params.time * 0.3 + fj),
      0.9 + 0.45 * sin(params.time * (0.5 + fj * 0.07) + fj * 2.1),
      -2.4 - fract(fj * 0.618) * 1.2,
    );
    let dm = length(p - c) - (0.1 + 0.07 * fract(fj * 0.37 + 0.2));
    if (dm < nearest) {
      nearest = dm;
      id = f32(j % 2);
    }
    d = min(d, dm);
  }
  return vec2f(d, id);
}

fn normal(p: vec3f) -> vec3f {
  let e = vec2f(0.0015, -0.0015);
  return normalize(
    e.xyy * scene(p + e.xyy).x + e.yyx * scene(p + e.yyx).x +
    e.yxy * scene(p + e.yxy).x + e.xxx * scene(p + e.xxx).x,
  );
}

// A dark monochrome studio: a black sweep, a long softbox overhead-left, a
// thin rim strip on the right and a faint floor bounce.
fn studio(dir: vec3f) -> vec3f {
  let az = atan2(dir.x, dir.z);
  let el = asin(clamp(dir.y, -1.0, 1.0));
  var c = mix(vec3f(0.55), vec3f(0.06), smoothstep(-0.05, -0.7, el));
  c = mix(c, mix(vec3f(0.02), vec3f(0.22), smoothstep(0.1, 1.2, el)), smoothstep(-0.02, 0.05, el));
  c += vec3f(0.09) * smoothstep(0.03, 0.0, abs(el - 0.02));
  let key = smoothstep(0.05, 0.0, abs(az + 0.55) - 0.42) * smoothstep(0.04, 0.0, abs(el - 0.62) - 0.2);
  c += vec3f(4.0) * key;
  let rim = smoothstep(0.03, 0.0, abs(az - 1.7) - 0.05) * smoothstep(0.05, 0.0, abs(el - 0.2) - 0.6);
  c += vec3f(2.6) * rim;
  let back = smoothstep(0.05, 0.0, abs(abs(az) - 2.7) - 0.25) * smoothstep(0.05, 0.0, abs(el - 0.3) - 0.25);
  c += vec3f(1.1) * back;
  let side = smoothstep(0.05, 0.0, abs(az + 1.9) - 0.12) * smoothstep(0.05, 0.0, abs(el - 0.1) - 0.5);
  c += vec3f(1.8) * side;
  c += vec3f(1.4) * smoothstep(1.15, 1.35, el);
  return c;
}

fn f0(id: f32) -> vec3f {
  return select(vec3f(0.94, 0.94, 0.95), vec3f(0.2, 0.2, 0.22), id > 0.5);
}

fn fresnel(f: vec3f, cosT: f32) -> vec3f {
  return f + (1.0 - f) * pow(1.0 - clamp(cosT, 0.0, 1.0), 5.0);
}

fn shade(p: vec3f, n: vec3f, rd: vec3f, id: f32) -> vec3f {
  let r = reflect(rd, n);
  var env = studio(r);
  var t = 0.02;
  for (var i = 0; i < 40; i++) {
    let h = scene(p + r * t);
    if (h.x < 0.002) {
      let hp = p + r * t;
      let hn = normal(hp);
      env = studio(reflect(r, hn)) * fresnel(f0(h.y), dot(-r, hn)) * 0.92;
      break;
    }
    t += h.x;
    if (t > 7.0) {
      break;
    }
  }
  let ao = clamp(0.5 + 0.5 * scene(p + n * 0.15).x / 0.15, 0.2, 1.0);
  return fresnel(f0(id), dot(-rd, n)) * env * ao;
}

fn tonemap(c: vec3f) -> vec3f {
  let a = c * (2.51 * c + 0.03);
  let b = c * (2.43 * c + 0.59) + 0.14;
  return pow(clamp(a / b, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let zoom = max(1.0, 1.35 / params.aspect);
  let sp = vec2f((uv.x * 2.0 - 1.0) * params.aspect, 1.0 - uv.y * 2.0) * zoom;
  let ro = vec3f(0.0, 0.5 - params.look.y * 0.3, 5.0);
  let ta = vec3f(0.0, -0.25, -0.2);
  let fw = normalize(ta - ro);
  let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)));
  let up = cross(rt, fw);
  let fov = 0.42;
  let rd = normalize(fw + (sp.x * rt + sp.y * up) * fov);

  var t = 0.0;
  var hit = false;
  var id = SILVER;
  var closest = 1e9;
  var tClosest = 0.0;
  for (var i = 0; i < 100; i++) {
    let h = scene(ro + rd * t);
    let ratio = h.x / max(t, 0.001);
    if (ratio < closest) {
      closest = ratio;
      tClosest = t;
    }
    if (h.x < 0.0008 * t) {
      hit = true;
      id = h.y;
      break;
    }
    t += h.x * 0.9;
    if (t > 11.0) {
      break;
    }
  }

  let pix = params.px * fov * zoom;
  var alpha = 1.0;
  if (!hit) {
    alpha = 1.0 - smoothstep(0.0, 1.5 * pix, closest);
    t = tClosest;
    id = scene(ro + rd * t).y;
  }

  // soft contact shadows under each sphere
  let ft = (FLOOR - ro.y) / rd.y;
  var shadow = 0.0;
  if (ft > 0.0) {
    let fp0 = ro + rd * ft;
    let xz = rot(params.look.x * 0.35) * fp0.xz;
    for (var i = 0; i < 4; i++) {
      let b = ball(i);
      let lift = max(b.c.y - b.r.y - FLOOR, 0.0);
      let q = (xz - b.c.xz) / max(b.r.x * 1.1, 0.01);
      shadow += 0.5 * exp(-dot(q, q) * 1.6) / (1.0 + lift * 5.0) * step(0.01, b.r.y);
    }
    shadow = min(shadow, 0.6);
  }

  if (alpha <= 0.0) {
    return vec4f(0.0, 0.0, 0.0, shadow);
  }
  let p = ro + rd * t;
  let col = tonemap(shade(p, normal(p), rd, id));
  return vec4f(col * alpha, alpha + shadow * (1.0 - alpha));
}
