import { Sim, standardLayout, makeThrow, pinRadiusAt, bitllotRadiusAt, PIN_H, PIN_R, B_LEN, GAP, FALLEN_ANGLE } from './physics.js';
import { drawText, textWidth, wrap, LINE_H } from './font.js';
import { sfx, initAudio, toggleMute, muted, vibrate } from './audio.js';
import { C, Gfx, hash } from './gfx.js';
import { dayInfo, PEOPLE, ORDERS, orderOk, POINTS, REGLAMENT, RULE_PAGES, ENDINGS, FAMILY, CAMPIO_POINTS } from './data.js';

// ───────────────────────── Pantalla ─────────────────────────
const W = 216;
let H = 400;
const STRIP_H = 46, MAIN_Y = 46, DESK_H = 150;
let MAIN_H = 196, DESK_Y = MAIN_Y + MAIN_H;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d', { alpha: false });
let gx = new Gfx(ctx);

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  let scale = Math.max(1, Math.floor(vw * dpr / W));
  while (scale > 1 && vh * dpr / scale < 384) scale--;
  H = Math.max(384, Math.min(500, Math.floor(vh * dpr / scale)));
  MAIN_H = Math.max(196, H - MAIN_Y - DESK_H); DESK_Y = MAIN_Y + MAIN_H;
  S = Math.round(Math.min(150, 118 + (MAIN_H - 196) * 0.3)); OY = MAIN_Y + Math.round(MAIN_H * 0.64); OX = 112;
  pinCache.clear();
  cv.width = W; cv.height = H;
  cv.style.width = (W * scale / dpr) + 'px';
  cv.style.height = (H * scale / dpr) + 'px';
  ctx.imageSmoothingEnabled = false;
  bgMain = null; bgStrip = null; nightMask = null;
}
window.addEventListener('resize', resize);

// ───────────────────────── Iso ─────────────────────────
let S = 118;
let OX = 112, OY = MAIN_Y + 128;
function iso(x, y, z = 0) { return [OX + (x + y) * S, OY + (x - y) * S / 2 - z * S * 0.95]; }
const LANE_SX = 2 / Math.sqrt(5), LANE_SY = -1 / Math.sqrt(5);

// ───────────────────────── Estat ─────────────────────────
let mode = 'title';
let game = null;      // estat persistent de la partida
let day = null;       // estat de la jornada
let tir = null;       // estat de la tirada
let phase = 'aim';
let phaseT = 0;
let modal = null;
let sim = null;
let time = 0;
let shake = 0;
let fx = [];          // partícules
let floats = [];      // textos flotants
let stampFx = null;
let aim = null;       // arrossegament en curs
let inspecting = false;
let selPin = null;
let btns = [];
let heartT = 0;
let ghostT = 0;
let seenTut = {};
let ledger = null;
let ending = null;
let best = loadJSON('bitlles_best') || { day: 0, points: 0 };
let saved = loadJSON('bitlles_save');

function loadJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function delKey(k) { try { localStorage.removeItem(k); } catch (e) {} }

const has = f => day && day.cfg.feats.includes(f);
const rand = Math.random;
const pick = a => a[Math.floor(rand() * a.length)];

function newGame() {
  game = {
    day: 1, money: 10, sospita: 0, quotaFails: 0, warnings: 0, audits: 0,
    totalPoints: 0, bitlles: 0, streak: 0, bestStreak: 0, orders: 0,
    family: FAMILY.map(n => ({ name: n, here: true, hunger: 0, cold: 0, sick: false, sickDays: 0 })),
    seenTut: {},
  };
  startDay();
}

function startDay() {
  const cfg = dayInfo(game.day);
  day = { n: game.day, cfg, tirada: 0, rows: [0, 1, 2].map(() => ({ throws: [], pts: null, tag: '' })),
    pts: 0, orderIncome: 0, orderPen: 0, warnPts: 0, claimBonus: 0, streakBonus: 0, notes: [], illegal: false, whos: [] };
  mode = 'news';
  sfx.anthem();
}

function startTirada(i) {
  day.tirada = i;
  const layout = standardLayout();
  const t = { idx: i, throwIdx: 0, sealed: null, irregular: null, claimed: false, wind: 0, order: null };
  if (has('seal')) { t.sealed = 1 + Math.floor(rand() * 6); layout[t.sealed - 1].sealed = true; }
  if (has('inspect') && rand() < 0.45) {
    const id = 1 + Math.floor(rand() * 6);
    const p = layout[id - 1];
    if (rand() < 0.65) {
      const ang = rand() * Math.PI * 2, d = 0.035 + rand() * 0.02;
      p.x = p.hx + Math.cos(ang) * d; p.y = p.hy + Math.sin(ang) * d;
      t.irregular = { id, type: 'pos' };
    } else { p.noRing = true; t.irregular = { id, type: 'ring' }; }
  }
  if (has('wind')) t.wind = (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 2.1);
  if (has('orders') && rand() < (day.n === 2 ? 0.7 : 0.6)) {
    const pool = ORDERS.filter(o => o.minDay <= day.n && !day.whos.includes(o.who));
    if (pool.length) {
      const o = pick(pool);
      day.whos.push(o.who);
      t.order = { ...o, pin: 1 + Math.floor(rand() * 6), status: 'pending', result: null };
      t.order.body = o.text(t.order);
      if (o.kind === 'deixa') layout[t.order.pin - 1].ribbon = true;
    }
  }
  tir = t;
  sim = new Sim(layout, { mu: has('wet') ? 0.2 : 0.42 });
  for (const p of sim.pins) { const src = layout[p.id - 1]; p.ribbon = !!src.ribbon; }
  inspecting = false; selPin = null;
  setPhase('replant');
}

function setPhase(p) { phase = p; phaseT = 0; }

// ───────────────────────── Lògica de joc ─────────────────────────
function stress() {
  let s = game.sospita * 0.12;
  const remain = 3 - day.tirada;
  const need = day.cfg.quota - day.pts;
  if (need > 0) s += Math.min(0.5, need / (remain * 10 + 1) * 0.6);
  if (game.family.some(f => f.here && f.sick)) s += 0.15;
  if (has('inspector')) s += 0.1;
  return Math.min(1, s);
}

function swayAmp(power, spin) {
  return 0.007 + Math.abs(spin) * 0.011 + stress() * 0.02 + (power > 0.82 ? 0.012 : 0);
}
function sway(t, amp) { return amp * (Math.sin(t * 5.1) + 0.55 * Math.sin(t * 13.3 + 1.3)); }

function computeAim(a) {
  const dx = a.cx - a.sx, dy = a.cy - a.sy;
  const len = Math.hypot(dx, dy);
  if (len < 6) return null;
  const ux = dx / len, uy = dy / len;
  const fwd = ux * LANE_SX + uy * LANE_SY;
  const cross = LANE_SX * uy - LANE_SY * ux;
  const phi = Math.atan2(cross, fwd);
  if (Math.abs(phi) > 1.25) return { invalid: true };
  const tx = 0.78 * Math.tan(0.6 * phi);
  const power = Math.max(0, Math.min(1, (len - 12) / 100));
  const spin = has('spin') ? Math.max(-3, Math.min(3, a.turn / (Math.PI * 2))) : 0;
  return { tx, power, spin, len };
}

function release() {
  const a = computeAim(aim);
  aim = null;
  if (!a || a.invalid || a.power < 0.02) return;
  const amp = swayAmp(a.power, a.spin);
  const tx = a.tx + sway(time, amp);
  const thr = makeThrow({ tx, angle: tx * 0.05, power: a.power, spin: a.spin }, { wind: tir.wind });
  tir.pendingThrow = thr;
  tir.lastAim = { tx, power: a.power, spin: a.spin };
  setPhase('throw');
  sfx.whoosh();
}

function processEvents() {
  for (const e of sim.events) {
    if (e.type === 'hit') {
      sfx.clack(Math.min(1.2, 0.4 + e.speed * 0.4)); vibrate(e.src === 'b' ? 12 : 6);
      const p = sim.pins[e.pin - 1]; const [sx, sy] = iso(p.x, p.y, 0.15);
      burst(sx, sy, 3, C.pinL);
      if (e.src === 'b') shake = Math.max(shake, 0.12);
    } else if (e.type === 'clack') { sfx.clack(e.soft ? 0.3 : 0.7); }
    else if (e.type === 'down') {
      sfx.thud(); vibrate(10);
      const p = sim.pins[e.pin - 1];
      const [sx, sy] = iso(p.x + p.dx * 0.4, p.y + p.dy * 0.4, 0);
      burst(sx, sy, 7, C.dirt1, true);
    } else if (e.type === 'land') {
      sfx.land(); const [sx, sy] = iso(e.x, e.y, 0); burst(sx, sy, 6, C.dirt1, true);
    }
  }
  sim.events.length = 0;
}

function burst(x, y, n, c, dust) {
  for (let i = 0; i < n; i++) fx.push({ x, y, vx: (rand() - 0.5) * (dust ? 40 : 60), vy: -rand() * (dust ? 25 : 50), life: 0.4 + rand() * 0.4, c: dust ? (rand() < 0.5 ? C.dirt1 : C.dirt2) : c, g: dust ? 40 : 160 });
}
function floatText(text, x, y, c) { floats.push({ text, x, y, t: 0, c }); }

function throwSettled() {
  const n = sim.fallenCount();
  const row = day.rows[tir.idx];
  row.throws.push(n);
  sim.b = null;
  if (n >= 5 || tir.throwIdx >= 2) { endTirada(n); return; }
  const prev = row.throws.length > 1 ? row.throws[row.throws.length - 2] : 0;
  const d = n - prev;
  floatText(d === 0 ? 'CAP' : (d === 1 ? '1 TOMBADA' : `${d} TOMBADES`), 108, MAIN_Y + 30, d ? C.white : C.redL);
  if (d === 0) sfx.groan();
  tir.throwIdx++;
  setPhase('aim');
}

function endTirada(n) {
  const row = day.rows[tir.idx];
  const standing = sim.standingIds();
  let pts = POINTS[n], tag = '', color = C.ink;
  if (n === 5) {
    tag = 'BITLLA!'; color = C.red;
    if (tir.sealed && standing[0] === tir.sealed) { pts = 15; tag = "BITLLA D'OR"; color = C.goldD; }
  } else if (n === 6) { tag = 'LLENYA'; color = C.bitD; }
  else if (n === 0) { tag = 'ZERO'; color = C.ink2; }
  else tag = `${n} BITLLES`;
  // plantada irregular no reclamada
  if (tir.irregular && !tir.claimed && rand() < 0.55) {
    pts = 0; tag = 'NUL·LA'; color = C.redD;
    day.notes.push(`T${tir.idx + 1}: PLANTADA IRREGULAR. TIRADA NUL·LA.`);
    queueMsg('inspector', 'TIRADA NUL·LA', `LA BITLLA Nº${tir.irregular.id} ${tir.irregular.type === 'pos' ? 'ESTAVA FORA DE LA PLANTILLA' : 'NO TENIA ANELLA DE FERRO'}. CALIA RECLAMAR ABANS DE TIRAR. TIRADA NUL·LA.`);
  }
  row.pts = pts; row.tag = tag; row.color = color;
  day.pts += pts;
  if (n === 5) {
    game.bitlles++; game.streak++; game.bestStreak = Math.max(game.bestStreak, game.streak);
    if (game.streak >= 2) { day.streakBonus += game.streak - 1; floatText(`RATXA X${game.streak} +${game.streak - 1} PTA`, 108, MAIN_Y + 150, C.gold); }
    sfx.cheer(pts === 15 ? 1.6 : 1.2); sfx.bell(); vibrate([30, 40, 60]);
  } else {
    game.streak = 0;
    if (n === 6) sfx.cheer(0.6); else sfx.groan();
  }
  // encàrrec
  const o = tir.order;
  if (o && o.status === 'accepted') {
    const ok = orderOk(o, { n, standing });
    o.result = ok ? 'ok' : 'ko';
    if (ok) { day.orderIncome += o.pay; floatText(`ENCÀRREC +${o.pay} PTES`, 108, MAIN_Y + 138, C.greenL); setTimeout(() => sfx.coin(), 500); }
    else if (o.pen) { day.orderPen += o.pen; floatText(`PENYORA -${o.pen} PTES`, 108, MAIN_Y + 138, C.redL); }
  }
  stampFx = { text: tag, color, t: 0, pts };
  shake = 0.3;
  setPhase('result');
}

function queueMsg(who, title, text) {
  msgQueue.push({ type: 'msg', who, title, text });
}
const msgQueue = [];

function endDay() {
  let pts = day.pts - day.warnPts;
  day.final = Math.max(0, pts);
  day.quotaOk = day.final >= day.cfg.quota;
  game.totalPoints += day.final;
  setPhase('dayend');
  sfx.stamp();
}

function buildLedger() {
  const cfg = day.cfg;
  const L = {
    start: game.money,
    premi: Math.floor(day.final / 2),
    orders: day.orderIncome + day.claimBonus,
    streak: day.streakBonus,
    fines: day.orderPen + (day.quotaOk ? 0 : 3),
    rent: cfg.rent || 5,
    food: true, heat: true, meds: game.family.some(f => f.here && f.sick),
    lines: [],
  };
  if (!day.quotaOk) { game.quotaFails++; L.lines.push(`NO ARRIBES AL MÍNIM: MULTA 3 PTES (${game.quotaFails}/3)`); }
  // expedient per sospita
  if (game.sospita >= 2) {
    const p = Math.min(0.9, 0.22 * (game.sospita - 1) * (has('inspector') ? 2 : 1));
    if (rand() < p) {
      game.audits++;
      L.fines += 6;
      L.lines.push('EXPEDIENT DE LA FEDERACIÓ: MULTA 6 PTES');
      game.sospita = Math.max(0, game.sospita - 2);
    }
  }
  if (!day.illegal) game.sospita = Math.max(0, game.sospita - 1);
  ledger = L;
  mode = 'ledger';
  sfx.paper();
}

function ledgerTotal(L) {
  return L.start + L.premi + L.orders + L.streak - L.fines - L.rent - (L.food ? 3 : 0) - (L.heat ? 2 : 0) - (L.meds ? 4 : 0);
}

function confirmLedger() {
  const L = ledger;
  const base = L.start + L.premi + L.orders + L.streak - L.fines - L.rent;
  if (base < 0) return finish('desnonat');
  const tot = ledgerTotal(L);
  if (tot < 0) { sfx.buzz(); return; }
  game.money = tot;
  const notes = [];
  for (const f of game.family) {
    if (!f.here) continue;
    f.hunger = L.food ? 0 : f.hunger + 1;
    f.cold = L.heat ? 0 : f.cold + 1;
    if (f.sick) {
      if (L.meds) { f.sick = false; f.sickDays = 0; }
      else { f.sickDays++; if (f.sickDays >= 2) { f.here = false; notes.push(`${f.name} HA MARXAT.`); } }
    } else if ((f.hunger >= 2 || f.cold >= 2 || (f.hunger >= 1 && f.cold >= 1)) && rand() < 0.7) f.sick = true;
  }
  if (game.sospita >= 5) return finish('inhabilitat');
  if (game.quotaFails >= 3) return finish('expulsat');
  if (!game.family.some(f => f.here)) return finish('sol');
  if (day.cfg.final && !game.finalDone) {
    game.finalDone = true;
    return finish(game.totalPoints >= CAMPIO_POINTS ? 'campio' : 'supervivent', true);
  }
  game.day++;
  saveJSON('bitlles_save', game); saved = game;
  updateBest();
  startDay();
}

function updateBest() {
  if (game.day > best.day || (game.day === best.day && game.totalPoints > best.points)) {
    best = { day: game.day, points: game.totalPoints };
    saveJSON('bitlles_best', best);
  }
}

function finish(kind, canContinue = false) {
  updateBest();
  ending = { kind, ...ENDINGS[kind], canContinue };
  if (!canContinue) { delKey('bitlles_save'); saved = null; }
  else { game.day++; saveJSON('bitlles_save', game); saved = game; }
  mode = 'ending';
  if (kind === 'campio') { sfx.anthem(); sfx.cheer(2); } else sfx.groan();
}

// ───────────────────────── Actualització ─────────────────────────
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  time += dt;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function update(dt) {
  phaseT += dt;
  shake = Math.max(0, shake - dt);
  for (const p of fx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt; }
  fx = fx.filter(p => p.life > 0);
  for (const f of floats) f.t += dt;
  floats = floats.filter(f => f.t < 1.6);
  if (mode !== 'play') return;
  if (!modal && msgQueue.length) { modal = msgQueue.shift(); sfx.paper(); }
  if (modal) return;

  if (phase === 'replant') {
    if (phaseT > 0.9) {
      const tut = tutFor();
      if (tut) { msgQueue.push({ type: 'tut', key: tut }); game.seenTut[tut] = true; }
      if (tir.order && tir.order.status === 'pending') msgQueue.push({ type: 'order' });
      setPhase('aim');
    }
  } else if (phase === 'aim') {
    if (aim) {
      heartT -= dt;
      const st = stress();
      if (heartT <= 0 && (st > 0.25 || (aim.spinAbs || 0) > 1)) { sfx.heart(st); heartT = 60 / (70 + st * 70); }
    }
    ghostT += dt;
  } else if (phase === 'throw') {
    if (phaseT > 0.42) { sim.launch(tir.pendingThrow); setPhase('sim'); }
  } else if (phase === 'sim') {
    const steps = 6;
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) sim.step(sdt);
    processEvents();
    if ((sim.settled() && !sim.b.active) || phaseT > 8) throwSettled();
  } else if (phase === 'result') {
    if (stampFx) stampFx.t += dt;
    if (phaseT > 2.0) {
      stampFx = null;
      if (tir.idx < 2) startTirada(tir.idx + 1); else endDay();
    }
  } else if (phase === 'dayend') {
    if (phaseT > 2.2) buildLedger();
  }
}

function tutFor() {
  if (tir.idx !== 0) return null;
  const k = day.cfg.tut;
  if (k && !game.seenTut[k]) return k;
  return null;
}

// ───────────────────────── Entrada ─────────────────────────
let ptr = null;
function toLocal(e) {
  const r = cv.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  initAudio();
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  const [x, y] = toLocal(e);
  ptr = { id: e.pointerId, x0: x, y0: y, x, y, t0: performance.now(), moved: false, onBtn: hitBtn(x, y) };
  if (canAim() && !ptr.onBtn) {
    aim = { sx: x, sy: y, cx: x, cy: y, turn: 0, lx: x, ly: y, lh: null };
  }
});
cv.addEventListener('pointermove', e => {
  if (!ptr || e.pointerId !== ptr.id) return;
  const [x, y] = toLocal(e);
  ptr.x = x; ptr.y = y;
  if (Math.hypot(x - ptr.x0, y - ptr.y0) > 5) ptr.moved = true;
  if (aim) {
    aim.cx = x; aim.cy = y;
    const d = Math.hypot(x - aim.lx, y - aim.ly);
    if (d >= 3) {
      const h = Math.atan2(y - aim.ly, x - aim.lx);
      if (aim.lh !== null) {
        let dh = h - aim.lh; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
        if (Math.abs(dh) < 1.6) aim.turn += dh;
      }
      aim.lh = h; aim.lx = x; aim.ly = y;
      aim.spinAbs = Math.abs(aim.turn / (Math.PI * 2));
    }
  }
});
function endPtr(e, cancel) {
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = ptr; ptr = null;
  if (aim) {
    if (!p.moved || cancel) { aim = null; tap(p.x, p.y); }
    else release();
    return;
  }
  if (!p.moved || p.onBtn) tap(p.x, p.y);
}
cv.addEventListener('pointerup', e => endPtr(e, false));
cv.addEventListener('pointercancel', e => endPtr(e, true));
window.addEventListener('keydown', e => { if (e.key === 'm') toggleMute(); });

function canAim() {
  return mode === 'play' && !modal && phase === 'aim' && !inspecting;
}

function hitBtn(x, y) {
  for (let i = btns.length - 1; i >= 0; i--) {
    const b = btns[i];
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
  }
  return null;
}

function tap(x, y) {
  const b = hitBtn(x, y);
  if (b) { if (!b.disabled) { sfx.click(); b.fn(); } return; }
  if (mode === 'news') { mode = 'play'; startTirada(0); return; }
  if (mode === 'play') {
    if (modal && modal.type === 'msg') { modal = null; return; }
    if (inspecting && y > MAIN_Y && y < DESK_Y) {
      let bestP = null, bd = 9;
      for (const p of sim.pins) {
        const [bx, by] = iso(p.x, p.y, 0); const [tx, ty] = iso(p.x, p.y, 0.4);
        const d = distSeg(x, y, bx, by, tx, ty);
        if (d < bd) { bd = d; bestP = p; }
      }
      selPin = bestP ? bestP.id : null;
      return;
    }
    if (phase === 'result' && phaseT > 0.6) phaseT = 2.0;
    if (phase === 'dayend' && phaseT > 0.8) phaseT = 2.2;
  }
}

function distSeg(px, py, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay;
  let t = ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey || 1);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - ex * t, py - ay - ey * t);
}

function button(x, y, w, h, label, fn, o = {}) {
  btns.push({ x, y, w, h, fn, disabled: o.disabled });
  const bg = o.disabled ? C.greyD : (o.bg || C.paper);
  gx.rect(x, y + 1, w, h, C.dark);
  gx.rect(x, y, w, h - 1, bg);
  gx.box(x, y, w, h - 1, o.border || C.ink);
  if (o.icon) o.icon(x, y, w, h);
  else drawText(ctx, label, x + w / 2, y + Math.floor((h - 8) / 2), o.fg || C.ink, { align: 'center' });
}

// ───────────────────────── Dibuix: pins ─────────────────────────
const pinCache = new Map();
function pinColors(h, p, sel) {
  const hm = h * 1000;
  if (hm < 20 && !p.noRing) return [C.ironL, C.ironM, C.ironD];
  if (p.sealed && hm > 446) return [C.redL, C.red, C.redD];
  if (p.ribbon && hm > 286 && hm < 336) return [C.blueL, C.blueL, C.blue];
  if ((hm > 255 && hm < 268) || (hm > 424 && hm < 432)) return [C.pinD, C.pinS, C.pinO];
  return [C.pinL, C.pinM, C.pinD];
}

function drawPin(p, extraZ = 0, sel = false) {
  const standing = p.a === 0 && extraZ === 0;
  if (standing) {
    const key = `${p.sealed}|${p.noRing}|${p.ribbon}|${sel}`;
    let spr = pinCache.get(key);
    if (!spr) {
      spr = document.createElement('canvas'); spr.width = 30; spr.height = 92;
      const g2 = spr.getContext('2d');
      const saved = gx; gx = new Gfx(g2);
      renderPinBody({ ...p, x: 0, y: 0, a: 0 }, 15, 86, sel);
      gx = saved;
      pinCache.set(key, spr);
    }
    const [sx, sy] = iso(p.x, p.y, 0);
    ctx.drawImage(spr, Math.round(sx) - 15, Math.round(sy) - 86);
    return;
  }
  const [sx, sy] = iso(p.x, p.y, extraZ);
  renderPinBody(p, sx, sy, sel);
}

function renderPinBody(p, bx, by, sel) {
  const sa = Math.sin(p.a), ca = Math.cos(p.a);
  const steps = 44;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const h = i / steps * PIN_H;
    const r = pinRadiusAt(h * 1000) / 1000;
    const wx = p.dx * h * sa, wy = p.dy * h * sa, wz = h * ca + 0.042 * sa;
    pts.push([bx + (wx + wy) * S, by + (wx - wy) * S / 2 - wz * S * 0.95, r * S, h]);
  }
  if (p.a > 0.05 && (p.dx - p.dy) < 0) pts.reverse();
  const out = sel ? C.redL : C.pinO;
  for (const [x, y, r] of pts) gx.disc(x, y, r + 1, out);
  for (const [x, y, r, h] of pts) gx.disc(x, y, r, pinColors(h, p)[2]);
  for (const [x, y, r, h] of pts) gx.disc(x - r * 0.28, y, r * 0.66, pinColors(h, p)[1]);
  for (const [x, y, r, h] of pts) if (r > 2) gx.disc(x - r * 0.5, y, r * 0.25, pinColors(h, p)[0]);
}

function drawBitllot(b) {
  const steps = 26;
  const cx = Math.cos(b.theta), cy = Math.sin(b.theta);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps * B_LEN;
    const r = bitllotRadiusAt(s * 1000) / 1000;
    const wx = b.x + cx * (s - B_LEN / 2), wy = b.y + cy * (s - B_LEN / 2);
    const [x, y] = iso(wx, wy, b.z + 0.04);
    pts.push([x, y, r * S, s]);
  }
  if ((cx - cy) < 0) pts.reverse();
  for (const [x, y, r] of pts) gx.disc(x, y, r + 1, C.bitO);
  for (const [x, y, r] of pts) gx.disc(x, y, r, C.bitD);
  for (const [x, y, r, s] of pts) gx.disc(x - r * 0.25, y - r * 0.2, r * 0.65, s > 0.19 && s < 0.25 ? C.tape : C.bitM);
  for (const [x, y, r] of pts) if (r > 2) gx.disc(x - r * 0.45, y - r * 0.4, r * 0.25, C.bitL);
}

// ───────────────────────── Dibuix: fons ─────────────────────────
let bgMain = null, bgStrip = null, nightMask = null, bgKey = '';
function inv(sx, sy) {
  const a = (sx - OX) / S, b = 2 * (sy - OY) / S;
  return [(a + b) / 2, (a - b) / 2];
}
const WALL_Y = 1.18, LANE_W = 0.9;

function buildBgMain() {
  const c = document.createElement('canvas'); c.width = W; c.height = MAIN_H;
  const g = c.getContext('2d'); const G2 = new Gfx(g);
  const wet = has('wet');
  for (let j = 0; j < MAIN_H; j++) {
    for (let i = 0; i < W; i++) {
      const sy = j + MAIN_Y;
      const [x, y] = inv(i, sy);
      // paret del fons
      const wxw = (i - OX) / S - WALL_Y;
      const wallBot = OY + (wxw - WALL_Y) * S / 2;
      const wallTop = wallBot - 0.55 * S * 0.95;
      let col;
      if (sy < wallTop) {
        // fons: arbres i cel
        const tree = Math.sin(i * 0.21) * 4 + Math.sin(i * 0.53) * 2 + hash(i, 7) * 2;
        col = (sy - MAIN_Y) < 14 + tree ? (hash(i, j) < 0.5 ? C.sky2 : C.sky1) : ((hash(i, j) < 0.15) ? C.hill : C.hill2);
      } else if (sy <= wallBot) {
        // tanca de taulons
        const plank = Math.floor((wxw + 3) / 0.12);
        const edge = ((wxw + 3) / 0.12) % 1 < 0.1;
        const v = sy - wallTop;
        col = edge ? C.woodD : (plank % 2 ? C.wood : C.woodL);
        if (v < 2) col = C.woodDD;
        if (hash(i, j) < 0.06) col = C.woodD;
      } else if (Math.abs(x) <= LANE_W && y < WALL_Y) {
        const h = hash(i, j);
        const rake = (Math.floor((x + 1) / 0.06) % 2) === 0;
        col = h < 0.25 ? C.dirt2 : h < 0.32 ? C.dirt3 : (rake && h < 0.6 ? C.dirt2 : C.dirt1);
        if (y > -0.12 && y < 0.3 && Math.abs(x) < 0.3) col = h < 0.3 ? C.dirt3 : C.dirt2; // zona de plantada
        if (wet) {
          const pud = Math.sin(x * 9 + 1) * Math.sin(y * 7 + 2) + Math.sin(x * 23) * 0.3;
          if (pud > 0.75) col = h < 0.2 ? '#7d8a8a' : '#4c5552';
          else if (h < 0.4) col = C.dirt3;
        }
      } else {
        const h = hash(i, j);
        col = h < 0.3 ? C.grass2 : h < 0.38 ? C.grass3 : C.grass1;
        if (Math.abs(x) <= LANE_W + 0.05 && y < WALL_Y) col = C.woodD; // vora
      }
      g.fillStyle = col; g.fillRect(i, j, 1, 1);
    }
  }
  // línies de calç
  const lineW = (x0, y0, x1, y1) => {
    const [a, b] = iso(x0, y0); const [c2, d] = iso(x1, y1);
    G2.line(a, b - MAIN_Y, c2, d - MAIN_Y, C.chalk);
  };
  lineW(-LANE_W, -2, -LANE_W, WALL_Y); lineW(LANE_W, -2, LANE_W, WALL_Y);
  lineW(-LANE_W, -PIN_R, LANE_W, -PIN_R); // línia de plantada
  lineW(-LANE_W, 0.75, LANE_W, 0.75);
  // cartells a la tanca
  const poster = (x, txt, c1, c2) => {
    const [a, b] = iso(x, WALL_Y, 0.42);
    const y0 = b - MAIN_Y;
    for (let k = 0; k < 30; k++) G2.rect(a + k, y0 + k * 0.5, 1, 14, c1);
    g.save();
    drawText(g, txt, a + 2, y0 + 4, c2);
    g.restore();
  };
  poster(-0.62, 'LLIGA', C.paper, C.red);
  poster(0.25, '1979', C.red, C.paper);
  return c;
}

function buildNightMask() {
  const c = document.createElement('canvas'); c.width = W; c.height = MAIN_H;
  const g = c.getContext('2d');
  const [lx, ly] = iso(0, 0.08, 0.2);
  for (let j = 0; j < MAIN_H; j++) for (let i = 0; i < W; i++) {
    const d = Math.hypot((i - lx) * 0.8, (j + MAIN_Y - ly) * 1.1);
    const k = (i + j) % 2, k4 = (i % 2) + (j % 2) * 2;
    let on = false;
    if (d > 92) on = true;
    else if (d > 76) on = k === 0 || k4 === 1;
    else if (d > 62) on = k === 0;
    else if (d > 52) on = k4 === 0;
    if (on) { g.fillStyle = '#07090f'; g.fillRect(i, j, 1, 1); }
  }
  return c;
}

function buildBgStrip() {
  const c = document.createElement('canvas'); c.width = W; c.height = STRIP_H;
  const g = c.getContext('2d'); const G2 = new Gfx(g);
  const night = has('night'), wet = has('wet');
  for (let j = 0; j < STRIP_H; j++) for (let i = 0; i < W; i++) {
    let col = j < 10 ? C.sky1 : j < 20 ? (hash(i, j) < (j - 10) / 10 ? C.sky2 : C.sky1) : j < 30 ? (hash(i, j) < (j - 20) / 10 ? C.sky3 : C.sky2) : C.sky3;
    if (night) col = j < 20 ? '#10131c' : '#1a1f2a';
    if (wet && !night) col = j < 20 ? '#3a4448' : '#4c5654';
    g.fillStyle = col; g.fillRect(i, j, 1, 1);
  }
  if (night) for (let k = 0; k < 24; k++) G2.px(hash(k, 1) * W, hash(k, 2) * 22, '#c8c8b0');
  // turons i poble
  for (let i = 0; i < W; i++) {
    const hgt = 30 - (Math.sin(i * 0.035) * 4 + Math.sin(i * 0.09 + 1) * 2 + 3);
    G2.rect(i, hgt, 1, STRIP_H - hgt, night ? '#151a18' : C.hill);
  }
  const house = (x, w, h) => { G2.rect(x, 33 - h, w, h, night ? '#0e1110' : C.hill2); G2.rect(x - 1, 33 - h - 2, w + 2, 2, night ? '#0e1110' : C.hill2); };
  house(40, 10, 6); house(52, 7, 9); house(150, 12, 5); house(165, 8, 8);
  // campanar
  G2.rect(60, 12, 6, 21, night ? '#0e1110' : C.hill2); G2.rect(61, 9, 4, 3, night ? '#0e1110' : C.hill2); G2.rect(62, 7, 2, 2, night ? '#0e1110' : C.hill2);
  G2.rect(62, 15, 2, 3, night ? '#c8a050' : C.sky1);
  // pista
  G2.rect(0, 34, W, 12, night ? '#2a2018' : C.dirt2);
  for (let i = 0; i < W; i++) if (hash(i, 99) < 0.4) G2.px(i, 35 + Math.floor(hash(i, 98) * 10), night ? '#221a14' : C.dirt3);
  G2.rect(0, 34, W, 1, night ? '#3a2e22' : C.dirt1);
  G2.rect(22, 34, 1, 12, C.chalk); // línia de tir
  return c;
}

// ───────────────────────── Dibuix: franja superior ─────────────────────────
function drawStrip() {
  if (!bgStrip) bgStrip = buildBgStrip();
  ctx.drawImage(bgStrip, 0, 0);
  // bandera (senyera)
  const wind = tir ? tir.wind : 0;
  const fx0 = 112;
  gx.rect(fx0, 8, 1, 27, C.greyD);
  const dir = wind >= 0 ? 1 : -1, len = 4 + Math.abs(wind) * 3;
  for (let k = 0; k < len; k++) {
    const wav = Math.round(Math.sin(time * 9 + k * 0.8) * (0.4 + Math.abs(wind) * 0.3));
    const x = fx0 + dir * (k + 1);
    for (let s = 0; s < 6; s++) gx.px(x, 8 + s + wav, s % 2 ? C.red : C.gold);
  }
  // jugador
  drawPlayer(14, 45);
  // bitlles
  const pins = sim ? sim.pins : standardLayout().map(p => ({ ...p, a: 0, dx: 0, dy: 1 }));
  for (const p of [...pins].sort((a, b) => b.hy - a.hy)) {
    const bx = 196 + (p.hy || 0) * 30 + (p.x - (p.hx || 0)) * 0 + (p.hx || 0) * 6, by = 44 - (p.hy || 0) * 6;
    const a = p.a || 0; const len2 = 9;
    const ex = bx + Math.sin(a) * len2 * (p.dy >= 0 ? 1 : -1), ey = by - Math.cos(a) * len2;
    gx.line(bx, by, ex, ey, C.pinM); gx.line(bx + 1, by, ex + 1, ey, C.pinD);
  }
  // bitllot en vol
  if (phase === 'throw' || (phase === 'sim' && sim.b && sim.b.y < -1.2)) {
    const t = phase === 'throw' ? Math.min(1, phaseT / 0.42) : 1;
    const x = 20 + t * 168, y = 30 - Math.sin(t * Math.PI) * 18 + t * 8;
    const ang = time * 25;
    gx.line(x - Math.cos(ang) * 3, y - Math.sin(ang) * 1.5, x + Math.cos(ang) * 3, y + Math.sin(ang) * 1.5, C.bitD);
  }
  // pluja
  if (has('wet')) for (let k = 0; k < 30; k++) {
    const x = (hash(k, 3) * W + time * 60) % W, y = (hash(k, 4) * STRIP_H + time * 140 + k * 13) % STRIP_H;
    gx.line(x, y, x - 1, y + 3, '#9fb0b4');
  }
  // HUD
  gx.rect(0, 0, W, 10, 'rgba(16,13,12,0.75)');
  if (day) {
    drawText(ctx, `JORNADA ${day.n}`, 3, 1, C.paper);
    const b = tir ? Math.min(3, tir.throwIdx + 1) : 1;
    drawText(ctx, `TIRADA ${day.tirada + 1}/3 · BITLLOT ${b}/3`, W - 3, 1, C.paper2, { align: 'right' });
  }
}

function drawPlayer(x, gy) {
  let armA = 0.25;
  let lean = 0;
  if (phase === 'aim' && aim) { const a = computeAim(aim); armA = a && !a.invalid ? 0.3 + a.power * 1.6 : 0.3; lean = -1; }
  if (phase === 'throw') { const t = phaseT / 0.42; armA = t < 0.3 ? 1.9 - t * 4 : -1.4; lean = 1; }
  // cames
  gx.rect(x - 2, gy - 7, 2, 7, C.ink); gx.rect(x + 1 + lean, gy - 7, 2, 7, C.ink);
  gx.rect(x - 3, gy - 1, 3, 1, C.dark); gx.rect(x + 1 + lean, gy - 1, 3, 1, C.dark);
  // faixa i camisa
  gx.rect(x - 2 + lean, gy - 9, 6, 2, C.red);
  gx.rect(x - 2 + lean, gy - 15, 6, 6, C.white);
  // cap i barretina
  gx.rect(x - 1 + lean, gy - 19, 4, 4, '#c99a76');
  gx.rect(x - 1 + lean, gy - 21, 4, 2, C.ink);
  gx.px(x + 2 + lean, gy - 17, C.ink);
  // braç
  const sx = x + 1 + lean, sy = gy - 14;
  const ex = sx + Math.sin(-armA + Math.PI) * -6, ey = sy + Math.cos(armA) * 6;
  gx.line(sx, sy, ex, ey, C.white); gx.line(sx + 1, sy, ex + 1, ey, C.paper2);
  if (phase !== 'throw' || phaseT < 0.12) gx.line(ex, ey, ex + Math.cos(armA) * 3, ey - Math.sin(armA) * 3 + 2, C.bitD);
}

// ───────────────────────── Dibuix: vista principal ─────────────────────────
function drawMain() {
  const key = `${day ? day.n : 0}|${H}`;
  if (!bgMain || bgKey !== key) { bgMain = buildBgMain(); bgKey = key; nightMask = has('night') ? buildNightMask() : null; }
  ctx.save();
  ctx.beginPath(); ctx.rect(0, MAIN_Y, W, MAIN_H); ctx.clip();
  const sh = shake > 0 ? Math.round((rand() - 0.5) * 4 * shake / 0.3) : 0;
  ctx.translate(sh, 0);
  ctx.drawImage(bgMain, 0, MAIN_Y);

  // plantilla (inspecció)
  if (inspecting) {
    for (const p of sim.pins) {
      const [cx, cy] = iso(p.hx, p.hy);
      for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2;
        if (k % 2) continue;
        const [x, y] = iso(p.hx + Math.cos(a) * PIN_R, p.hy + Math.sin(a) * PIN_R);
        gx.px(x, y, C.redL);
      }
      gx.px(cx, cy, C.redL);
    }
  }

  // ombres
  if (sim) {
    for (const p of sim.pins) {
      if (p.a < 0.6) { const [x, y] = iso(p.x, p.y); gx.ellipse(x + 3, y + 1, 7, 3, C.shadow); }
    }
    if (sim.b && sim.b.y > -2) { const [x, y] = iso(sim.b.x, sim.b.y); gx.ellipse(x, y + 1, 14, 5, C.shadow); }
  }

  // previsió de l'apuntat
  if (phase === 'aim' && aim && !modal) drawAimGuide();

  // objectes ordenats per profunditat
  if (sim) {
    const objs = [];
    const drop = phase === 'replant';
    sim.pins.forEach((p, i) => {
      let z = 0;
      if (drop) z = Math.max(0, (0.12 + i * 0.09 - phaseT)) * 3;
      const depth = p.a > 0.3 ? (p.x - p.y) + (p.dx - p.dy) * 0.25 * Math.sin(p.a) : p.x - p.y;
      objs.push({ d: depth, f: () => drawPin(p, z, inspecting && selPin === p.id) });
    });
    if (sim.b && sim.b.y > -2.2) objs.push({ d: sim.b.x - sim.b.y + 0.02, f: () => drawBitllot(sim.b) });
    objs.sort((a, b) => a.d - b.d);
    for (const o of objs) o.f();
  }

  // partícules
  for (const p of fx) gx.rect(p.x, p.y, 1, 1, p.c);

  if (has('wet')) for (let k = 0; k < 40; k++) {
    const x = (hash(k, 5) * W + time * 50) % W, y = MAIN_Y + (hash(k, 6) * MAIN_H + time * 180 + k * 17) % MAIN_H;
    gx.line(x, y, x - 1, y + 4, 'rgba(170,190,200,0.6)');
  }
  if (nightMask) ctx.drawImage(nightMask, 0, MAIN_Y);
  ctx.restore();

  drawMainHud();
}

function drawAimGuide() {
  const a = computeAim(aim);
  // goma de l'arrossegament
  gx.line(aim.sx, aim.sy, aim.cx, aim.cy, 'rgba(239,233,216,0.35)', 2);
  gx.disc(aim.sx, aim.sy, 2, 'rgba(239,233,216,0.5)');
  if (!a) return;
  if (a.invalid) { drawText(ctx, 'APUNTA CAP A LES BITLLES', W / 2, MAIN_Y + 6, C.redL, { align: 'center', shadow: C.dark }); return; }
  const amp = swayAmp(a.power, a.spin);
  const tx = a.tx + sway(time, amp);
  const ang = tx * 0.05;
  const col = a.power > 0.82 ? C.redL : C.white;
  let prev = null;
  for (let k = 0; k <= 30; k++) {
    const y = -1.3 + k * 0.065;
    const x = tx + Math.tan(ang) * y;
    const [sx, sy] = iso(x, y, 0.01);
    if ((k + Math.floor(time * 12)) % 3 !== 0) { gx.rect(sx, sy, 2, 1, col); }
    prev = [sx, sy];
  }
  // marca d'objectiu a la primera filera
  const [mx, my] = iso(tx, -PIN_R, 0);
  gx.rect(mx - 3, my, 7, 1, col); gx.rect(mx, my - 2, 1, 5, col);
  // rang d'oscil·lació
  const [l1, l2] = iso(a.tx - amp * 1.55, -0.25); const [r1, r2] = iso(a.tx + amp * 1.55, -0.25);
  gx.line(l1, l2, r1, r2, 'rgba(200,72,58,0.8)');
}

function drawMainHud() {
  // vent
  if (tir && tir.wind) {
    const w = tir.wind;
    gx.rect(3, MAIN_Y + 3, 70, 11, 'rgba(16,13,12,0.7)');
    drawText(ctx, 'VENT', 5, MAIN_Y + 5, C.paper2);
    const ay = MAIN_Y + 8;
    const len = Math.round(Math.abs(w) * 4) + 3;
    const d = w > 0 ? 1 : -1;
    const x0 = 46 - Math.floor(len / 2), x1 = x0 + len;
    gx.rect(x0, ay, len, 1, C.gold);
    const tip = d > 0 ? x1 : x0;
    gx.px(tip - d, ay - 1, C.gold); gx.px(tip - d, ay + 1, C.gold); gx.px(tip - 2 * d, ay - 2, C.gold); gx.px(tip - 2 * d, ay + 2, C.gold);
    drawText(ctx, Math.abs(w).toFixed(1), 70, MAIN_Y + 5, C.gold, { align: 'right' });
  }
  // força i gir
  if (phase === 'aim' && aim) {
    const a = computeAim(aim);
    if (a && !a.invalid) {
      const y = DESK_Y - 16;
      gx.rect(3, y - 2, 82, 15, 'rgba(16,13,12,0.75)');
      drawText(ctx, 'FORÇA', 5, y, C.paper2);
      gx.rect(38, y + 1, 44, 5, C.dark);
      gx.rect(38, y + 1, Math.round(44 * a.power), 5, a.power > 0.82 ? C.redL : C.gold);
      gx.rect(38 + Math.round(44 * 0.82), y, 1, 7, C.paper2);
      if (has('spin')) {
        gx.rect(W - 60, y - 2, 57, 15, 'rgba(16,13,12,0.75)');
        drawText(ctx, `GIR ${Math.abs(a.spin).toFixed(1)}`, W - 56, y, Math.abs(a.spin) > 0.25 ? C.gold : C.paper2);
        const cxs = W - 12, cys = y + 3, ra = time * (2 + Math.abs(a.spin) * 8) * Math.sign(a.spin || 1);
        gx.line(cxs - Math.cos(ra) * 5, cys - Math.sin(ra) * 2, cxs + Math.cos(ra) * 5, cys + Math.sin(ra) * 2, C.bitL);
      }
    }
  }
  // fantasma tutorial
  if (mode === 'play' && phase === 'aim' && !aim && !modal && !inspecting && tir && tir.idx === 0 && tir.throwIdx === 0 && (day.n === 1 || (day.n === 2 && !game.seenTut.spinDone))) {
    const t = (ghostT % 2.4) / 2.4;
    const sx = 40, sy = MAIN_Y + 168;
    let hx, hy;
    if (day.n === 2 && t < 0.5) { const a = t / 0.5 * Math.PI * 4; hx = sx + Math.cos(a) * 8; hy = sy + Math.sin(a) * 8; }
    else { const k = day.n === 2 ? (t - 0.5) / 0.5 : t; hx = sx + k * 70; hy = sy - k * 35; }
    drawHand(hx, hy);
    drawText(ctx, day.n === 2 ? 'CERCLES = GIR' : 'ARROSSEGA I DEIXA ANAR', W / 2, DESK_Y - 12, C.white, { align: 'center', shadow: C.dark });
  }
  // inspecció
  if (inspecting) {
    gx.rect(0, MAIN_Y, W, 11, 'rgba(110,31,27,0.85)');
    drawText(ctx, 'INSPECCIÓ · TOCA UNA BITLLA', W / 2, MAIN_Y + 2, C.paper, { align: 'center' });
    if (selPin) button(W / 2 - 40, DESK_Y - 22, 80, 16, `RECLAMAR Nº${selPin}`, claim, { bg: C.red, fg: C.paper, border: C.redD });
  }
  // textos flotants
  for (const f of floats) {
    const y = f.y - f.t * 14;
    if (f.t < 1.4 || Math.floor(f.t * 20) % 2) drawText(ctx, f.text, f.x, y, f.c, { align: 'center', shadow: C.dark });
  }
  if (stampFx) drawStamp();
  if (phase === 'dayend') drawDayEnd();
}

function drawHand(x, y) {
  gx.rect(x - 2, y, 5, 7, C.white); gx.rect(x - 1, y - 5, 2, 6, C.white); gx.box(x - 3, y - 1, 7, 9, C.ink);
  gx.rect(x - 1, y - 6, 2, 1, C.ink);
}

const stampCache = new Map();
function stampCanvas(text, color, scale = 2, pad = 7) {
  const key = text + color + scale + pad;
  if (stampCache.has(key)) return stampCache.get(key);
  const tw = textWidth(text, scale);
  const c = document.createElement('canvas'); c.width = tw + pad * 2; c.height = 7 * scale + pad * 2;
  const g = c.getContext('2d'); const G2 = new Gfx(g);
  G2.box(0, 0, c.width, c.height, color); G2.box(1, 1, c.width - 2, c.height - 2, color);
  if (pad > 4) G2.box(3, 3, c.width - 6, c.height - 6, color);
  drawText(g, text, pad, pad, color, { scale });
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < c.width * c.height * 0.12; i++) g.fillRect(Math.floor(rand() * c.width), Math.floor(rand() * c.height), 1, 1);
  stampCache.set(key, c);
  return c;
}

function drawStamp() {
  const s = stampFx;
  const c = stampCanvas(s.text, s.color === C.ink ? C.paper : (s.color === C.ink2 ? C.paper2 : s.color), 2);
  const t = s.t;
  const x = Math.round(W / 2 - c.width / 2), y = MAIN_Y + 50;
  if (t < 0.08) return;
  if (s.color === C.red || s.color === C.goldD) { gx.rect(x - 3, y - 3, c.width + 6, c.height + 6, 'rgba(16,13,12,0.6)'); }
  else gx.rect(x - 3, y - 3, c.width + 6, c.height + 6, 'rgba(16,13,12,0.6)');
  ctx.drawImage(c, x, y);
  drawText(ctx, `${s.pts} PUNTS`, W / 2, y + c.height + 6, C.paper, { align: 'center', shadow: C.dark });
}

function drawDayEnd() {
  const ok = day.quotaOk;
  const c = stampCanvas(ok ? 'CONFORME' : 'NO CONFORME', ok ? C.green : C.red, 2);
  gx.rect(0, MAIN_Y + 40, W, 70, 'rgba(16,13,12,0.75)');
  drawText(ctx, `PUNTS DE LA JORNADA: ${day.final}`, W / 2, MAIN_Y + 48, C.paper, { align: 'center' });
  drawText(ctx, `MÍNIM FEDERATIU: ${day.cfg.quota}`, W / 2, MAIN_Y + 60, C.paper2, { align: 'center' });
  if (phaseT > 0.5) ctx.drawImage(c, Math.round(W / 2 - c.width / 2), MAIN_Y + 74);
}

function claim() {
  const id = selPin;
  if (tir.irregular && tir.irregular.id === id) {
    tir.claimed = true;
    const p = sim.pins[id - 1]; p.x = p.hx; p.y = p.hy; p.noRing = false;
    day.claimBonus += 1;
    queueMsg('inspector', 'RECLAMACIÓ ACCEPTADA', `LA BITLLA Nº${id} ERA IRREGULAR. EL PLANTADOR L'HA CORREGIDA. LA FEDERACIÓ ET GRATIFICA AMB 1 PTA.`);
    sfx.stamp();
    tir.irregular = null;
  } else {
    game.warnings++;
    const pen = game.warnings >= 2;
    if (pen) day.warnPts += 2;
    queueMsg('inspector', 'AMONESTACIÓ', `RECLAMACIÓ FALSA: LA BITLLA Nº${id} COMPLEIX EL REGLAMENT. ${pen ? 'ES RESTEN 2 PUNTS DE LA JORNADA.' : 'PRIMERA AMONESTACIÓ: AVÍS.'}`);
    sfx.buzz();
  }
  inspecting = false; selPin = null;
}

// ───────────────────────── Dibuix: escriptori ─────────────────────────
function drawDesk() {
  // fusta
  for (let j = DESK_Y; j < H; j++) {
    const band = Math.floor((j - DESK_Y) / 6) % 3;
    gx.rect(0, j, W, 1, band === 0 ? C.wood : band === 1 ? C.woodL : C.wood);
  }
  for (let k = 0; k < 60; k++) gx.rect(hash(k, 11) * W, DESK_Y + hash(k, 12) * (H - DESK_Y), 6 + hash(k, 13) * 14, 1, C.woodD);
  gx.rect(0, DESK_Y, W, 3, C.woodDD);
  gx.rect(0, DESK_Y + 3, W, 1, C.woodL);
  drawActa(4, DESK_Y + 8, 118, Math.min(H - DESK_Y - 12, 126));
  drawSide(126, DESK_Y + 8);
}

function paper(x, y, w, h) {
  gx.rect(x + 2, y + 2, w, h, 'rgba(10,6,4,0.5)');
  gx.rect(x, y, w, h, C.paper);
  for (let k = 0; k < (w * h) / 40; k++) gx.px(x + hash(k, x) * w, y + hash(k, y + 1) * h, C.paper2);
  gx.box(x, y, w, h, C.paperSh);
}

function drawActa(x, y, w, h) {
  paper(x, y, w, h);
  drawText(ctx, `ACTA · JORNADA ${day.n}`, x + 4, y + 4, C.ink);
  gx.rect(x + 3, y + 13, w - 6, 1, C.ink2);
  for (let i = 0; i < 3; i++) {
    const r = day.rows[i];
    const ry = y + 17 + i * 21;
    const cur = tir && tir.idx === i && mode === 'play';
    if (cur) gx.rect(x + 2, ry - 1, w - 4, 19, 'rgba(217,169,52,0.25)');
    drawText(ctx, `T${i + 1}`, x + 4, ry + 4, C.ink);
    for (let k = 0; k < 3; k++) {
      const bx = x + 18 + k * 13;
      gx.box(bx, ry, 12, 15, C.ink2);
      const v = r.throws[k];
      if (v !== undefined) drawText(ctx, String(v), bx + 6, ry + 4, C.ink, { align: 'center' });
      else if (r.pts !== null) { gx.line(bx + 2, ry + 12, bx + 9, ry + 2, C.ink2); }
    }
    if (r.pts !== null) {
      if (r.tag && (r.pts >= 10 || r.tag === 'NUL·LA' || r.tag === 'LLENYA')) {
        const short = r.pts === 15 ? "D'OR" : r.tag.replace('!', '');
        const c = stampCanvas(short, r.color === C.ink ? C.ink2 : r.color, 1, 3);
        ctx.drawImage(c, x + 58, ry + 2);
      }
      drawText(ctx, String(r.pts), x + w - 4, ry + 4, r.pts >= 10 ? C.red : C.ink, { align: 'right' });
    }
  }
  const fy = y + 82;
  gx.rect(x + 3, fy - 2, w - 6, 1, C.ink2);
  const ptsNow = day.pts - day.warnPts;
  drawText(ctx, `PUNTS ${ptsNow}`, x + 4, fy + 2, C.ink);
  drawText(ctx, `MÍNIM ${day.cfg.quota}`, x + w - 4, fy + 2, ptsNow >= day.cfg.quota ? C.green : C.red, { align: 'right' });
  const bw = w - 8;
  gx.rect(x + 4, fy + 13, bw, 4, C.paper2);
  gx.rect(x + 4, fy + 13, Math.round(bw * Math.min(1, ptsNow / day.cfg.quota)), 4, ptsNow >= day.cfg.quota ? C.green : C.goldD);
  if (h > 112) {
    drawText(ctx, `LLIGA ${game.totalPoints + (mode === 'play' && phase !== 'dayend' ? ptsNow : 0)} PTS`, x + 4, fy + 22, C.ink2);
  }
}

function drawSide(x, y) {
  const w = 86;
  // encàrrec
  const o = tir && tir.order;
  if (o) {
    btns.push({ x, y, w, h: 50, fn: () => { modal = { type: 'order', view: true }; sfx.paper(); } });
    paper(x, y, w, 50);
    drawPortrait(x + 3, y + 3, PEOPLE[o.who], 0.5);
    drawText(ctx, 'ENCÀRREC', x + 26, y + 4, C.ink);
    const short = { deixa: `DEIXA LA Nº${o.pin}`, bitlla: 'FES BITLLA', minim: 'TOMBA-NE 4+', llenya: 'FES LLENYA', nobitlla: 'NO FACIS BITLLA', zero: 'NO EN TOMBIS CAP' }[o.kind];
    const ls = wrap(short, 58);
    ls.slice(0, 2).forEach((l, i) => drawText(ctx, l, x + 26, y + 15 + i * 9, C.ink2));
    drawText(ctx, `+${o.pay} PTES`, x + 26, y + 36, C.green);
    if (o.status !== 'pending') {
      const c = stampCanvas(o.status === 'accepted' ? 'ACCEPTAT' : 'REFUSAT', o.status === 'accepted' ? C.green : C.red, 1);
      ctx.drawImage(c, x + w - c.width - 2, y + 30);
    } else if (Math.floor(time * 3) % 2) gx.box(x - 1, y - 1, w + 2, 52, C.gold);
    if (o.result) drawText(ctx, o.result === 'ok' ? 'COMPLERT' : 'FALLAT', x + 26, y + 44 - 8, o.result === 'ok' ? C.green : C.red);
  } else {
    gx.rect(x, y, w, 50, 'rgba(16,13,12,0.25)');
    drawText(ctx, 'SENSE', x + w / 2, y + 16, C.woodD, { align: 'center' });
    drawText(ctx, 'ENCÀRRECS', x + w / 2, y + 26, C.woodD, { align: 'center' });
  }
  // cartera
  const wy = y + 56;
  drawText(ctx, `ESTALVIS ${game.money}`, x, wy, C.paper);
  if (has('orders') || game.sospita > 0) {
    drawText(ctx, 'SOSPITA', x, wy + 11, C.paper2);
    for (let k = 0; k < 5; k++) {
      const filled = k < game.sospita;
      gx.rect(x + 48 + k * 7, wy + 11, 5, 7, filled ? C.redL : C.woodD);
    }
  }
  if (game.streak >= 1) drawText(ctx, `RATXA ${game.streak}`, x, wy + 22, C.gold);
  // botons
  const by = H - 26;
  const bsz = 26;
  button(x, by, bsz, 22, '', () => { modal = { type: 'regl', page: 0 }; sfx.paper(); }, { icon: iconBook, bg: C.paper2 });
  const canInspect = has('inspect') && phase === 'aim' && tir && tir.throwIdx === 0 && !tir.claimed;
  if (has('inspect')) button(x + 30, by, bsz, 22, '', () => { inspecting = !inspecting; selPin = null; }, { icon: iconLens, bg: inspecting ? C.redL : C.paper2, disabled: !canInspect && !inspecting });
  button(x + 60, by, bsz, 22, '', () => toggleMute(), { icon: iconSpeaker, bg: C.paper2 });
}

function iconBook(x, y, w, h) {
  gx.rect(x + 7, y + 4, 12, 13, C.redD); gx.rect(x + 8, y + 5, 10, 11, C.red);
  gx.rect(x + 9, y + 15, 10, 2, C.paper); gx.rect(x + 10, y + 8, 6, 1, C.gold);
}
function iconLens(x, y, w, h) {
  gx.disc(x + 11, y + 9, 5, C.ink); gx.disc(x + 11, y + 9, 3, C.blueL); gx.px(x + 10, y + 8, C.white);
  gx.line(x + 15, y + 13, x + 19, y + 17, C.ink); gx.line(x + 16, y + 13, x + 20, y + 17, C.ink);
}
function iconSpeaker(x, y, w, h) {
  gx.rect(x + 7, y + 8, 3, 5, C.ink); gx.rect(x + 10, y + 6, 2, 9, C.ink); gx.rect(x + 12, y + 4, 1, 13, C.ink);
  if (!muted) { gx.rect(x + 15, y + 8, 1, 5, C.ink); gx.rect(x + 17, y + 6, 1, 9, C.ink); }
  else { gx.line(x + 15, y + 7, x + 20, y + 13, C.red); gx.line(x + 20, y + 7, x + 15, y + 13, C.red); }
}

// ───────────────────────── Retrats ─────────────────────────
function drawPortrait(x, y, p, small) {
  const s = small ? 1 : 2;
  const R = (a, b, w, h, c) => gx.rect(x + a * s, y + b * s, w * s, h * s, c);
  R(0, 0, 20, 22, '#6d7268'); R(0, 0, 20, 1, '#5a5f56');
  // cos
  R(2, 17, 16, 5, p.coat);
  if (p.tie) { R(9, 17, 2, 5, C.red); R(8, 17, 1, 2, C.white); R(11, 17, 1, 2, C.white); }
  if (p.priest) { R(9, 17, 2, 2, C.white); }
  if (p.apron) { R(6, 18, 8, 4, C.white); }
  // coll
  R(8, 15, 4, 3, p.skin);
  // cara
  R(5, 5, 10, 11, p.skin); R(6, 16, 8, 1, p.skin);
  R(5, 13, 10, 3, shade(p.skin));
  // cabells
  if (p.style === 'bald') { R(4, 7, 2, 4, p.hair); R(14, 7, 2, 4, p.hair); }
  else if (p.style === 'short') { R(5, 3, 10, 3, p.hair); R(4, 4, 2, 5, p.hair); R(14, 4, 2, 5, p.hair); }
  else if (p.style === 'slick') { R(4, 3, 12, 3, p.hair); R(4, 5, 2, 4, p.hair); R(5, 2, 9, 1, p.hair); }
  else if (p.style === 'bun') { R(4, 3, 12, 3, p.hair); R(3, 4, 2, 9, p.hair); R(15, 4, 2, 9, p.hair); R(7, 0, 6, 3, p.hair); }
  else if (p.style === 'long') { R(4, 3, 12, 3, p.hair); R(3, 4, 3, 13, p.hair); R(14, 4, 3, 13, p.hair); }
  if (p.hat === 'beret') { R(3, 2, 14, 3, '#1f1c1c'); R(9, 1, 2, 1, '#1f1c1c'); }
  if (p.hat === 'fedora') { R(2, 4, 16, 1, '#2a2826'); R(5, 0, 10, 4, '#2a2826'); R(5, 3, 10, 1, '#5a3a22'); }
  // ulls
  R(7, 9, 2, 1, C.ink); R(11, 9, 2, 1, C.ink);
  if (p.glasses) { gx.box(x + 6 * s, y + 8 * s, 4 * s, 3 * s, C.greyD); gx.box(x + 10 * s, y + 8 * s, 4 * s, 3 * s, C.greyD); }
  // nas i boca
  R(10, 10, 1, 2, shade(p.skin));
  if (p.moust) R(7, 12, 6, 1, p.hair === '#d8d4c8' ? '#a8a49a' : p.hair);
  if (p.beard) { R(5, 12, 10, 4, p.hair); R(8, 13, 4, 1, shade(p.skin)); }
  R(8, 14, 4, 1, p.lips ? C.red : shade(shade(p.skin)));
}
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) * 0.8, g = ((n >> 8) & 255) * 0.78, b = (n & 255) * 0.78;
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

// ───────────────────────── Modals ─────────────────────────
function drawModal() {
  if (!modal) return;
  gx.rect(0, 0, W, H, 'rgba(10,8,7,0.6)');
  if (modal.type === 'order') drawOrderDoc();
  else if (modal.type === 'regl') drawRegl();
  else if (modal.type === 'msg') drawMsg();
  else if (modal.type === 'tut') drawTut();
}

function drawOrderDoc() {
  const o = tir.order;
  const nl = wrap(o.body, 184 - 16).length;
  const w = 184, h = 80 + nl * 10 + 4 + (o.kind === 'deixa' ? 52 : 0) + 11 + (o.sus ? 11 : 0) + 40;
  const x = (W - w) / 2, y = Math.max(8, Math.floor((H - h) / 2) - 10);
  paper(x, y, w, h);
  drawText(ctx, 'ENCÀRREC', x + 8, y + 7, C.ink, { scale: 2 });
  drawText(ctx, `TIRADA ${tir.idx + 1}`, x + w - 8, y + 11, C.ink2, { align: 'right' });
  gx.rect(x + 6, y + 24, w - 12, 1, C.ink);
  const P = PEOPLE[o.who];
  drawPortrait(x + 8, y + 30, P, false);
  drawText(ctx, 'DE PART DE:', x + 54, y + 32, C.ink2);
  wrap(P.name, w - 62).forEach((l, i) => drawText(ctx, l, x + 54, y + 43 + i * 10, C.ink));
  const lines = wrap(o.body, w - 16);
  lines.forEach((l, i) => drawText(ctx, l, x + 8, y + 80 + i * 10, C.ink));
  let ly = y + 80 + lines.length * 10 + 4;
  if (o.kind === 'deixa') { drawPlantilla(x + w / 2 - 32, ly, o.pin); ly += 52; }
  drawText(ctx, `PAGA: ${o.pay} PTES`, x + 8, ly, C.green);
  drawText(ctx, `PENYORA: ${o.pen}`, x + w - 8, ly, C.red, { align: 'right' });
  ly += 11;
  if (o.sus) { drawText(ctx, `IL·LEGAL · SOSPITA +${o.sus}`, x + 8, ly, C.red); }
  const by = y + h - 30;
  if (o.status === 'pending') {
    button(x + 8, by, 80, 22, 'ACCEPTAR', () => decideOrder(true), { bg: C.greenL, border: C.greenD });
    button(x + w - 88, by, 80, 22, 'REFUSAR', () => decideOrder(false), { bg: C.redL, border: C.redD });
  } else {
    const c = stampCanvas(o.status === 'accepted' ? 'ACCEPTAT' : 'REFUSAT', o.status === 'accepted' ? C.green : C.red, 2);
    ctx.drawImage(c, x + w / 2 - c.width / 2, by - 8);
    if (modal.view || (modal.closeT && time > modal.closeT)) {
      btns.push({ x: 0, y: 0, w: W, h: H, fn: () => { modal = null; } });
    }
  }
}

function decideOrder(acc) {
  const o = tir.order;
  o.status = acc ? 'accepted' : 'refused';
  sfx.stamp(); shake = 0.2; vibrate(25);
  if (acc) { game.orders++; if (o.sus) { game.sospita += o.sus; day.illegal = true; } }
  modal.closeT = time + 0.6;
  setTimeout(() => { if (modal && modal.type === 'order') modal = null; }, 650);
}

function drawPlantilla(x, y, mark) {
  // x,y = cantonada superior esquerra; mida 64x46
  gx.box(x, y, 64, 34, C.ink2);
  for (let i = 0; i < 6; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const cx = x + 13 + col * 19, cy = y + 24 - row * 15;
    const on = i + 1 === mark;
    gx.disc(cx, cy, 6, on ? C.blue : C.ink2);
    gx.disc(cx, cy, 5, on ? C.blueL : C.paper2);
    drawText(ctx, String(i + 1), cx + 1, cy - 3, on ? C.white : C.ink, { align: 'center' });
  }
  gx.rect(x + 31, y + 36, 3, 1, C.ink2); gx.rect(x + 32, y + 37, 1, 1, C.ink2);
  drawText(ctx, 'TIRADOR', x + 32, y + 40, C.ink2, { align: 'center' });
}

function reglPages() {
  const pages = [...REGLAMENT];
  if (day) for (const f of day.cfg.feats) if (RULE_PAGES[f]) pages.push(RULE_PAGES[f]);
  return pages;
}

function drawRegl() {
  const pages = reglPages();
  const pg = pages[modal.page];
  const w = 196, h = Math.min(H - 20, 300), x = (W - w) / 2, y = (H - h) / 2;
  gx.rect(x - 3, y - 3, w + 6, h + 6, C.redD);
  paper(x, y, w, h);
  drawText(ctx, 'REGLAMENT', x + 6, y + 6, C.red);
  drawText(ctx, `${modal.page + 1}/${pages.length}`, x + w - 6, y + 6, C.ink2, { align: 'right' });
  drawText(ctx, pg.t, x + 6, y + 20, C.ink, { scale: 2 });
  gx.rect(x + 6, y + 36, w - 12, 1, C.ink);
  let ly = y + 42;
  for (const l of pg.lines) {
    for (const s of wrap(l, w - 14)) { drawText(ctx, s, x + 7, ly, C.ink); ly += 10; }
    ly += 2;
  }
  if (pg.diagram === 'pin' && ly < y + h - 96) drawPlantilla(x + w / 2 - 32, ly + 4, 0);
  drawText(ctx, 'FONT: REGLAMENT DE JOC FCBB, 2010', x + w / 2, y + h - 40, C.paperSh, { align: 'center' });
  const by = y + h - 28;
  button(x + 6, by, 40, 20, '<', () => { modal.page = (modal.page + pages.length - 1) % pages.length; sfx.paper(); });
  button(x + w / 2 - 30, by, 60, 20, 'TANCAR', () => { modal = null; });
  button(x + w - 46, by, 40, 20, '>', () => { modal.page = (modal.page + 1) % pages.length; sfx.paper(); });
}

function drawMsg() {
  const m = modal;
  const w = 180, x = (W - w) / 2;
  const lines = wrap(m.text, w - 16);
  const h = 70 + lines.length * 10;
  const y = Math.floor(H / 2 - h / 2);
  paper(x, y, w, h);
  gx.rect(x, y, w, 4, C.red);
  if (m.who) drawPortrait(x + 6, y + 9, PEOPLE[m.who], true);
  drawText(ctx, m.title, x + 30, y + 14, C.red);
  lines.forEach((l, i) => drawText(ctx, l, x + 8, y + 36 + i * 10, C.ink));
  button(x + w / 2 - 30, y + h - 26, 60, 18, "D'ACORD", () => { modal = null; });
}

const TUTS = {
  aim: { t: 'PRIMERA JORNADA', lines: ['ARROSSEGA EL DIT CAP A LES BITLLES. LA LÍNIA DE PUNTS ÉS EL CAMÍ DEL BITLLOT.', 'MÉS LLARG = MÉS FORÇA. DEIXA ANAR PER LLANÇAR.', 'OBJECTIU: TOMBAR-NE 5 I DEIXAR-NE UNA DRETA. CINC FAN 10 PUNTS; SIS, NOMÉS 6!'] },
  spin: { t: 'GIR', lines: ['FES CERCLES AMB EL DIT ABANS DE LLANÇAR: EL BITLLOT GIRARÀ I ESCOMBRARÀ MÉS BITLLES.', 'COMPTE: AMB GIR EL POLS TREMOLA MÉS.', 'AVUI TAMBÉ ARRIBEN ENCÀRRECS DELS VEÏNS.'] },
  wind: { t: 'TRAMUNTANA', lines: ['MIRA LA BANDERA I EL MARCADOR DE VENT. EL BITLLOT ES DESVIA FINS A 10 CM.'] },
  seal: { t: "BITLLA D'OR", lines: ['LA BITLLA AMB EL CAP VERMELL ÉS LA SEGELLADA.', "FES BITLLA DEIXANT-LA DRETA: 15 PUNTS."] },
  inspect: { t: 'INSPECCIÓ', lines: ['ABANS DEL PRIMER BITLLOT, TOCA LA LUPA DE L\'ESCRIPTORI.', 'SI UNA BITLLA ÉS FORA DEL SEU CERCLE O NO TÉ ANELLA DE FERRO, TOCA-LA I RECLAMA.', 'NO TOTES LES PLANTADES SÓN IRREGULARS. RECLAMAR SENSE MOTIU: AMONESTACIÓ.'] },
};

function drawTut() {
  const T = TUTS[modal.key];
  const w = 188, x = (W - w) / 2;
  const lines = T.lines.flatMap(l => [...wrap(l, w - 16), '']);
  const h = 48 + lines.length * 10;
  const y = Math.floor(H / 2 - h / 2);
  paper(x, y, w, h);
  gx.rect(x, y, w, 16, C.ink);
  drawText(ctx, T.t, x + 6, y + 4, C.paper);
  lines.forEach((l, i) => drawText(ctx, l, x + 8, y + 22 + i * 10, C.ink));
  button(x + w / 2 - 30, y + h - 24, 60, 18, 'ENTESOS', () => { modal = null; });
}

// ───────────────────────── Pantalles ─────────────────────────
function drawTitle() {
  gx.rect(0, 0, W, H, C.bg);
  for (let j = 0; j < H; j += 2) gx.rect(0, j, W, 1, 'rgba(255,255,255,0.015)');
  const cy = Math.floor(H * 0.5) - 90;
  // emblema
  gx.disc(W / 2, cy, 50, C.redD); gx.disc(W / 2, cy, 47, C.red); gx.disc(W / 2, cy, 44, C.redD);
  const pins = standardLayout();
  const ox = W / 2 - 4, oy = cy + 22;
  for (const p of [...pins].sort((a, b) => (a.hx - a.hy) - (b.hx - b.hy))) {
    const sx = ox + (p.hx + p.hy) * 118 * 0.8, sy = oy + (p.hx - p.hy) * 118 * 0.4;
    const saved = gx; renderPinBody({ ...p, a: 0, dx: 0, dy: 1, sealed: p.id === 5 }, sx, sy, false); gx = saved;
  }
  drawText(ctx, 'BITLLES', W / 2 + 2, cy + 60, C.redD, { align: 'center', scale: 4 });
  drawText(ctx, 'BITLLES', W / 2, cy + 58, C.paper, { align: 'center', scale: 4 });
  drawText(ctx, 'LLIGA COMARCAL · 1979', W / 2, cy + 92, C.gold, { align: 'center' });
  drawText(ctx, 'CINC SÓN DEU. SIS SÓN SIS.', W / 2, cy + 104, C.paper2, { align: 'center' });
  let by = cy + 122;
  button(W / 2 - 60, by, 120, 22, 'NOVA PARTIDA', () => { newGame(); });
  by += 28;
  if (saved) {
    button(W / 2 - 60, by, 120, 22, `CONTINUAR · J${saved.day}`, () => { game = saved; game.seenTut = game.seenTut || {}; startDay(); });
    by += 28;
  }
  if (best.day > 1) drawText(ctx, `RÈCORD: JORNADA ${best.day} · ${best.points} PUNTS`, W / 2, by + 4, C.paper2, { align: 'center' });
  drawText(ctx, 'BASAT EN EL REGLAMENT OFICIAL', W / 2, H - 22, C.greyD, { align: 'center' });
  drawText(ctx, 'DE BITLLES CATALANES', W / 2, H - 12, C.greyD, { align: 'center' });
}

function drawNews() {
  gx.rect(0, 0, W, H, C.bg);
  const x = 6, y = 6, w = W - 12, h = H - 12;
  paper(x, y, w, h);
  drawText(ctx, 'LA VEU DE LA PISTA', W / 2, y + 8, C.ink, { align: 'center', scale: 2 });
  gx.rect(x + 6, y + 26, w - 12, 1, C.ink); gx.rect(x + 6, y + 28, w - 12, 1, C.ink);
  drawText(ctx, day.cfg.date, W / 2, y + 32, C.ink2, { align: 'center' });
  gx.rect(x + 6, y + 42, w - 12, 1, C.ink);
  let ly = y + 50;
  for (const l of wrap(day.cfg.head, w - 16, 2)) { drawText(ctx, l, W / 2, ly, C.ink, { align: 'center', scale: 2 }); ly += 18; }
  ly += 2;
  // il·lustració
  const ih = 60;
  gx.rect(x + 10, ly, w - 20, ih, C.paper2);
  gx.box(x + 10, ly, w - 20, ih, C.ink);
  drawNewsPic(x + 10, ly, w - 20, ih, day.cfg);
  ly += ih + 8;
  for (const l of wrap(day.cfg.body, w - 16)) { drawText(ctx, l, x + 8, ly, C.ink); ly += 10; }
  ly += 6;
  if (day.cfg.rule) {
    const rl = wrap(day.cfg.rule, w - 24);
    gx.box(x + 6, ly, w - 12, rl.length * 10 + 18, C.red);
    drawText(ctx, 'NOVETAT AL REGLAMENT', x + 10, ly + 4, C.red);
    rl.forEach((l, i) => drawText(ctx, l, x + 10, ly + 15 + i * 10, C.ink));
    ly += rl.length * 10 + 24;
  }
  drawText(ctx, `MÍNIM FEDERATIU: ${day.cfg.quota} PUNTS`, W / 2, Math.min(ly + 2, H - 40), C.ink, { align: 'center' });
  if (Math.floor(time * 2) % 2) drawText(ctx, 'TOCA PER COMENÇAR', W / 2, H - 22, C.red, { align: 'center' });
}

function drawNewsPic(x, y, w, h, cfg) {
  ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, w - 2, h - 2); ctx.clip();
  // gravat en dos tons
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i += 1) {
    const sky = j < h * 0.55;
    if (sky ? ((i + j) % 4 === 0) : ((i + j) % 2 === 0)) gx.px(x + i, y + j, C.paperSh);
  }
  const cx = x + w / 2, gy = y + h - 10;
  const pins = standardLayout();
  for (const p of [...pins].sort((a, b) => (a.hx - a.hy) - (b.hx - b.hy))) {
    const sx = cx + (p.hx + p.hy) * 70, sy = gy + (p.hx - p.hy) * 35;
    const sealed = cfg.feats.includes('seal') && p.id === 2;
    gx.rect(sx - 2, sy - 30, 5, 30, C.ink); gx.rect(sx - 1, sy - 29, 3, 28, sealed ? C.red : C.paper);
    gx.rect(sx - 1, sy - 4, 3, 3, C.ink2);
  }
  if (cfg.feats.includes('wind')) for (let k = 0; k < 6; k++) gx.line(x + 8 + k * 9, y + 8 + k * 3, x + 30 + k * 9, y + 8 + k * 3, C.ink);
  if (cfg.feats.includes('wet')) for (let k = 0; k < 40; k++) gx.line(x + hash(k, 1) * w, y + hash(k, 2) * h, x + hash(k, 1) * w - 2, y + hash(k, 2) * h + 5, C.ink2);
  if (cfg.feats.includes('night')) { gx.disc(x + w - 20, y + 14, 7, C.paper); gx.disc(x + w - 17, y + 12, 6, C.paperSh); }
  if (cfg.feats.includes('inspector') || cfg.feats.includes('inspect') && cfg.n === 5) drawPortrait(x + 6, y + 8, PEOPLE.inspector, false);
  else if (cfg.feats.includes('orders') && cfg.n === 2) drawPortrait(x + 6, y + 8, PEOPLE.pep, false);
  ctx.restore();
}

function drawLedger() {
  const L = ledger;
  gx.rect(0, 0, W, H, C.bg);
  drawText(ctx, `FI DE LA JORNADA ${day.n}`, W / 2, 10, C.paper, { align: 'center', scale: 2 });
  let y = 32;
  const row = (label, val, col = C.paper, fn = null, on = null) => {
    if (fn) {
      btns.push({ x: 8, y: y - 3, w: W - 16, h: 13, fn });
      gx.box(10, y - 1, 9, 9, C.paper2);
      if (on) { gx.rect(12, y + 1, 5, 5, C.gold); }
      drawText(ctx, label, 24, y, on ? col : C.greyD);
    } else drawText(ctx, label, 10, y, col);
    drawText(ctx, val, W - 10, y, fn && !on ? C.greyD : col, { align: 'right' });
    y += 13;
  };
  row('ESTALVIS', String(L.start));
  row(`PREMI (${day.final} PUNTS)`, `+${L.premi}`, C.greenL);
  if (L.orders) row('ENCÀRRECS I GRATIFICACIONS', `+${L.orders}`, C.greenL);
  if (L.streak) row('RATXA DE BITLLES', `+${L.streak}`, C.gold);
  if (L.fines) row('MULTES I PENYORES', `-${L.fines}`, C.redL);
  row('LLOGUER', `-${L.rent}`, C.redL);
  row('MENJAR', '-3', C.redL, () => { L.food = !L.food; }, L.food);
  row('LLENYA (CALEFACCIÓ)', '-2', C.redL, () => { L.heat = !L.heat; }, L.heat);
  if (game.family.some(f => f.here && f.sick)) row('MEDICINES', '-4', C.redL, () => { L.meds = !L.meds; }, L.meds);
  gx.rect(10, y - 2, W - 20, 1, C.paper2);
  y += 2;
  const tot = ledgerTotal(L);
  row('TOTAL', String(tot), tot < 0 ? C.redL : C.paper);
  y += 4;
  for (const l of L.lines) { for (const s of wrap(l, W - 20)) { drawText(ctx, s, 10, y, C.redL); y += 10; } }
  y += 4;
  drawText(ctx, 'FAMÍLIA', 10, y, C.paper2); y += 12;
  for (const f of game.family) {
    let st = 'BÉ', col = C.greenL;
    if (!f.here) { st = 'HA MARXAT'; col = C.greyD; }
    else if (f.sick) { st = 'MALALT'; col = C.redL; }
    else if (f.hunger && f.cold) { st = 'GANA I FRED'; col = C.gold; }
    else if (f.hunger) { st = 'GANA'; col = C.gold; }
    else if (f.cold) { st = 'FRED'; col = C.gold; }
    drawText(ctx, f.name, 10, y, f.here ? C.paper : C.greyD);
    drawText(ctx, st, W - 10, y, col, { align: 'right' });
    y += 11;
  }
  y += 4;
  drawText(ctx, `SOSPITA ${game.sospita}/5 · AMONESTACIONS ${game.warnings}`, 10, y, game.sospita >= 3 ? C.redL : C.paper2);
  y += 11;
  drawText(ctx, `LLIGA: ${game.totalPoints} PUNTS · ${game.bitlles} BITLLES`, 10, y, C.paper2);
  const base = L.start + L.premi + L.orders + L.streak - L.fines - L.rent;
  const by = H - 30;
  if (base < 0) button(20, by, W - 40, 22, 'NO POTS PAGAR EL LLOGUER', confirmLedger, { bg: C.redL });
  else button(20, by, W - 40, 22, tot < 0 ? 'NO HI HA PROU DINERS' : (day.cfg.final ? 'VEURE EL VEREDICTE' : 'SEGÜENT JORNADA'), confirmLedger, { disabled: tot < 0 });
}

function drawEnding() {
  gx.rect(0, 0, W, H, C.bg);
  const E = ending;
  const good = E.kind === 'campio' || E.kind === 'supervivent';
  const c = stampCanvas(E.t, good ? C.gold : C.redL, 2);
  ctx.drawImage(c, Math.round(W / 2 - c.width / 2), 40);
  let y = 84;
  for (const l of wrap(E.text, W - 24)) { drawText(ctx, l, W / 2, y, C.paper, { align: 'center' }); y += 11; }
  y += 14;
  const stats = [
    ['JORNADES', String(game.finalDone && E.canContinue ? game.day - 1 : game.day)],
    ['PUNTS DE LLIGA', String(game.totalPoints)],
    ['BITLLES', String(game.bitlles)],
    ['MILLOR RATXA', String(game.bestStreak)],
    ['ENCÀRRECS ACCEPTATS', String(game.orders)],
    ['ESTALVIS', `${game.money} PTES`],
  ];
  for (const [k, v] of stats) { drawText(ctx, k, 20, y, C.paper2); drawText(ctx, v, W - 20, y, C.paper, { align: 'right' }); y += 12; }
  let by = H - 60;
  if (E.canContinue) button(20, by, W - 40, 22, "LLIGA D'HIVERN (SEGUIR)", () => { startDay(); });
  button(20, H - 32, W - 40, 22, 'TORNAR AL TÍTOL', () => { mode = 'title'; });
}

// ───────────────────────── Dibuix principal ─────────────────────────
function draw() {
  btns = [];
  ctx.imageSmoothingEnabled = false;
  if (mode === 'title') drawTitle();
  else if (mode === 'news') drawNews();
  else if (mode === 'play') {
    gx.rect(0, 0, W, H, C.bg);
    drawStrip();
    drawMain();
    drawDesk();
    if (modal) { btns = []; drawModal(); }
  } else if (mode === 'ledger') drawLedger();
  else if (mode === 'ending') drawEnding();
}

resize();
requestAnimationFrame(frame);

// Ganxos per a proves automàtiques
window.__bitlles = {
  get state() { return { mode, phase, modal: modal && modal.type, day: day && day.n, tirada: tir && tir.idx, throwIdx: tir && tir.throwIdx, game }; },
  newGame, tap, startDay,
  closeModal() { if (!modal) return; if (modal.type === 'order' && tir.order.status === 'pending') decideOrder(true); else modal = null; },
  skipTo(n) { newGame(); game.day = n; startDay(); },
};
