// The drink being ordered, in a glass cup on a counter. The tea sets the
// liquid's colour and how clear it is, sweetness pools a syrup layer at the
// bottom, ice floats cubes (or steam rises off a hot one), and each topping
// drops in. On success the cup is sealed and a straw goes in. One fullscreen
// raymarch: the glass, then the inside of the cup seen through it. The
// background is transparent; the counter behind it is the page's own.

struct Params {
  time: f32,
  aspect: f32,
  look: vec2f,
  tea: vec4f,
  px: f32,
  dark: f32,
  size: f32,
  sweet: f32,
  ice: f32,
  hot: f32,
  pearls: f32,
  jelly: f32,
  pudding: f32,
  tiger: f32,
  done: f32,
  jiggle: f32,
  fill: f32,
}
@group(0) @binding(0) var<uniform> params: Params;

const BOT = -1.05;
const R0 = 0.56;
const R1 = 0.7;
const WALL = 0.035;
const BASE = 0.07;
const LIGHT = vec3f(-0.55, 0.85, 0.6);

const ICE = 1.0;
const PEARL = 2.0;
const JELLY = 3.0;
const PUDDING = 4.0;
const STRAW = 5.0;

fn cupH() -> f32 {
  return mix(1.75, 2.15, params.size);
}

fn cupTop() -> f32 {
  return BOT + cupH();
}

fn slope() -> f32 {
  return (R1 - R0) / cupH();
}

fn radius(y: f32) -> f32 {
  return R0 + (y - BOT) * slope();
}

fn level() -> f32 {
  return BOT + BASE + (cupH() - BASE) * 0.82 * params.fill;
}

fn hash(n: f32) -> f32 {
  return fract(sin(n * 127.1) * 43758.5453);
}

fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash(i.x + i.y * 57.0);
  let b = hash(i.x + 1.0 + i.y * 57.0);
  let c = hash(i.x + (i.y + 1.0) * 57.0);
  let d = hash(i.x + 1.0 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var a = 0.5;
  var s = 0.0;
  for (var i = 0; i < 4; i++) {
    s += a * noise(p);
    p = p * 2.03 + vec2f(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}

fn rot(a: f32) -> mat2x2f {
  let c = cos(a);
  let s = sin(a);
  return mat2x2f(c, s, -s, c);
}

fn roundBox(p: vec3f, b: vec3f, r: f32) -> f32 {
  let q = abs(p) - b + r;
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

fn capsule(p: vec3f, a: vec3f, b: vec3f, r: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// How far each topping still has to fall, by its own share of the eased
// amount. A negative amount is a topping being taken out: it shrinks away
// where it is instead of flying back up.
fn drop(amount: f32, i: f32, count: f32) -> f32 {
  let start = i / count * 0.55;
  return select(1.0 - smoothstep(start, start + 0.45, amount), 0.0, amount < 0.0);
}

fn keep(amount: f32) -> f32 {
  return select(1.0, smoothstep(0.0, 1.0, -amount), amount < 0.0);
}

fn slosh(x: f32, z: f32) -> f32 {
  let t = params.time;
  return 0.012 * sin(t * 1.4 + x * 3.1) + 0.008 * sin(t * 1.9 - z * 3.7) +
    params.jiggle * 0.07 * sin(t * 9.0 + x * 4.5) * (0.6 + 0.4 * sin(z * 3.0 + t * 5.0));
}

fn straw() -> vec2f {
  return vec2f(STRAW, (1.0 - smoothstep(0.0, 1.0, params.done)) * 2.6);
}

fn strawDist(p: vec3f) -> f32 {
  if (params.done < 0.01) {
    return 1e5;
  }
  let lift = straw().y;
  let a = vec3f(0.12, BOT + BASE + 0.16 + lift, -0.06);
  let b = vec3f(0.34, cupTop() + 0.75 + lift, -0.2);
  return capsule(p, a, b, 0.07);
}

fn objects(p: vec3f) -> vec2f {
  var d = strawDist(p);
  var id = STRAW;
  let t = params.time;
  let lvl = level();
  let floorY = BOT + BASE;

  // ice floats at the surface
  if (params.ice > 0.01 && p.y > min(lvl, floorY + 0.4) - 0.45) {
    for (var i = 0; i < 5; i++) {
      let fi = f32(i);
      let grow = clamp(params.ice - fi, 0.0, 1.0);
      if (grow < 0.01) {
        continue;
      }
      let a = fi * 2.4 + 0.4;
      let rr = 0.18 + 0.2 * hash(fi + 3.0);
      let bob = 0.02 * sin(t * 1.3 + fi * 1.7) + params.jiggle * 0.08 * sin(t * 8.0 + fi);
      let rest = max(lvl - 0.07 - 0.07 * hash(fi + 9.0) + bob, floorY + 0.15 + 0.2 * hash(fi + 4.0));
      let c = vec3f(cos(a) * rr, rest + (1.0 - grow) * 0.9, sin(a) * rr);
      var q = p - c;
      let yz = rot(fi + t * 0.25) * q.yz;
      q = vec3f(q.x, yz.x, yz.y);
      let xz = rot(fi * 1.3 + t * 0.2) * q.xz;
      q = vec3f(xz.x, q.y, xz.y);
      let s = 0.135 * (0.6 + 0.4 * grow);
      let di = roundBox(q, vec3f(s), 0.035);
      if (di < d) {
        d = di;
        id = ICE;
      }
    }
  }

  // pearls pile on the bottom, falling in one after another
  if (abs(params.pearls) > 0.01 && p.y < floorY + 0.4 + 2.2 * (1.0 - abs(params.pearls))) {
    for (var i = 0; i < 16; i++) {
      let fi = f32(i);
      let fall = drop(params.pearls, fi, 16.0);
      var c: vec3f;
      if (i < 10) {
        let a = fi * 2.39996;
        let rr = 0.43 * sqrt((fi + 0.5) / 10.0);
        c = vec3f(cos(a) * rr, floorY + 0.085, sin(a) * rr);
      } else {
        let a = fi * 2.39996 + 0.6;
        let rr = 0.3 * sqrt((fi - 9.5) / 6.0);
        c = vec3f(cos(a) * rr, floorY + 0.23, sin(a) * rr);
      }
      c.y += fall * (lvl - floorY + 0.4) + 0.006 * sin(t * 2.0 + fi);
      let di = length(p - c) - 0.088 * keep(params.pearls);
      if (di < d) {
        d = di;
        id = PEARL;
      }
    }
  }

  // coconut jelly hangs through the drink
  if (abs(params.jelly) > 0.01) {
    for (var i = 0; i < 9; i++) {
      let fi = f32(i);
      let fall = drop(params.jelly, fi, 9.0);
      let a = fi * 2.1 + t * 0.12;
      let rr = 0.15 + 0.3 * hash(fi + 21.0);
      let y = floorY + 0.3 + 0.75 * hash(fi + 5.0) + 0.03 * sin(t * 0.9 + fi);
      let c = vec3f(cos(a) * rr, y + fall * 1.6, sin(a) * rr);
      var q = p - c;
      let xy = rot(t * 0.4 + fi) * q.xy;
      q = vec3f(xy.x, xy.y, q.z);
      let xz = rot(fi * 0.7 + t * 0.3) * q.xz;
      q = vec3f(xz.x, q.y, xz.y);
      let k = keep(params.jelly);
      let di = roundBox(q, vec3f(0.058 * k), 0.018 * k);
      if (di < d) {
        d = di;
        id = JELLY;
      }
    }
  }

  // a pudding slides down and sits on whatever is already there
  if (abs(params.pudding) > 0.01) {
    let fall = select(1.0 - smoothstep(0.0, 1.0, params.pudding), 0.0, params.pudding < 0.0);
    let k = max(keep(params.pudding), 0.001);
    let base = floorY + 0.15 + step(0.5, params.pearls) * 0.15 * keep(params.pearls);
    let c = vec3f(-0.1, base + fall * 1.8, 0.12);
    var q = (p - c) / k;
    let xy = rot(0.12 + fall * 0.8) * q.xy;
    q = vec3f(xy.x, xy.y, q.z);
    let r = 0.27 - 0.06 * clamp(q.y / 0.14, -1.0, 1.0);
    let dc = vec2f(length(q.xz) - r, abs(q.y) - 0.13);
    let di = (min(max(dc.x, dc.y), 0.0) + length(max(dc, vec2f(0.0))) - 0.035) * k;
    if (di < d) {
      d = di;
      id = PUDDING;
    }
  }
  return vec2f(d, id);
}

fn objNormal(p: vec3f) -> vec3f {
  let e = vec2f(0.0015, -0.0015);
  return normalize(
    e.xyy * objects(p + e.xyy).x + e.yyx * objects(p + e.yyx).x +
    e.yxy * objects(p + e.yxy).x + e.xxx * objects(p + e.xxx).x,
  );
}

// the glass, solid, with the opening counted as its top face
fn glass(p: vec3f) -> vec2f {
  let side = (length(p.xz) - radius(p.y)) / sqrt(1.0 + slope() * slope());
  let lip = p.y - cupTop();
  return vec2f(max(max(side, BOT - p.y), lip), select(0.0, 1.0, lip > side && lip > BOT - p.y));
}

fn glassNormal(p: vec3f, top: bool) -> vec3f {
  if (top) {
    return vec3f(0.0, 1.0, 0.0);
  }
  if (p.y < BOT + 0.004) {
    return vec3f(0.0, -1.0, 0.0);
  }
  let r = normalize(p.xz + vec2f(1e-5, 0.0));
  return normalize(vec3f(r.x, -slope(), r.y));
}

// a soft counter-top studio: a tall window on the left, a strip on the right
fn env(dir: vec3f) -> vec3f {
  let az = atan2(dir.x, dir.z);
  let el = asin(clamp(dir.y, -1.0, 1.0));
  let win = smoothstep(0.06, 0.0, abs(az + 0.75) - 0.22) * smoothstep(0.08, 0.0, abs(el - 0.35) - 0.5);
  let strip = smoothstep(0.04, 0.0, abs(az - 1.05) - 0.05) * smoothstep(0.1, 0.0, abs(el - 0.2) - 0.55);
  let sky = smoothstep(0.2, 1.3, el) * 0.35;
  return vec3f(1.0, 0.98, 0.94) * (win * 1.25 + strip * 0.8 + sky);
}

fn teaAt(y: f32) -> vec3f {
  let tea = params.tea.rgb;
  let syrup = max(params.sweet * 0.65, params.tiger);
  let amber = mix(vec3f(0.6, 0.33, 0.1), vec3f(0.33, 0.15, 0.06), params.tiger);
  let depth = 0.12 + 0.5 * max(params.sweet, params.tiger * 0.6);
  let k = syrup * (1.0 - smoothstep(BOT + BASE, BOT + BASE + depth, y));
  return mix(tea, amber, k);
}

// brown-sugar streaks running down the inside of the glass
fn stripes(p: vec3f) -> f32 {
  if (params.tiger < 0.01 || p.y > level() + 0.05) {
    return 0.0;
  }
  let a = atan2(p.z, p.x);
  let n = fbm(vec2f(a * 4.0 + 0.5 * sin(p.y * 3.0 + a), p.y * 0.45));
  let streak = smoothstep(0.47, 0.53, n) * (1.0 - smoothstep(0.6, 0.68, n));
  let band = streak * (1.0 - smoothstep(level() - 0.45, level() + 0.02, p.y));
  return band * params.tiger * 0.85;
}

fn shadeObject(p: vec3f, rd: vec3f, id: f32) -> vec3f {
  let n = objNormal(p);
  let l = normalize(LIGHT);
  let diff = clamp(dot(n, l) * 0.5 + select(0.5, 0.72, id == ICE), 0.0, 1.0);
  let h = normalize(l - rd);
  let fres = pow(1.0 - clamp(dot(-rd, n), 0.0, 1.0), 3.0);
  var base = vec3f(0.9);
  var gloss = 0.4;
  var power = 40.0;
  if (id == PEARL) {
    base = vec3f(0.16, 0.08, 0.05);
    gloss = 0.9;
    power = 60.0;
  } else if (id == ICE) {
    base = mix(teaAt(p.y), vec3f(1.0), 0.7) + fres * 0.35;
    gloss = 1.1;
    power = 90.0;
  } else if (id == JELLY) {
    base = mix(teaAt(p.y), vec3f(0.98, 0.96, 0.88), 0.62);
    gloss = 0.6;
  } else if (id == PUDDING) {
    base = mix(vec3f(0.98, 0.76, 0.3), vec3f(0.52, 0.24, 0.07), smoothstep(0.55, 0.85, n.y));
    gloss = 0.35;
  } else {
    base = vec3f(0.22, 0.52, 0.44);
    gloss = 0.7;
    power = 70.0;
  }
  let spec = pow(clamp(dot(n, h), 0.0, 1.0), power) * gloss;
  return base * diff + vec3f(spec) + base * fres * 0.25;
}

// Everything inside the cup along one ray: the toppings, the drink and the
// syrup, absorbed by how much drink the ray passes through. Premultiplied.
fn inside(ro: vec3f, rd: vec3f) -> vec4f {
  let lvl = level();
  let floorY = BOT + BASE;
  let cosA = 1.0 / sqrt(1.0 + slope() * slope());
  var t = 0.005;
  var id = 0.0;
  var exitAir = false;
  for (var i = 0; i < 90; i++) {
    let p = ro + rd * t;
    let o = objects(p);
    let side = (radius(p.y) - WALL - length(p.xz)) * cosA;
    let wall = min(side, p.y - floorY);
    if (o.x < 0.0015) {
      id = o.y;
      break;
    }
    if (p.y > cupTop() + 0.02 && rd.y > 0.0) {
      exitAir = true;
      break;
    }
    if (wall < 0.0015 && t > 0.02) {
      break;
    }
    t += max(min(o.x, max(wall, 0.0)), 0.004);
    if (t > 4.0) {
      break;
    }
  }
  let hit = ro + rd * t;

  // the stretch of the ray that is under the surface
  let tS = (lvl - ro.y) / rd.y;
  var wet = 0.0;
  var surface = -1.0;
  if (ro.y < lvl) {
    wet = select(t, min(t, tS), rd.y > 0.0);
  } else if (rd.y < 0.0 && tS < t) {
    wet = t - tS;
    surface = tS;
  }
  let dens = params.tea.w;
  let tr = exp(-dens * wet);
  let probe = ro + rd * (select(0.0, surface, surface > 0.0) + min(wet, 0.35));
  let tea = teaAt(probe.y) * (0.82 + 0.18 * clamp(dot(normalize(LIGHT), vec3f(0.0, 1.0, 0.0)), 0.0, 1.0));

  var behind = vec4f(0.0);
  if (id > 0.5) {
    behind = vec4f(shadeObject(hit, rd, id), 1.0);
  } else if (!exitAir) {
    let s = stripes(hit);
    let back = mix(teaAt(hit.y) * 0.8, vec3f(0.3, 0.14, 0.06), s);
    behind = select(vec4f(back * s, s), vec4f(back, 1.0), hit.y < lvl);
  }
  var col = behind.rgb * tr + tea * (1.0 - tr);
  var a = behind.a * tr + (1.0 - tr);

  // the top of the drink: a little brighter, with the window in it
  if (surface > 0.0 && surface < t) {
    let sp = ro + rd * surface;
    let e = 0.02;
    let n = normalize(vec3f(
      -(slosh(sp.x + e, sp.z) - slosh(sp.x - e, sp.z)) / (2.0 * e),
      1.0,
      -(slosh(sp.x, sp.z + e) - slosh(sp.x, sp.z - e)) / (2.0 * e),
    ));
    let f = 0.04 + 0.96 * pow(1.0 - clamp(dot(-rd, n), 0.0, 1.0), 5.0);
    let refl = env(reflect(rd, n));
    let crema = (1.0 - smoothstep(0.0, 0.25, radius(lvl) - WALL - length(sp.xz))) * 0.12;
    col = mix(col, tea * 1.12 + crema, clamp(dens * 0.25, 0.25, 0.8));
    col += refl * f * 1.4;
    a = max(a, clamp(dens * 0.4, 0.35, 1.0));
  }
  let near = stripes(ro);
  col = mix(col, vec3f(0.36, 0.17, 0.07), near);
  a = max(a, near);
  return vec4f(col, a);
}

fn steam(ro: vec3f, rd: vec3f) -> f32 {
  if (params.hot < 0.01) {
    return 0.0;
  }
  let t = -ro.z / rd.z;
  let q = ro + rd * t;
  let rise = q.y - cupTop();
  if (rise < 0.0) {
    return 0.0;
  }
  let sway = q.x + 0.1 * sin(q.y * 2.4 - params.time * 0.8) * min(rise * 2.0, 1.0);
  let n = fbm(vec2f(sway * 3.2, q.y * 1.3 - params.time * 0.6));
  let column = exp(-sway * sway * 7.0 / (1.0 + rise * 1.5));
  let fade = smoothstep(0.0, 0.3, rise) * (1.0 - smoothstep(0.4, 1.3, rise));
  return smoothstep(0.3, 0.75, n) * column * fade * params.hot * (1.0 - 0.6 * params.done);
}

fn sealAt(p: vec3f) -> vec4f {
  let r = length(p.xz) / radius(cupTop());
  let ring = smoothstep(0.02, 0.0, abs(r - 0.78) - 0.035);
  let dot0 = 1.0 - smoothstep(0.17, 0.19, length(p.xz - vec2f(0.0, 0.05)));
  let ink = max(ring, dot0);
  let film = mix(vec3f(0.97, 0.95, 0.9), vec3f(0.62, 0.32, 0.18), ink);
  return vec4f(film, (0.55 + 0.4 * ink) * smoothstep(0.6, 1.0, params.done));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let zoom = max(1.0, 1.1 / params.aspect);
  let sp = vec2f((uv.x * 2.0 - 1.0) * params.aspect, 1.0 - uv.y * 2.0) * zoom;
  let orbit = params.look.x * 0.3 + 0.18 * sin(params.time * 0.21);
  let ro = vec3f(sin(orbit) * 5.6, 1.35 - params.look.y * 0.35, cos(orbit) * 5.6);
  let ta = vec3f(0.0, 0.42, 0.0);
  let fw = normalize(ta - ro);
  let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)));
  let up = cross(rt, fw);
  let fov = 0.31;
  let rd = normalize(fw + (sp.x * rt + sp.y * up) * fov);
  let pix = params.px * fov * zoom;

  // the outside: the glass and, once sealed, the straw above it
  var t = 3.0;
  var hit = false;
  var onStraw = false;
  var closest = 1e9;
  for (var i = 0; i < 90; i++) {
    let p = ro + rd * t;
    let g = glass(p).x;
    let s = strawDist(p);
    let h = min(g, s);
    closest = min(closest, h / t);
    if (h < 0.0008 * t) {
      hit = true;
      onStraw = s < g;
      break;
    }
    t += h;
    if (t > 9.0) {
      break;
    }
  }

  var col = vec3f(0.0);
  var alpha = 0.0;
  let l = normalize(LIGHT);

  if (hit && onStraw) {
    let p = ro + rd * t;
    let e = vec2f(0.0015, -0.0015);
    let n = normalize(
      e.xyy * strawDist(p + e.xyy) + e.yyx * strawDist(p + e.yyx) +
      e.yxy * strawDist(p + e.yxy) + e.xxx * strawDist(p + e.xxx),
    );
    let h = normalize(l - rd);
    col = vec3f(0.22, 0.52, 0.44) * clamp(dot(n, l) * 0.6 + 0.45, 0.0, 1.0) +
      vec3f(pow(clamp(dot(n, h), 0.0, 1.0), 70.0) * 0.7);
    alpha = 1.0;
  } else if (hit) {
    let p = ro + rd * t;
    let top = glass(p).y > 0.5;
    let n = glassNormal(p, top);
    var inner = vec4f(0.0);
    var glassCol = vec3f(0.0);
    var glassA = 0.0;
    if (top) {
      inner = inside(p - n * 0.001, rd);
      let film = sealAt(p);
      inner = vec4f(film.rgb * film.a + inner.rgb * (1.0 - film.a), film.a + inner.a * (1.0 - film.a));
      let lip = smoothstep(0.03, 0.0, radius(cupTop()) - length(p.xz));
      glassCol = vec3f(1.0) * lip * 0.6;
      glassA = lip * 0.45;
    } else {
      let cosT = clamp(dot(-rd, n), 0.0, 1.0);
      let f = 0.04 + 0.96 * pow(1.0 - cosT, 5.0);
      let bent = refract(rd, n, 0.86);
      inner = inside(p + bent * (WALL + 0.004), bent);
      let edge = smoothstep(0.35, 0.02, cosT);
      let line = mix(vec3f(0.36, 0.28, 0.22), vec3f(0.92, 0.9, 0.86), params.dark);
      let spec = env(reflect(rd, n)) * f * 2.2;
      let sl = max(spec.r, max(spec.g, spec.b));
      glassA = clamp(edge * 0.32 + sl + 0.05, 0.0, 1.0);
      glassCol = line * (edge * 0.32 + 0.05) + spec;
      let foot = smoothstep(BOT + BASE + 0.01, BOT, p.y);
      glassCol += vec3f(0.95) * foot * 0.25;
      glassA = max(glassA, foot * 0.3);
    }
    col = glassCol + inner.rgb * (1.0 - glassA);
    alpha = glassA + inner.a * (1.0 - glassA);
  }

  // a soft edge just outside the silhouette, for anti-aliasing
  if (!hit && closest < 1.5 * pix) {
    let cover = 1.0 - smoothstep(0.0, 1.5 * pix, closest);
    let line = mix(vec3f(0.36, 0.28, 0.22), vec3f(0.92, 0.9, 0.86), params.dark);
    col = line * cover * 0.4;
    alpha = cover * 0.4;
  }

  // steam over a hot drink
  let s = steam(ro, rd);
  let sc = mix(vec3f(1.0, 0.99, 0.97), vec3f(0.95), params.dark) * s * 0.75;
  col = sc + col * (1.0 - s * 0.75);
  alpha = s * 0.75 + alpha * (1.0 - s * 0.75);

  // the counter: a soft shadow and the drink's colour thrown through the glass
  let ft = (BOT - ro.y) / rd.y;
  if (ft > 0.0 && alpha < 0.999) {
    let fp = ro + rd * ft;
    let away = vec2f(-l.x, -l.z) * 0.55;
    let qs = (fp.xz - away) / vec2f(0.95, 0.75);
    let shadow = exp(-dot(qs, qs) * 2.2) * 0.32 + exp(-dot(fp.xz, fp.xz) * 9.0) * 0.25;
    let qc = (fp.xz - away * 1.4) / vec2f(0.8, 0.55);
    let shimmer = 0.75 + 0.25 * sin(fp.x * 14.0 + params.time * 1.6) * sin(fp.z * 11.0 - params.time * 1.2);
    let caustic = exp(-dot(qc, qc) * 2.6) * shimmer * (1.0 - exp(-params.tea.w * 0.6)) * 0.35;
    let floorA = clamp(shadow + caustic * 0.4, 0.0, 1.0);
    let floorCol = params.tea.rgb * caustic * mix(0.9, 0.3, params.dark);
    col = col + floorCol * (1.0 - alpha);
    alpha = alpha + floorA * (1.0 - alpha);
  }
  return vec4f(clamp(col, vec3f(0.0), vec3f(alpha)), alpha);
}
