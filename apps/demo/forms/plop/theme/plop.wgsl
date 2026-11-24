// Plop, a drop of liquid metal that grew a face. One fullscreen raymarch:
// a soft mochi body with a drip on top, stubby arms and feet, enamel eyes,
// and droplets that orbit and fold back into it. Chrome shading with a
// procedural studio and one extra reflection bounce, so the droplets show in
// the body and the body in the droplets. The background is transparent, so
// the page's own backdrop shows through in light and dark.

struct Params {
  tint: vec3f,
  time: f32,
  look: vec2f,
  aspect: f32,
  jiggle: f32,
  px: f32,
  blush: f32,
}
@group(0) @binding(0) var<uniform> params: Params;

const FLOOR = -0.93;
const BODY = 0.0;
const ENAMEL = 1.0;

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
  o.r = vec3f(1.04 * (1.0 + squash * 0.6), 0.9 * (1.0 - squash), 0.94 * (1.0 + squash * 0.6));
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
  let orbit = mix(1.62 + 0.08 * sin(t + i), 1.08, dive);
  // a tilted ring: low in front so the face stays clear, high behind the head
  let y = 0.12 + 0.22 * sin(t * 0.8 + i * 2.3) - 0.62 * sin(a);
  let r = 0.1 + 0.05 * fract(i * 0.618 + 0.3);
  return vec4f(cos(a) * orbit, y, sin(a) * orbit * 0.7, r);
}

fn map(p: vec3f, o: Pose) -> vec2f {
  let q = local(p, o);
  var d = ellipsoid(q, o.r);

  // the drip on top
  let top = vec3f(o.sway * 0.4, o.r.y, 0.0);
  d = smin(d, length(q - top - vec3f(0.02, 0.06, 0.0)) - 0.17, 0.22);
  d = smin(d, length(q - top - vec3f(0.1 + o.sway, 0.3, 0.0)) - 0.085, 0.16);

  // arms: the left one waves now and then
  let armL = q - vec3f(-0.98, -0.12 + o.wave * 0.38, 0.22);
  d = smin(d, ellipsoid(armL, vec3f(0.19, 0.25, 0.19)), 0.14);
  let armR = q - vec3f(0.98, -0.16, 0.22);
  d = smin(d, ellipsoid(armR, vec3f(0.19, 0.24, 0.19)), 0.14);

  // feet, in world space so they stay on the floor
  let fp = p - vec3f(0.0, FLOOR + 0.1, 0.32);
  let feet = vec3f(abs(fp.x) - 0.4, fp.y, fp.z);
  d = smin(d, ellipsoid(feet, vec3f(0.22, 0.11, 0.22)), 0.12);

  // droplets that orbit and now and then melt back in
  for (var i = 0; i < 4; i++) {
    let s = droplet(f32(i), params.time);
    d = smin(d, length(p - vec3f(s.x, o.center + s.y, s.z)) - s.w, 0.32);
  }

  // enamel eyes, set into the face
  let eyeR = vec3f(0.1, 0.12 * o.blink, 0.07);
  let ex = vec3f(abs(q.x) - 0.33, q.y - 0.12, q.z - 0.84);
  let eyes = ellipsoid(ex, eyeR);
  if (eyes < d) {
    return vec2f(eyes, ENAMEL);
  }
  return vec2f(d, BODY);
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
  // x: mouth line, y: blush
  let m = vec2f(q.x, q.y + 0.05);
  let curve = abs(m.y + 0.045 - 9.0 * (abs(m.x) - 0.05) * (abs(m.x) - 0.05));
  let mouth = smoothstep(0.02, 0.009, curve) * step(abs(m.x), 0.1) * step(0.5, q.z);
  let cheek = vec2f(abs(q.x) - 0.56, q.y + 0.06);
  let blush = smoothstep(0.15, 0.06, length(cheek * vec2f(1.0, 1.5))) * step(0.3, q.z);
  return vec2f(mouth, blush);
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
  let zoom = max(1.0, 1.12 / params.aspect);
  let sp = vec2f((uv.x * 2.0 - 1.0) * params.aspect, 1.0 - uv.y * 2.0) * zoom;

  let ro = vec3f(0.0, 0.25, 5.2);
  let ta = vec3f(0.0, -0.08, 0.0);
  let fw = normalize(ta - ro);
  let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)));
  let up = cross(rt, fw);
  let fov = 0.36;
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
