// Hop, a liquid-metal rabbit. One fullscreen raymarch: a soft mochi body
// with the ears of one of four breeds (morphing between them), front paws,
// feet, a tail, enamel eyes, droplets that fold back into it, and up to five
// carrots in orbit. Chrome shading with a
// procedural studio and one extra reflection bounce, so the carrots show in
// the body and the body in the carrots. The background is transparent, so
// the page's own backdrop shows through in light and dark.

struct Params {
  tint: vec3f,
  time: f32,
  look: vec2f,
  aspect: f32,
  jiggle: f32,
  px: f32,
  blush: f32,
  breed: f32,
  carrots: f32,
}
@group(0) @binding(0) var<uniform> params: Params;

const FLOOR = -0.93;
const BODY = 0.0;
const ENAMEL = 1.0;
const CARROT = 2.0;
const LEAF = 3.0;

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

struct Pose {
  r: vec3f,
  center: f32,
  yaw: f32,
  pitch: f32,
  wave: f32,
  blink: f32,
  sway: f32,
}

fn pose() -> Pose {
  let t = params.time;
  let breathe = sin(t * 2.1) * 0.025;
  let wobble = params.jiggle * sin(t * 17.0) * 0.09;
  let squash = breathe + wobble;
  var o: Pose;
  let dwarf = clamp(params.breed - 2.0, 0.0, 1.0);
  let base = mix(vec3f(1.04, 0.9, 0.94), vec3f(0.98, 0.96, 0.96), dwarf);
  o.r = base * vec3f(1.0 + squash * 0.6, 1.0 - squash, 1.0 + squash * 0.6);
  o.center = FLOOR + o.r.y;
  o.yaw = params.look.x * 0.45;
  o.pitch = -params.look.y * 0.22;
  o.wave = max(sin(t * 0.9), 0.0) * (0.6 + 0.4 * sin(t * 7.0));
  let b = fract(t / 3.7);
  o.blink = select(1.0, 0.12, b > 0.955);
  o.sway = sin(t * 1.6) * 0.12 + params.jiggle * sin(t * 13.0) * 0.25;
  return o;
}

fn local(p: vec3f, o: Pose) -> vec3f {
  var q = p - vec3f(0.0, o.center, 0.0);
  let xz = rot(o.yaw) * q.xz;
  q = vec3f(xz.x, q.y, xz.y);
  let yz = rot(o.pitch) * q.yz;
  return vec3f(q.x, yz.x, yz.y);
}

fn droplet(i: f32, t: f32) -> vec4f {
  let a = t * (0.55 + i * 0.07) + i * 1.9;
  let dive = pow(max(sin(t * 0.45 + i * 1.7), 0.0), 6.0);
  let orbit = mix(1.7 + 0.08 * sin(t + i), 1.08, dive);
  // a tilted ring: low in front so the face stays clear, high behind the head
  let y = 0.12 + 0.22 * sin(t * 0.8 + i * 2.3) - 0.62 * sin(a);
  let r = 0.09 + 0.04 * fract(i * 0.618 + 0.3);
  return vec4f(cos(a) * orbit, y, sin(a) * orbit * 0.7, r);
}

fn roundCone(p: vec3f, r1: f32, r2: f32, h: f32) -> f32 {
  let q = vec2f(length(p.xz), p.y);
  let b = (r1 - r2) / h;
  let a = sqrt(1.0 - b * b);
  let k = dot(q, vec2f(-b, a));
  if (k < 0.0) {
    return length(q) - r1;
  }
  if (k > a * h) {
    return length(q - vec2f(0.0, h)) - r2;
  }
  return dot(q, vec2f(a, b)) - r1;
}

// One ear, mirrored: `e` is the head-local point with x folded to one side.
// theta leans the ear from straight up (0) out and down (lop ears, ~2.7).
fn ear(e: vec3f, root: vec3f, theta: f32, len: f32, r: vec3f) -> f32 {
  let p = e - root;
  let dir = vec2f(sin(theta), cos(theta));
  let along = dot(p.xy, dir);
  let across = dot(p.xy, vec2f(dir.y, -dir.x));
  return ellipsoid(vec3f(across, along - len, p.z), r);
}

// Ears (and the lionhead's mane) for one breed:
// 0 upright, 1 Holland lop, 2 lionhead, 3 Netherland dwarf.
fn breedEars(q: vec3f, b: f32, o: Pose) -> f32 {
  let e = vec3f(abs(q.x), q.y, q.z);
  let ry = o.r.y;
  if (b < 0.5) {
    return ear(e, vec3f(0.3, ry - 0.12, -0.05), 0.16 + o.sway * 0.4, 0.5, vec3f(0.17, 0.52, 0.1));
  }
  if (b < 1.5) {
    return ear(e, vec3f(1.02, ry - 0.3, 0.12), 2.98 + o.sway * 0.2, 0.52, vec3f(0.12, 0.56, 0.24));
  }
  if (b < 2.5) {
    var d = ear(e, vec3f(0.28, ry - 0.1, -0.1), 0.3 + o.sway * 0.3, 0.24, vec3f(0.13, 0.27, 0.09));
    // a mane: soft puffs around the top half of the head, set back a little
    for (var k = 0; k < 7; k++) {
      let phi = f32(k) * 0.42 + 0.31;
      let c = vec3f(cos(phi) * 1.04, sin(phi) * 0.9 + 0.02, -0.22);
      d = smin(d, length(q - c) - 0.25, 0.16);
    }
    return d;
  }
  return ear(e, vec3f(0.26, ry - 0.08, -0.05), 0.32 + o.sway * 0.3, 0.2, vec3f(0.12, 0.23, 0.085));
}

struct Hit {
  d: f32,
  id: f32,
}

fn carrot(p: vec3f, i: f32, t: f32, o: Pose) -> Hit {
  let a = t * 0.42 + i * 1.2566 + 0.5;
  let orbit = 1.62 + 0.06 * sin(t * 1.3 + i);
  let y = 0.05 + 0.1 * sin(t * 1.1 + i * 2.0) - 0.3 * sin(a);
  var c = p - vec3f(cos(a) * orbit, o.center + y, sin(a) * 1.05);
  let xy = rot(0.9 + 0.4 * sin(t * 1.7 + i)) * c.xy;
  c = vec3f(xy.x, xy.y, c.z);
  let yz = rot(t * 0.8 + i) * c.yz;
  c = vec3f(c.x, yz.x, yz.y);
  var h: Hit;
  h.d = roundCone(vec3f(c.x, 0.2 - c.y, c.z), 0.12, 0.03, 0.46);
  h.id = CARROT;
  let top = c - vec3f(0.0, 0.3, 0.0);
  var leaf = ellipsoid(top, vec3f(0.035, 0.14, 0.035));
  let l1 = vec3f(rot(0.5) * top.xy, top.z);
  let l2 = vec3f(rot(-0.5) * top.xy, top.z);
  leaf = min(leaf, ellipsoid(l1 - vec3f(0.0, -0.01, 0.0), vec3f(0.032, 0.12, 0.032)));
  leaf = min(leaf, ellipsoid(l2 - vec3f(0.0, -0.01, 0.0), vec3f(0.032, 0.12, 0.032)));
  if (leaf < h.d) {
    h.d = leaf;
    h.id = LEAF;
  }
  return h;
}

fn map(p: vec3f, o: Pose) -> vec2f {
  let q = local(p, o);
  var d = ellipsoid(q, o.r);

  // ears morph from one breed to the next as `breed` eases between them
  let b0 = floor(params.breed);
  let b1 = min(b0 + 1.0, 3.0);
  let f = params.breed - b0;
  var ears = breedEars(q, b0, o);
  if (f > 0.001) {
    ears = mix(ears, breedEars(q, b1, o), f);
  }
  d = smin(d, ears, 0.14);

  // front paws and a round tail
  let paw = vec3f(abs(q.x) - 0.32, q.y + 0.42 - o.wave * 0.1, q.z - 0.78);
  d = smin(d, ellipsoid(paw, vec3f(0.17, 0.14, 0.15)), 0.1);
  d = smin(d, length(q - vec3f(0.0, -0.42, -0.9)) - 0.22, 0.1);

  // feet, in world space so they stay on the floor
  let fp = p - vec3f(0.0, FLOOR + 0.1, 0.36);
  let feet = vec3f(abs(fp.x) - 0.42, fp.y, fp.z);
  d = smin(d, ellipsoid(feet, vec3f(0.24, 0.11, 0.3)), 0.12);

  // two droplets that orbit and now and then melt back in
  for (var i = 0; i < 2; i++) {
    let s = droplet(f32(i) * 2.0, params.time);
    d = smin(d, length(p - vec3f(s.x, o.center + s.y, s.z)) - s.w, 0.32);
  }

  var best = vec2f(d, BODY);

  // enamel eyes, set into the face
  let eyeR = vec3f(0.1, 0.12 * o.blink, 0.07);
  let ex = vec3f(abs(q.x) - 0.33, q.y - 0.12, q.z - 0.84);
  let eyes = ellipsoid(ex, eyeR);
  if (eyes < best.x) {
    best = vec2f(eyes, ENAMEL);
  }

  // one carrot per carrot a day
  for (var i = 0; i < 5; i++) {
    if (f32(i) >= params.carrots) {
      break;
    }
    let c = carrot(p, f32(i), params.time, o);
    if (c.d < best.x) {
      best = vec2f(c.d, c.id);
    }
  }
  return best;
}

fn normal(p: vec3f, o: Pose) -> vec3f {
  let e = vec2f(0.0015, -0.0015);
  return normalize(
    e.xyy * map(p + e.xyy, o).x + e.yyx * map(p + e.yyx, o).x +
    e.yxy * map(p + e.yxy, o).x + e.xxx * map(p + e.xxx, o).x,
  );
}

// A studio: a bright floor, a dark band at the horizon, a big key softbox, a
// rim strip and a top light, all white so the metal's own tint colors the reflection.
fn studio(dir: vec3f) -> vec3f {
  let az = atan2(dir.x, dir.z);
  let el = asin(clamp(dir.y, -1.0, 1.0));
  let floorGlow = mix(vec3f(0.9), vec3f(0.38), smoothstep(-0.05, -0.7, el));
  let sky = mix(vec3f(0.04), vec3f(0.3), smoothstep(0.02, 0.9, el));
  var c = mix(floorGlow, sky, smoothstep(-0.03, 0.03, el));
  let key = smoothstep(0.05, 0.0, abs(az + 0.6) - 0.32) * smoothstep(0.05, 0.0, abs(el - 0.55) - 0.3);
  c += vec3f(3.2) * key;
  let rim = smoothstep(0.04, 0.0, abs(az - 1.55) - 0.09) * smoothstep(0.05, 0.0, abs(el - 0.25) - 0.55);
  c += vec3f(2.4) * rim;
  let back = smoothstep(0.06, 0.0, abs(abs(az) - 2.6) - 0.2) * smoothstep(0.05, 0.0, abs(el - 0.2) - 0.35);
  c += vec3f(1.2) * back;
  c += vec3f(1.6) * smoothstep(1.05, 1.25, el);
  return c;
}

fn fresnel(f0: vec3f, cosT: f32) -> vec3f {
  return f0 + (1.0 - f0) * pow(1.0 - clamp(cosT, 0.0, 1.0), 5.0);
}

fn decals(q: vec3f) -> vec2f {
  // x: mouth line, y: blush and the nose
  let m = vec2f(q.x, q.y + 0.09);
  let curve = abs(m.y + 0.045 - 9.0 * (abs(m.x) - 0.05) * (abs(m.x) - 0.05));
  let mouth = smoothstep(0.02, 0.009, curve) * step(abs(m.x), 0.1) * step(0.5, q.z);
  let cheek = vec2f(abs(q.x) - 0.56, q.y + 0.06);
  let blush = smoothstep(0.15, 0.06, length(cheek * vec2f(1.0, 1.5))) * step(0.3, q.z);
  let nose = smoothstep(0.05, 0.03, length(vec2f(q.x, q.y + 0.01) * vec2f(1.0, 1.4))) * step(0.5, q.z);
  return vec2f(mouth, max(blush, nose));
}

fn surfaceColor(p: vec3f, n: vec3f, rd: vec3f, id: f32, o: Pose, bounce: bool) -> vec3f {
  let r = reflect(rd, n);
  let cosT = dot(-rd, n);
  var env = studio(r);

  if (bounce) {
    var t = 0.02;
    for (var i = 0; i < 40; i++) {
      let h = map(p + r * t, o).x;
      if (h < 0.002) {
        let hp = p + r * t;
        let hn = normal(hp, o);
        env = studio(reflect(r, hn)) * fresnel(params.tint, dot(-r, hn)) * 0.9;
        break;
      }
      t += h;
      if (t > 6.0) {
        break;
      }
    }
  }

  // ambient occlusion from the floor and the body itself
  let ao = clamp(0.55 + 0.45 * map(p + n * 0.12, o).x / 0.12, 0.25, 1.0);

  if (id == ENAMEL) {
    return vec3f(0.012) + fresnel(vec3f(0.05), cosT) * env * ao;
  }
  if (id == CARROT) {
    return fresnel(vec3f(1.0, 0.42, 0.1), cosT) * env * ao;
  }
  if (id == LEAF) {
    return fresnel(vec3f(0.3, 0.78, 0.28), cosT) * env * ao;
  }

  let q = local(p, o);
  let dc = decals(q);
  var f0 = params.tint;
  f0 = mix(f0, f0 * vec3f(1.0, 0.62, 0.7), dc.y * params.blush);
  let metal = fresnel(f0, cosT) * env * ao;
  let ink = vec3f(0.012) + fresnel(vec3f(0.05), cosT) * env * 0.6;
  return mix(metal, ink, dc.x);
}

fn tonemap(c: vec3f) -> vec3f {
  let a = c * (2.51 * c + 0.03);
  let b = c * (2.43 * c + 0.59) + 0.14;
  return pow(clamp(a / b, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let o = pose();
  let zoom = max(1.0, 1.2 / params.aspect);
  let sp = vec2f((uv.x * 2.0 - 1.0) * params.aspect, 1.0 - uv.y * 2.0) * zoom;

  let ro = vec3f(0.0, 0.4, 5.6);
  let ta = vec3f(0.0, 0.3, 0.0);
  let fw = normalize(ta - ro);
  let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)));
  let up = cross(rt, fw);
  let fov = 0.4;
  let rd = normalize(fw + (sp.x * rt + sp.y * up) * fov);

  var t = 0.0;
  var hit = false;
  var id = BODY;
  var closest = 1e9;
  var tClosest = 0.0;
  for (var i = 0; i < 110; i++) {
    let h = map(ro + rd * t, o);
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
    if (t > 9.0) {
      break;
    }
  }

  // pixel footprint along the ray, for a soft silhouette instead of stairs
  let pix = params.px * fov * zoom;
  var alpha = 1.0;
  if (!hit) {
    alpha = 1.0 - smoothstep(0.0, 1.5 * pix, closest);
    t = tClosest;
    id = map(ro + rd * t, o).y;
  }

  // contact shadow on the floor
  let ft = (FLOOR - ro.y) / rd.y;
  var shadow = 0.0;
  if (ft > 0.0) {
    let fp = ro + rd * ft;
    shadow = 0.32 * exp(-dot(fp.xz * vec2f(1.0, 1.6), fp.xz * vec2f(1.0, 1.6)) * 1.4);
  }

  if (alpha <= 0.0) {
    return vec4f(0.0, 0.0, 0.0, shadow);
  }

  let p = ro + rd * t;
  let n = normal(p, o);
  let col = tonemap(surfaceColor(p, n, rd, id, o, true));
  let a = alpha + shadow * (1.0 - alpha);
  return vec4f(col * alpha, a);
}
