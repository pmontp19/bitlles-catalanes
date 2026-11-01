import './style.css';
import { Field, initPhysics, launchFromInput, STEP, type ThrowInput } from './game/physics';
import { GameScene } from './game/scene';
import { SwipeInput } from './game/input';
import { cheer, knock, unlockAudio, vibrate } from './game/feedback';
import { LESSONS, type Lesson } from './game/tutorial';
import {
  ALL_BITLLOTS, BITLLOTS, newPartida, partidaScore, planFromSeed, pushResult, rondaOf, scoreTirada, shareText, tiradaOver,
  TOTAL_TIRADES, type BitllotKind, type DailyPlan, type Partida, type TiradaResult,
} from './game/rules';
import { THROW_DISTANCE, TIRADES_PER_RONDA } from './game/constants';

// ---------- DOM ----------
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('scene');
const stage = $('stage');
const overlay = $('overlay');
const hud = {
  root: $('hud'), score: $('score'), tirada: $('tirada'), pins: $('pins'), mult: $('mult'), wind: $('wind'), goal: $('goal'),
  rack: $('rack'), hint: $('hint'), toast: $('toast'), prot: $('prot'), ghost: $('ghost'), readout: $('readout'),
};

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* sense emmagatzematge */ } },
};

// ---------- Estat ----------
type Mode = 'tutorial' | 'partida' | 'daily';
type Phase = 'menu' | 'card' | 'aim' | 'flight' | 'result' | 'end';

let scene: GameScene;
let field: Field;
const swipe = new SwipeInput(stage);

const S = {
  mode: 'partida' as Mode,
  phase: 'menu' as Phase,
  lesson: 0,
  plan: planFromSeed(1) as DailyPlan,
  dailyDate: '',
  partida: newPartida() as Partida,
  tirada: 0,
  hand: ['alzina', 'boix', 'cinta'] as BitllotKind[],
  used: [] as number[],
  selected: 0,
  pubilla: null as number | null,
  startDown: [] as boolean[],
  inputs: [] as ThrowInput[],
  timeScale: 1,
  slowBudget: 0,
  acc: 0,
  t: 0,
  lastPinPos: [] as ({ x: number; y: number; z: number } | null)[],
  clubWasAir: false,
  ghost: null as Lesson['ghost'] | null,
};

const distanceFor = () => (S.mode === 'tutorial' ? LESSONS[S.lesson].distance : THROW_DISTANCE.infantil);

// ---------- Overlay (targetes) ----------
function card(html: string, buttons: { label: string; primary?: boolean; onClick: () => void }[]) {
  S.phase = S.phase === 'end' ? 'end' : 'card';
  swipe.enabled = false;
  overlay.innerHTML = `<div class="card">${html}<div class="actions"></div></div>`;
  const actions = overlay.querySelector('.actions')!;
  for (const b of buttons) {
    const el = document.createElement('button');
    el.textContent = b.label;
    el.className = b.primary ? 'primary' : '';
    el.addEventListener('click', () => { unlockAudio(); b.onClick(); });
    actions.appendChild(el);
  }
  overlay.hidden = false;
  (actions.querySelector('button.primary') as HTMLButtonElement | null)?.focus();
}
function closeCard() { overlay.hidden = true; overlay.innerHTML = ''; }

// ---------- Menú ----------
function menu() {
  S.phase = 'menu';
  hud.root.hidden = true;
  const done = store.get('tutorial-fet') === '1';
  const best = Number(store.get('millor') ?? 0);
  card(
    `<h1 class="logo">Bitlla!</h1>
     <p class="sub">Bitlles catalanes · prototip</p>
     <p class="small">Tomba'n cinc i deixa'n una dreta: val 10 punts. Totes sis, només 6.</p>
     ${best ? `<p class="small">Millor partida: <b>${best}</b> punts</p>` : ''}`,
    [
      { label: done ? 'Tutorial' : 'Comença pel tutorial', primary: !done, onClick: () => startTutorial(0) },
      { label: 'Partida ràpida', primary: done, onClick: () => startPartida('partida') },
      { label: 'Plantada del dia', onClick: () => void startDaily() },
    ],
  );
}

// ---------- Tutorial ----------
function startTutorial(i: number) {
  S.mode = 'tutorial';
  S.lesson = i;
  const L = LESSONS[i];
  if (!L) { store.set('tutorial-fet', '1'); return tutorialDone(); }
  const step = `<div class="step">Lliçó ${i + 1} de ${LESSONS.length}</div>`;
  if (L.explainOnly) {
    const art = L.explainOnly === 'tria' ? triaArt() : angleArt();
    return card(`${step}<h2>${L.title}</h2>${art}<p>${L.intro}</p>`, [
      { label: 'Continua', primary: true, onClick: () => startTutorial(i + 1) },
      { label: 'Surt', onClick: menu },
    ]);
  }
  card(`${step}<h2>${L.title}</h2><p>${L.intro}</p><p class="goal-line">Objectiu: ${L.goal}</p>`, [
    { label: 'Som-hi', primary: true, onClick: () => { closeCard(); setupLesson(L); } },
    { label: 'Salta el tutorial', onClick: () => { store.set('tutorial-fet', '1'); menu(); } },
  ]);
}

function setupLesson(L: Lesson) {
  S.hand = [...L.bitllots];
  S.used = [];
  S.selected = 0;
  S.inputs = [];
  S.pubilla = L.pubilla;
  S.ghost = L.ghost ?? null;
  plant(L.distance, L.present, 0);
  S.startDown = field.down();
  hud.goal.textContent = L.goal;
  hud.goal.hidden = false;
  hud.tirada.textContent = `Tutorial · ${L.title}`;
  hud.score.textContent = '–';
  toAim();
}

function lessonSettled() {
  const L = LESSONS[S.lesson];
  const down = field.down();
  const ok = L.check({ down, startDown: S.startDown, pubilla: S.pubilla, inputs: S.inputs });
  const outOfClubs = S.used.length >= S.hand.length || down.filter(Boolean).length >= 5;
  if (ok) {
    cheer(true);
    vibrate([20, 40, 20]);
    S.phase = 'result';
    setTimeout(() => card(`<h2>${L.success}</h2>`, [
      { label: S.lesson + 1 < LESSONS.length ? 'Següent lliçó' : 'Acaba', primary: true, onClick: () => startTutorial(S.lesson + 1) },
      { label: 'Repeteix', onClick: () => { closeCard(); setupLesson(L); } },
    ]), 700);
  } else if (outOfClubs) {
    S.phase = 'result';
    setTimeout(() => card(`<h2>Gairebé</h2><p>${L.fail}</p>`, [
      { label: 'Torna-hi', primary: true, onClick: () => { closeCard(); setupLesson(L); } },
      { label: 'Salta aquesta lliçó', onClick: () => startTutorial(S.lesson + 1) },
    ]), 700);
  } else {
    toAim();
  }
}

function tutorialDone() {
  card(`<h2>Ja estàs a punt</h2><p>Una partida són 9 tirades en 3 rondes, com a la competició. Si fas bitlla amb el primer o el segon bitllot, els que no llances multipliquen la tirada següent.</p>`, [
    { label: 'Juga una partida', primary: true, onClick: () => startPartida('partida') },
    { label: 'Menú', onClick: menu },
  ]);
}

// ---------- Partida i plantada del dia ----------
function startPartida(mode: 'partida' | 'daily', plan?: DailyPlan) {
  S.mode = mode;
  S.plan = plan ?? planFromSeed((Math.random() * 2 ** 31) | 0, 0);
  S.partida = newPartida();
  S.tirada = 0;
  S.ghost = null;
  hud.goal.hidden = true;
  chooseBench();
}

async function startDaily() {
  let date = new Date().toISOString().slice(0, 10);
  let seed = [...date].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  try {
    const r = await fetch('/api/daily');
    if (r.ok) { const j = (await r.json()) as { date: string; seed: number }; date = j.date; seed = j.seed; }
  } catch { /* sense xarxa: llavor local */ }
  S.dailyDate = date;
  startPartida('daily', planFromSeed(seed));
}

/** Tria 3 de 4: a l'inici de cada ronda, el jugador deixa un bitllot a la banqueta. */
function chooseBench() {
  const ronda = rondaOf(S.tirada) + 1;
  const items = ALL_BITLLOTS.map((k) => {
    const b = BITLLOTS[k];
    return `<button class="bitllot-pick" data-k="${k}"><i style="background:#${b.color.toString(16).padStart(6, '0')}"></i><b>${b.name}</b><span>${b.hint}</span></button>`;
  }).join('');
  card(`<div class="step">Ronda ${ronda} de 3</div><h2>Quin deixes a la banqueta?</h2><p class="small">Portes 4 bitllots i en llances 3.</p><div class="picks">${items}</div>`, []);
  overlay.querySelectorAll<HTMLButtonElement>('.bitllot-pick').forEach((b) => b.addEventListener('click', () => {
    unlockAudio();
    const bench = b.dataset.k as BitllotKind;
    S.hand = ALL_BITLLOTS.filter((k) => k !== bench);
    closeCard();
    startTirada();
  }));
}

function startTirada() {
  S.used = [];
  S.selected = 0;
  S.inputs = [];
  S.pubilla = S.plan.pubilles[S.tirada];
  plant(THROW_DISTANCE.infantil, [true, true, true, true, true, true], S.plan.wind[S.tirada]);
  S.startDown = field.down();
  hud.tirada.textContent = `Tirada ${S.tirada + 1}/${TOTAL_TIRADES} · Ronda ${rondaOf(S.tirada) + 1}`;
  hud.score.textContent = String(partidaScore(S.partida));
  toAim();
}

function tiradaSettled() {
  const down = field.down();
  if (!tiradaOver(down, S.used.length)) return toAim();
  const r = scoreTirada(down, S.pubilla, S.used.length, S.partida.nextMultiplier);
  S.partida = pushResult(S.partida, r);
  S.phase = 'result';
  showResult(r);
  hud.score.textContent = String(partidaScore(S.partida));
  setTimeout(() => {
    hud.toast.className = 'toast';
    S.tirada++;
    if (S.tirada >= TOTAL_TIRADES) return endPartida();
    if (S.tirada % TIRADES_PER_RONDA === 0) chooseBench();
    else startTirada();
  }, 2000);
}

function showResult(r: TiradaResult) {
  const big = r.label === 'bitlla' || r.label === 'bitlla d\'or';
  const title = r.label === 'bitlla d\'or' ? 'BITLLA D\'OR!' : r.label === 'bitlla' ? 'BITLLA!' : r.label === 'llenya' ? 'Llenya' : r.knocked === 0 ? 'Res' : `${r.knocked} ${r.knocked === 1 ? 'bitlla' : 'bitlles'}`;
  const extra = [
    `+${r.total}`,
    r.bitllaOr ? 'pubilla dreta ×2' : '',
    r.multiplier > 1 ? `×${r.multiplier} bitllots estalviats` : '',
    r.saved ? `${r.saved} estalviat${r.saved > 1 ? 's' : ''} → ×${1 + 0.5 * r.saved} a la següent` : '',
  ].filter(Boolean).join(' · ');
  hud.toast.innerHTML = `<b>${title}</b><small>${extra}</small>`;
  hud.toast.className = `toast show ${big ? 'big' : ''}`;
  if (big) { cheer(r.bitllaOr); vibrate([30, 60, 30, 60, 60]); }
}

function endPartida() {
  S.phase = 'end';
  const total = partidaScore(S.partida);
  const best = Number(store.get('millor') ?? 0);
  if (total > best) store.set('millor', String(total));
  const title = S.mode === 'daily' ? `Bitlla! ${S.dailyDate}` : 'Bitlla!';
  const text = shareText(S.partida, title);
  const bitlles = S.partida.results.filter((r) => r.knocked === 5).length;
  card(`<div class="step">${S.mode === 'daily' ? 'Plantada del dia' : 'Partida acabada'}</div><h2 class="total">${total} <small>punts</small></h2>
    <p class="small">${bitlles} bitlles de 9 tirades${total > best && best ? ' · nou rècord!' : ''}</p>
    <pre class="share" id="share-text">${text}</pre>`, [
    { label: 'Copia el resultat', primary: true, onClick: () => {
      navigator.clipboard?.writeText(text).then(() => { hud.hint.textContent = 'Copiat'; }).catch(() => {
        const sel = getSelection(); const r = document.createRange(); r.selectNodeContents($('share-text')); sel?.removeAllRanges(); sel?.addRange(r);
      });
    } },
    { label: 'Torna a jugar', onClick: () => (S.mode === 'daily' ? void startDaily() : startPartida('partida')) },
    { label: 'Menú', onClick: menu },
  ]);
}

// ---------- Tirada (comú) ----------
function plant(distance: number, present: boolean[], wind: number) {
  field?.free();
  field = new Field(distance);
  field.wind = wind;
  field.plant(present);
  scene.setDistance(distance);
  scene.plant(present);
  S.lastPinPos = field.pinStates().map((p) => (p ? { x: p.x, y: p.y, z: p.z } : null));
  scene.updateCamera('aim', undefined, 0, true);
  hud.root.hidden = false;
  hud.wind.hidden = Math.abs(wind) < 0.05;
  hud.wind.textContent = wind > 0 ? `Vent → ${(wind * 10).toFixed(0)}` : `← ${(-wind * 10).toFixed(0)} Vent`;
  renderPins();
}

function toAim() {
  S.phase = 'aim';
  swipe.enabled = true;
  const next = S.hand.findIndex((_, i) => !S.used.includes(i));
  if (S.used.includes(S.selected) || S.selected < 0) S.selected = next;
  hud.hint.textContent = 'Arrossega cap amunt i deixa anar';
  hud.hint.hidden = false;
  hud.readout.hidden = true;
  const m = S.mode === 'tutorial' ? 1 : S.partida.nextMultiplier;
  hud.mult.hidden = m <= 1;
  hud.mult.textContent = `×${m}`;
  renderRack();
  renderPins();
}

function renderRack() {
  hud.rack.innerHTML = '';
  S.hand.forEach((k, i) => {
    const b = BITLLOTS[k];
    const el = document.createElement('button');
    el.className = `club ${S.used.includes(i) ? 'used' : ''} ${i === S.selected ? 'sel' : ''}`;
    el.innerHTML = `<i style="background:#${b.color.toString(16).padStart(6, '0')}"></i><span>${b.name}</span>`;
    el.disabled = S.used.includes(i) || S.phase !== 'aim';
    el.addEventListener('click', (e) => { e.stopPropagation(); S.selected = i; renderRack(); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    hud.rack.appendChild(el);
  });
}

function renderPins() {
  const down = field.down();
  hud.pins.innerHTML = down.map((d, i) => `<i class="${d ? 'down' : ''} ${i === S.pubilla ? 'pub' : ''}"></i>`).join('');
}

swipe.onMove = (g) => {
  if (S.phase !== 'aim') return;
  const spec = BITLLOTS[S.hand[S.selected]];
  const l = launchFromInput(g, field.distance, spec);
  scene.showAim(g.valid ? l.landing : null, l.position);
  hud.hint.hidden = true;
  S.ghost = null;
  hud.ghost.hidden = true;
  hud.readout.hidden = !g.valid;
  const eff = g.spin === 0 ? 'sense efecte' : g.spin > 0 ? 'efecte ←' : 'efecte →';
  hud.readout.textContent = `força ${Math.round(g.power * 100)}% · ${eff}`;
};
swipe.onCancel = () => { scene.showAim(null); hud.readout.hidden = true; };
swipe.onRelease = (input) => {
  if (S.phase !== 'aim') return;
  unlockAudio();
  const spec = BITLLOTS[S.hand[S.selected]];
  field.throwClub(input, spec);
  scene.addClub(spec.color);
  S.used.push(S.selected);
  S.inputs.push(input);
  S.phase = 'flight';
  S.slowBudget = 1.6;
  S.clubWasAir = true;
  swipe.enabled = false;
  scene.showAim(null);
  hud.readout.hidden = true;
  hud.hint.hidden = true;
  renderRack();
  vibrate(12);
};

// ---------- Il·lustracions del tutorial ----------
function triaArt() {
  return `<div class="picks small-picks">${ALL_BITLLOTS.map((k) => `<div class="bitllot-pick static"><i style="background:#${BITLLOTS[k].color.toString(16).padStart(6, '0')}"></i><b>${BITLLOTS[k].name}</b><span>${BITLLOTS[k].hint}</span></div>`).join('')}</div>`;
}
function angleArt() {
  return `<svg class="art" viewBox="0 0 220 120" role="img" aria-label="Bitlla inclinada al límit de 45 graus">
    <line x1="10" y1="110" x2="210" y2="110" stroke="currentColor" stroke-width="2"/>
    <path d="M110 110 L180 40" stroke="var(--gold)" stroke-width="2" stroke-dasharray="5 4"/>
    <path d="M150 110 A40 40 0 0 0 138.3 81.7" fill="none" stroke="var(--gold)" stroke-width="2"/>
    <text x="156" y="98" fill="var(--gold)" font-size="13" font-weight="700">45°</text>
    <g transform="rotate(-38 110 110)"><rect x="100" y="40" width="20" height="70" rx="8" fill="var(--pin)" stroke="currentColor"/></g>
    <g transform="rotate(-58 110 110)" opacity=".45"><rect x="100" y="40" width="20" height="70" rx="8" fill="var(--danger)"/></g>
    <text x="16" y="24" fill="currentColor" font-size="12">dreta: &gt; 45°</text>
    <text x="16" y="42" fill="var(--danger)" font-size="12">tombada: &lt; 45°</text>
  </svg>`;
}

// ---------- Bucle ----------
function ghostPos(kind: NonNullable<Lesson['ghost']>, t: number, w: number, h: number) {
  const u = (t % 2.2) / 1.5;
  const k = Math.min(1, u);
  const o = u > 1 ? Math.max(0, 1 - (u - 1) * 2.5) : Math.min(1, u * 8);
  const x0 = w / 2, y0 = h * 0.86, len = h * 0.42;
  if (kind === 'straight') return { x: x0, y: y0 - len * k, o };
  if (kind === 'angle') return { x: x0 + len * 0.32 * k, y: y0 - len * k, o };
  return { x: x0 + Math.sin(k * Math.PI) * len * 0.25, y: y0 - len * k, o };
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  S.t += dt;
  const w = stage.clientWidth, h = stage.clientHeight;

  if (field && (S.phase === 'flight' || S.phase === 'aim' || S.phase === 'result')) {
    // Càmera lenta quan una bitlla tentineja a prop dels 45°.
    const tilts = field.tilts();
    let wobble = -1;
    if (S.phase === 'flight' && S.slowBudget > 0) {
      tilts.forEach((a, i) => { if (field.pins[i] && a > 33 && a < 57) wobble = i; });
    }
    const target = wobble >= 0 ? 0.2 : 1;
    S.timeScale += (target - S.timeScale) * Math.min(1, dt * 10);
    if (wobble >= 0) S.slowBudget -= dt;
    S.acc += dt * S.timeScale;
    let n = 0;
    while (S.acc >= STEP && n < 10) { field.step(); S.acc -= STEP; n++; }

    // Cops: so i vibració quan una bitlla es posa en moviment de cop.
    const ps = field.pinStates();
    ps.forEach((p, i) => {
      const prev = S.lastPinPos[i];
      if (!p || !prev) return;
      const v = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) / Math.max(1e-4, n * STEP);
      if (v > 0.6 && (prev as { v?: number }).v !== undefined && (prev as { v?: number }).v! < 0.25) { knock(Math.min(1, v / 3), 1 + i * 0.04); vibrate(8); }
      S.lastPinPos[i] = Object.assign({ x: p.x, y: p.y, z: p.z }, { v });
    });
    const clubs = field.clubStates();
    const club = clubs[clubs.length - 1];
    const live = field.clubs[field.clubs.length - 1];
    if (live && S.clubWasAir && !live.airborne) { S.clubWasAir = false; knock(0.3, 0.7); }

    scene.sync(ps, clubs, S.pubilla, field.down(), S.t);
    const camMode = S.phase === 'aim' ? 'aim' : club && club.z > 2.2 ? 'follow' : 'pins';
    scene.updateCamera(camMode, club, dt);

    // Transportador.
    if (wobble >= 0 && ps[wobble]) {
      const p = ps[wobble]!;
      const sp = scene.project(p.x, 0.12, p.z, w, h);
      hud.prot.hidden = false;
      hud.prot.style.transform = `translate(${sp.x - 50}px, ${sp.y - 90}px)`;
      const a = tilts[wobble];
      hud.prot.innerHTML = `<svg viewBox="0 0 100 100"><path d="M50 90 L50 20" stroke="#fff" stroke-width="1.5" opacity=".5"/><path d="M50 90 L99.5 40.5" stroke="var(--gold)" stroke-width="2" stroke-dasharray="4 3"/><path d="M50 90 L${50 + 70 * Math.sin((a * Math.PI) / 180)} ${90 - 70 * Math.cos((a * Math.PI) / 180)}" stroke="${a > 45 ? 'var(--danger)' : '#fff'}" stroke-width="4" stroke-linecap="round"/></svg><b>${(90 - a).toFixed(0)}°</b>`;
      if (Math.floor(S.t * 12) % 2 === 0) vibrate(4);
    } else hud.prot.hidden = true;

    if (S.phase === 'flight' && field.settled()) {
      renderPins();
      if (S.mode === 'tutorial') lessonSettled(); else tiradaSettled();
    }
  }

  // Mà fantasma (tutorial).
  if (S.ghost && S.phase === 'aim') {
    const g = ghostPos(S.ghost, S.t, w, h);
    hud.ghost.hidden = false;
    hud.ghost.style.transform = `translate(${g.x - 22}px, ${g.y - 22}px)`;
    hud.ghost.style.opacity = String(g.o);
  } else hud.ghost.hidden = true;

  scene.render(dt);
  requestAnimationFrame(frame);
}

// ---------- Comptador de FPS (?fps) per provar el rendiment en mòbils reals ----------
function startFps() {
  const el = document.createElement('div');
  el.className = 'fps';
  stage.appendChild(el);
  let frames = 0, t0 = performance.now(), worst = 0, prev = t0;
  const tick = (now: number) => {
    frames++;
    worst = Math.max(worst, now - prev);
    prev = now;
    if (now - t0 > 1000) {
      el.textContent = `${Math.round((frames * 1000) / (now - t0))} fps · pitjor ${worst.toFixed(0)} ms · ${scene.renderer.info.render.calls} crides`;
      frames = 0; t0 = now; worst = 0;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- Arrencada ----------
async function boot() {
  await initPhysics();
  scene = new GameScene(canvas);
  // Estètica: ?estil=gris per comparar; ?q=baixa sense postprocessat ni ombres fines.
  const params0 = new URLSearchParams(location.search);
  if ((params0.get('estil') ?? 'realisme') === 'realisme') {
    $('loading').textContent = 'Carregant la plaça…';
    const { applyRealisme } = await import('./game/look-realisme');
    await applyRealisme(scene, params0.get('q') === 'baixa' ? 'baixa' : 'alta');
  }
  if (params0.has('fps')) startFps();
  const resize = () => scene.resize(stage.clientWidth, stage.clientHeight);
  addEventListener('resize', resize);
  resize();
  plant(distanceFor(), [true, true, true, true, true, true], 0);
  hud.root.hidden = true;
  $('loading').remove();
  requestAnimationFrame(frame);
  const params = new URLSearchParams(location.search);
  if (params.has('tutorial')) startTutorial(Number(params.get('tutorial')) || 0);
  else menu();
  (window as unknown as { __bitlla: unknown }).__bitlla = { S, field: () => field, swipe };
}
void boot();
