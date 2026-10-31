// Física simplificada (2D al pla del terra + inclinació de cada bitlla).
// Unitats: metres, segons. Mides del Reglament de Joc FCBB (2010).
// x = lateral (dreta del tirador), y = endavant (cap a les bitlles).

export const PIN_H = 0.51;      // alçada bitlla 510 mm
export const PIN_R = 0.045;     // base Ø 90 mm
export const GAP = 0.165;       // 90 mm base + 75 mm entre bitlles
export const B_LEN = 0.28;      // bitllot 280 mm
export const B_R = 0.04;        // base bitllot Ø 80 mm
export const FALLEN_ANGLE = Math.PI / 4; // tombada si inclinació < 45º respecte l'horitzontal

const G = 9.8;
const CRIT = Math.atan2(PIN_R, 0.21);   // angle de bolcada (~12º)
const K_ROCK = 62;                       // 3g/(2R) bloc basculant
const K_IMP = 2.35;                       // velocitat lineal -> velocitat angular
const M_B = 0.7, M_P = 1.0, I_B = M_B * B_LEN * B_LEN / 12;
const E_REST = 0.35;

// Perfil de la bitlla (h mm -> radi mm), segons el gràfic 1 del reglament
export const PIN_PROFILE = [
  [0, 45], [18, 45], [20, 43], [250, 41], [262, 43], [270, 41], [300, 25], [330, 25],
  [365, 33], [395, 22], [420, 22], [428, 27], [436, 22], [446, 24], [475, 32.5], [500, 28], [510, 14],
];
export function pinRadiusAt(hmm) {
  const P = PIN_PROFILE;
  for (let i = 1; i < P.length; i++) {
    if (hmm <= P[i][0]) {
      const [h0, r0] = P[i - 1], [h1, r1] = P[i];
      return r0 + (r1 - r0) * (hmm - h0) / (h1 - h0);
    }
  }
  return P[P.length - 1][1];
}
// Bitllot (posició des de la base mm -> radi mm), gràfic 2
export function bitllotRadiusAt(smm) {
  if (smm < 18) return 22 + 18 * (smm / 18);
  if (smm < 140) return 40;
  if (smm < 180) return 40 - 20 * (smm - 140) / 40;
  if (smm < 272) return 20;
  return 20 - 12 * (smm - 272) / 8;
}

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export function standardLayout() {
  const pins = [];
  // 1-2-3 primera filera (sobre la línia), 4-5-6 segona filera
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 3; col++)
      pins.push({ id: row * 3 + col + 1, hx: (col - 1) * GAP, hy: row * GAP });
  return pins;
}

function makePin(p) {
  return {
    id: p.id, x: p.x ?? p.hx, y: p.y ?? p.hy, hx: p.hx, hy: p.hy,
    a: 0, w: 0, dx: 0, dy: 1, state: 'stand', leanOn: null, leanA: 0,
    sealed: !!p.sealed, noRing: !!p.noRing, wobbleT: 0, still: 0,
    down: !!p.down,
  };
}

export class Sim {
  constructor(layout, opts = {}) {
    this.pins = layout.map(makePin);
    for (const p of this.pins) if (p.down) { p.state = 'down'; p.a = Math.PI / 2; p.dx = p.fdx ?? 0; }
    this.mu = opts.mu ?? 0.42;
    this.rand = opts.rand ?? Math.random;
    this.events = [];
    this.b = null;
    this.contacts = new Map();
    this.time = 0;
    this.quiet = 0;
  }

  // Restaura bitlles ja tombades d'una tirada anterior
  static fromState(pins, opts) {
    const s = new Sim([], opts);
    s.pins = pins.map(p => ({ ...p, leanOn: null, w: p.state === 'down' ? 0 : 0, still: 0 }));
    for (const p of s.pins) if (p.state !== 'down') { p.state = 'stand'; p.a = 0; p.w = 0; }
    return s;
  }

  launch(t) {
    // t: {x, y, vx, vy, omega, theta, z, vz}
    this.b = { ...t, active: true, air: t.z > 0, rest: 0, trail: [] };
    this.contacts.clear();
    this.quiet = 0;
  }

  emit(type, data) { this.events.push({ type, t: this.time, ...data }); }

  hitPin(p, ux, uy, src) {
    if (p.state === 'down') return;
    const sp = Math.hypot(ux, uy);
    if (sp < 0.01) return;
    const nx = ux / sp, ny = uy / sp;
    if (p.a < 0.02 && p.w < 0.2) {
      p.dx = nx; p.dy = ny; p.w += sp * K_IMP;
    } else {
      const proj = nx * p.dx + ny * p.dy;
      p.w += sp * K_IMP * proj;
      const mix = 0.35 * (1 - Math.abs(proj));
      let dx = p.dx + nx * mix, dy = p.dy + ny * mix; const l = Math.hypot(dx, dy) || 1;
      p.dx = dx / l; p.dy = dy / l;
    }
    if (p.state === 'stand' || p.state === 'lean') p.state = 'rock';
    if (p.state === 'lean') { p.leanOn = null; }
    this.emit('hit', { pin: p.id, speed: sp, src });
  }

  step(dt) {
    this.time += dt;
    const b = this.b;
    if (b && b.active) this.stepBitllot(b, dt);
    this.stepPins(dt);
    // estat de repòs
    const moving = (b && b.active) || this.pins.some(p =>
      (p.state === 'rock' && (Math.abs(p.w) > 0.02 || p.a > 0.003)) || p.state === 'fall' ||
      (p.state === 'lean' && p.leanOn && this.pins[p.leanOn - 1].state !== 'stand'));
    this.quiet = moving ? 0 : this.quiet + dt;
  }

  settled() { return this.quiet > 0.35; }

  stepBitllot(b, dt) {
    if (b.air) {
      b.vz -= G * dt; b.z += b.vz * dt;
      if (b.z <= 0) {
        b.z = 0; b.air = false;
        const keep = 0.72;
        b.vx *= keep; b.vy *= keep; b.omega *= 0.85;
        this.emit('land', { x: b.x, y: b.y, speed: Math.hypot(b.vx, b.vy) });
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.theta += b.omega * dt;
    if (!b.air) {
      const sp = Math.hypot(b.vx, b.vy);
      const dec = this.mu * G * dt;
      if (sp <= dec) { b.vx = 0; b.vy = 0; }
      else { b.vx *= (sp - dec) / sp; b.vy *= (sp - dec) / sp; }
      b.omega *= Math.exp(-2.2 * dt);
    }
    // col·lisions amb bitlles dretes
    const cx = Math.cos(b.theta) * B_LEN / 2, cy = Math.sin(b.theta) * B_LEN / 2;
    const ax = b.x - cx, ay = b.y - cy, bx = b.x + cx, by = b.y + cy;
    for (const p of this.pins) {
      if (p.state === 'down' || p.a > 0.9) continue;
      if (b.z > 0.45) continue;
      // punt més proper del segment
      const ex = bx - ax, ey = by - ay;
      let t = ((p.x - ax) * ex + (p.y - ay) * ey) / (ex * ex + ey * ey);
      t = Math.max(0, Math.min(1, t));
      const qx = ax + ex * t, qy = ay + ey * t;
      let nx = p.x - qx, ny = p.y - qy; const d = Math.hypot(nx, ny);
      const rr = B_R * (t < 0.5 ? 1 : 0.6) + PIN_R * 0.9;
      if (d >= rr || d < 1e-6) continue;
      nx /= d; ny /= d;
      const rx = qx - b.x, ry = qy - b.y;
      const vqx = b.vx - b.omega * ry, vqy = b.vy + b.omega * rx;
      const vn = vqx * nx + vqy * ny;
      // separació
      const pen = rr - d;
      b.x -= nx * pen; b.y -= ny * pen;
      if (vn <= 0) continue;
      const rxn = rx * ny - ry * nx;
      const j = (1 + E_REST) * vn / (1 / M_B + 1 / M_P + rxn * rxn / I_B);
      b.vx -= j / M_B * nx; b.vy -= j / M_B * ny;
      b.omega -= j * rxn / I_B;
      // fregament tangencial
      const tx = -ny, ty = nx; const vt = vqx * tx + vqy * ty;
      const u = j / M_P;
      this.hitPin(p, nx * u + tx * vt * 0.12, ny * u + ty * vt * 0.12, 'b');
    }
    const sp = Math.hypot(b.vx, b.vy);
    if (!b.air && sp < 0.04) { b.rest += dt; if (b.rest > 0.15) { b.active = false; this.emit('stop', {}); } }
    if (b.y > 1.6 || Math.abs(b.x) > 1.5) { b.active = false; this.emit('out', {}); }
  }

  stepPins(dt) {
    const pins = this.pins;
    for (const p of pins) {
      if (p.state === 'down' || p.state === 'stand') continue;
      if (p.state === 'lean') {
        const s = pins[p.leanOn - 1];
        if (!s || s.state === 'down' || s.a > 0.32) { p.state = 'fall'; p.w = Math.max(p.w, 0.6); p.leanOn = null; }
        else {
          // empeny el suport
          const proj = p.dx * s.dx + p.dy * s.dy;
          if (s.state === 'stand') { s.state = 'rock'; s.dx = p.dx; s.dy = p.dy; }
          s.w += 7.5 * dt * Math.max(0.2, proj);
          continue;
        }
      }
      let acc;
      if (p.a < CRIT) acc = -K_ROCK * Math.sin(CRIT - p.a);
      else acc = K_ROCK * 0.55 * Math.sin(p.a - CRIT) + 4;
      p.w += acc * dt;
      p.a += p.w * dt;
      if (p.a >= CRIT && p.state === 'rock') { p.state = 'fall'; }
      if (p.a < CRIT && p.state === 'fall' && p.w < 0) p.state = 'rock';
      if (p.a <= 0) {
        p.a = 0;
        if (p.w < 0) { p.w = -p.w * 0.25; if (p.w > 0.25) this.emit('clack', { pin: p.id, soft: true }); }
        if (p.w < 0.08) { p.w = 0; p.state = 'stand'; }
      }
      if (p.a >= Math.PI / 2) {
        p.a = Math.PI / 2; p.w = 0; p.state = 'down';
        // la base llisca una mica
        p.x -= p.dx * 0.03; p.y -= p.dy * 0.03;
        this.emit('down', { pin: p.id });
      }
    }
    // contactes bitlla-bitlla
    for (const p of pins) {
      if (!(p.state === 'fall' || p.state === 'rock' || p.state === 'down') || p.a < 0.04) continue;
      const reach = PIN_H * Math.sin(p.a);
      const ex = p.dx * reach, ey = p.dy * reach;
      for (const q of pins) {
        if (q === p || q.state === 'down') continue;
        if (q.state === 'lean' && q.leanOn === p.id) continue;
        const key = p.id * 10 + q.id;
        let t = ((q.x - p.x) * ex + (q.y - p.y) * ey) / (ex * ex + ey * ey);
        if (t <= 0) continue;
        t = Math.min(1, t);
        const cx = p.x + ex * t, cy = p.y + ey * t;
        let nx = q.x - cx, ny = q.y - cy; const d = Math.hypot(nx, ny);
        const h = PIN_H * t * Math.cos(p.a); // alçada del contacte
        if (h > PIN_H) continue;
        const rq = pinRadiusAt(h * 1000) / 1000;
        if (d > 0.026 + rq) continue;
        if (this.contacts.has(key)) continue;
        this.contacts.set(key, true);
        if (p.state === 'down') continue;
        nx /= d || 1; ny /= d || 1;
        const arm = PIN_H * t;
        const pv = Math.max(0, p.w) * arm * Math.cos(p.a) * (0.8 + this.rand() * 0.35);
        let hx = p.dx * 0.62 + nx * 0.38, hy = p.dy * 0.62 + ny * 0.38; const hl = Math.hypot(hx, hy);
        hx /= hl; hy /= hl;
        this.hitPin(q, hx * pv * 0.27, hy * pv * 0.27, 'p');
        p.w *= 0.55;
        this.emit('clack', { pin: q.id });
        // si el suport no cau, aquesta queda recolzada
        const willFall = q.w * q.w / 2 > K_ROCK * (1 - Math.cos(CRIT)) * 1.05 || q.a > CRIT;
        if (!willFall && p.a < 0.75) { p.state = 'lean'; p.leanOn = q.id; p.leanA = p.a; p.w = 0; }
      }
    }
  }

  standingIds() { return this.pins.filter(p => p.a < FALLEN_ANGLE).map(p => p.id); }
  fallenCount() { return this.pins.filter(p => p.a >= FALLEN_ANGLE).length; }

  // Instantània per a la tirada següent
  snapshot() {
    return this.pins.map(p => {
      const down = p.a >= FALLEN_ANGLE;
      return { ...p, state: down ? 'down' : 'stand', a: down ? Math.PI / 2 : 0, w: 0, leanOn: null };
    });
  }
}

// Converteix la intenció del jugador en un llançament
// aim: {tx (x a la primera filera), angle (rad, 0 = recte), power 0..1, spin (voltes -3..3)}
export function makeThrow(aim, env, rand = Math.random) {
  const speed = 2.2 + aim.power * 6.8;               // m/s a l'arribada
  const over = Math.max(0, aim.power - 0.82) * 0.25;  // massa força: més dispersió
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rand(); return (u - 2) / 0.577; };
  const noise = gauss() * (0.012 + over) + (env.wind || 0) * 0.045;
  const ang = Math.max(-0.45, Math.min(0.45, aim.angle + gauss() * (0.01 + over * 0.5)));
  const startY = -1.45;
  const tx = aim.tx + noise;
  const x0 = tx - Math.tan(ang) * (-startY);
  const vx = Math.sin(ang) * speed, vy = Math.cos(ang) * speed;
  const landY = Math.min(0.12, -1.05 + (speed - 2.2) * 0.2);
  const tFlight = (landY - startY) / vy;
  const z0 = 0.55;
  const vz = (0 - z0 + 0.5 * G * tFlight * tFlight) / tFlight;
  const turns = aim.spin;
  const omega = (Math.abs(turns) < 0.25 ? 0 : Math.sign(turns) * 3) + turns * 11;
  const dir = Math.atan2(vy, vx);
  const theta = Math.abs(turns) < 0.25 ? dir + (rand() - 0.5) * 0.25 : rand() * Math.PI;
  return { x: x0, y: startY, vx, vy, z: z0, vz, omega, theta };
}
