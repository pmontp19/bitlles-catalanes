import './style.css';
import { bitllesEnCami, Field, initPhysics, launchFromInput, prediuTrajectoria, STEP, zonaDeCaiguda, type ThrowInput } from './game/physics';
import { GestFx } from './game/gest-fx';
import { GameScene } from './game/scene';
import { SwipeInput } from './game/input';
import { cheer, knock, unlockAudio, vibrate } from './game/feedback';
import { LESSONS, type Lesson } from './game/tutorial';
import { PAGINES, questionari, type Pregunta } from './game/regles';
import { clubIcon } from './game/art';
import { comptaPartida, descarta, esIOS, ICONA_COMPARTIR, iniciaInstallacio, installa, potInstallar, tocaProposar } from './installa';
import { dailyDate, dailyPlan, minutsFinsDema, netejaAlies, ordinal, type TiradaEnviada } from './game/diaria';
import {
  ALL_BITLLOTS, BITLLOTS, newPartida, partidaScore, planFromSeed, pushResult, rondaOf, scoreTirada, shareText, tiradaOver,
  TOTAL_TIRADES, type BitllotKind, type DailyPlan, type Partida, type TiradaResult,
} from './game/rules';
import { PIN_LAYOUT, THROW_DISTANCE, TIRADES_PER_RONDA } from './game/constants';

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
type Mode = 'tutorial' | 'partida' | 'daily' | 'regles';
type Phase = 'menu' | 'card' | 'aim' | 'flight' | 'result' | 'end';

let scene: GameScene;
let field: Field;
const swipe = new SwipeInput(stage);
const fx = new GestFx($<HTMLCanvasElement>('fx'));
/** Feedback del gest: última previsió (es deixa atenuada durant el vol) i esglaó de força (per a la vibració). */
const gest = { pred: null as ReturnType<typeof prediuTrajectoria> | null, toca: [] as boolean[], esglao: -1, zona: '' as string };

const S = {
  mode: 'partida' as Mode,
  phase: 'menu' as Phase,
  lesson: 0,
  plan: planFromSeed(1) as DailyPlan,
  dailyDate: '',
  /** Tirades de la partida en curs, tal com s'envien al servidor. */
  log: [] as TiradaEnviada[],
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
type Btn = { label: string; sub?: string; primary?: boolean; flat?: boolean; onClick: () => void };
type Variant = 'paper' | 'note' | 'book' | 'acta' | 'board' | 'pissarra';

function button(b: Btn) {
  const el = document.createElement('button');
  el.className = `btn ${b.primary ? 'primary' : ''} ${b.flat ? 'flat' : ''}`;
  el.innerHTML = `${b.label}${b.sub ? `<small>${b.sub}</small>` : ''}`;
  el.addEventListener('click', () => { unlockAudio(); b.onClick(); });
  return el;
}

/** Targeta sobre l'escena. Cada variant és un material: paper, nota clavada, llibret, acta o rètol de fusta. */
function card(html: string, buttons: Btn[], variant: Variant = 'paper') {
  S.phase = S.phase === 'end' ? 'end' : 'card';
  swipe.enabled = false;
  scene?.showHand(null);
  scene?.showGuide(null);
  fx.clear();
  const cls = variant === 'board' ? 'card board' : `card paper ${variant}`;
  overlay.innerHTML = `<div class="${cls}">${html}${buttons.length ? '<div class="actions"></div>' : ''}</div>`;
  const actions = overlay.querySelector('.actions');
  for (const b of buttons) actions?.appendChild(button(b));
  overlay.hidden = false;
  overlay.scrollTop = 0;
  (overlay.querySelector('button.primary') as HTMLButtonElement | null)?.focus({ preventScroll: true });
}
function closeCard() { overlay.hidden = true; overlay.innerHTML = ''; }

// ---------- Menú ----------
function menu() {
  S.phase = 'menu';
  hud.root.hidden = true;
  const done = store.get('tutorial-fet') === '1';
  const regles = store.get('regles-fet') === '1';
  const best = Number(store.get('millor') ?? 0);
  const avui = diariaGuardada(dailyDate());
  card(
    `<div class="board-sign wood"><h1 class="logo">Bitlla!</h1><div class="board-sub">Bitlles catalanes</div></div>
     <div class="board-paper paper">
       <p class="tagline">Tomba'n cinc i deixa'n una dreta.</p>
       <div class="actions" id="menu-actions"></div>
       ${best ? `<p class="best">Millor partida: ${best} punts</p>` : ''}
     </div>`,
    [],
    'board',
  );
  const actions = $('menu-actions');
  const items: Btn[] = [
    { label: 'Aprèn a jugar', sub: done ? 'Controls i mecàniques' : 'Comença per aquí: 7 lliçons curtes', primary: !done, onClick: () => startTutorial(0) },
    { label: 'Les regles del joc', sub: regles ? 'El reglament de les bitlles catalanes' : 'El reglament real, il·lustrat', onClick: () => showRegles(0) },
    { label: 'Partida ràpida', sub: '9 tirades a 9,5 m', primary: done, onClick: () => startPartida('partida') },
    { label: 'Plantada del dia', sub: avui ? `Avui: ${partidaScore(avui.partida)} punts · nova d'aquí a ${fins(minutsFinsDema())}` : 'Un intent al dia, igual per a tothom', onClick: () => void startDaily() },
  ];
  for (const b of items) actions.appendChild(button(b));
  if (potInstallar() && Number(store.get('partides') ?? 0) >= 1) {
    actions.appendChild(button({ label: 'Instal·la Bitlla!', sub: 'Pantalla completa i sense connexió', flat: true, onClick: () => void proposaInstallar(menu) }));
  }
}

// ---------- Instal·lació com a app ----------
/** Android: avís natiu. iPhone: instruccions per afegir-la a la pantalla d'inici. */
async function proposaInstallar(tornar: () => void) {
  const r = await installa();
  if (r !== null) return tornar();
  if (!esIOS()) return tornar();
  card(`<div class="step">Instal·la Bitlla!</div><h2>Afegeix-la a la pantalla d'inici</h2>
    <ol class="passos">
      <li>Toca el botó <b>Compartir</b> ${ICONA_COMPARTIR} de la barra del navegador.</li>
      <li>Tria <b>Afegeix a la pantalla d'inici</b>.</li>
      <li>Obre Bitlla! des de la icona nova: pantalla completa, sense barres i amb les partides desades.</li>
    </ol>`, [
    { label: 'Fet', primary: true, onClick: tornar },
    { label: 'Ara no', flat: true, onClick: () => { descarta(); tornar(); } },
  ], 'note');
}

/** Nota a l'acta: proposa instal·lar-la després d'haver jugat, com a molt un cop per setmana. */
function notaInstallar(): string {
  if (!tocaProposar()) return '';
  return `<div class="nota-installa" id="nota-installa"><p><b>Tens Bitlla! a mà?</b> Afegeix-la a la pantalla d'inici: s'obre a pantalla completa, funciona sense connexió i la plantada del dia t'hi espera cada matí.</p><div class="nota-botons"><span id="ni-si"></span><span id="ni-no"></span></div></div>`;
}
function lligaNotaInstallar(tornar: () => void) {
  if (!document.getElementById('nota-installa')) return;
  $('ni-si').appendChild(button({ label: esIOS() ? 'Com s\'hi afegeix?' : 'Instal·la', primary: true, onClick: () => void proposaInstallar(tornar) }));
  $('ni-no').appendChild(button({ label: 'Ara no', flat: true, onClick: () => { descarta(); $('nota-installa').remove(); } }));
}

// ---------- Les regles del joc (reglament) ----------
function bookHtml(head: string, body: string, page: number, total: number) {
  return `<div class="book-head"><span>Reglament de joc</span><span>${head}</span></div>
    <div class="book-body">${body}</div>
    <div class="book-foot"><span id="bk-prev"></span><div class="dots">${Array.from({ length: total }, (_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('')}</div><span id="bk-next"></span></div>`;
}

function showRegles(page: number) {
  S.mode = 'regles';
  hud.root.hidden = true;
  const p = PAGINES[page];
  card(bookHtml(`pàg. ${page + 1} de ${PAGINES.length}`, `<h2>${p.title}</h2>${p.html}`, page, PAGINES.length), [], 'book');
  $('bk-prev').appendChild(button(page === 0 ? { label: 'Menú', onClick: menu } : { label: '‹ Enrere', onClick: () => showRegles(page - 1) }));
  $('bk-next').appendChild(button(page + 1 < PAGINES.length
    ? { label: 'Endavant ›', primary: true, onClick: () => showRegles(page + 1) }
    : { label: 'Posa\'t a prova', primary: true, onClick: () => startQuiz() }));
}

function startQuiz() {
  const qs = questionari((Math.random() * 2 ** 31) | 0);
  showPregunta(qs, 0, 0);
}

function showPregunta(qs: Pregunta[], i: number, encerts: number) {
  if (i >= qs.length) return quizDone(encerts, qs.length);
  const q = qs[i];
  card(bookHtml(`pregunta ${i + 1} de ${qs.length}`, `${q.html}<div class="tickets" id="tickets"></div><p class="why" id="why" hidden></p>`, i, qs.length), [], 'book');
  $('bk-prev').appendChild(button({ label: 'Llibret', onClick: () => showRegles(0) }));
  const tickets = $('tickets');
  let answered = false;
  q.options.forEach((o, k) => {
    const t = document.createElement('button');
    t.className = 'ticket';
    t.textContent = o;
    t.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      const ok = k === q.correct;
      t.classList.add(ok ? 'ok' : 'ko');
      tickets.children[q.correct].classList.add('ok');
      const why = $('why');
      why.hidden = false;
      why.textContent = `${ok ? 'Correcte! ' : ''}${q.why}`;
      if (ok) { cheer(false); vibrate(15); } else vibrate([30, 40, 30]);
      $('bk-next').appendChild(button({ label: i + 1 < qs.length ? 'Següent ›' : 'Resultat ›', primary: true, onClick: () => showPregunta(qs, i + 1, encerts + (ok ? 1 : 0)) }));
    });
    tickets.appendChild(t);
  });
}

function quizDone(encerts: number, total: number) {
  const aprovat = encerts >= total - 1;
  if (aprovat) store.set('regles-fet', '1');
  card(`<div class="step">Les regles del joc</div>
    <div style="text-align:center;padding:10px 0"><span class="stamp ${aprovat ? 'green' : ''}">${aprovat ? 'Aprovat' : 'Torna-hi'}</span></div>
    <p style="text-align:center">${encerts} de ${total} respostes correctes.</p>
    <p class="small" style="text-align:center">${aprovat ? 'Ja saps com puntua una tirada de debò.' : 'Fes un cop d\'ull al llibret i torna-ho a provar.'}</p>`, [
    { label: aprovat ? 'Juga una partida' : 'Torna-hi', primary: true, onClick: () => (aprovat ? startPartida('partida') : startQuiz()) },
    { label: 'Llibret de regles', onClick: () => showRegles(0) },
    { label: 'Menú', flat: true, onClick: menu },
  ]);
}

// ---------- Tutorial ----------
function startTutorial(i: number) {
  S.mode = 'tutorial';
  S.lesson = i;
  const L = LESSONS[i];
  if (!L) { store.set('tutorial-fet', '1'); return tutorialDone(); }
  const step = `<div class="step">Aprèn a jugar · lliçó ${i + 1} de ${LESSONS.length}</div>`;
  if (L.explainOnly) {
    return card(`${step}<h2>${L.title}</h2>${triaArt()}<p>${L.intro}</p>`, [
      { label: 'Continua', primary: true, onClick: () => startTutorial(i + 1) },
      { label: 'Surt', flat: true, onClick: menu },
    ], 'note');
  }
  card(`${step}<h2>${L.title}</h2><p>${L.intro}</p><p class="goal-line">Objectiu: ${L.goal}</p>`, [
    { label: 'Som-hi', primary: true, onClick: () => { closeCard(); setupLesson(L); } },
    { label: 'Salta el tutorial', flat: true, onClick: () => { store.set('tutorial-fet', '1'); menu(); } },
  ], 'note');
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
  hud.tirada.textContent = `Lliçó ${S.lesson + 1} · ${L.title}`;
  hud.score.textContent = '–';
  hud.rack.classList.toggle('point', !!L.pointRack);
  toAim();
}

function lessonSettled() {
  const L = LESSONS[S.lesson];
  const down = field.down();
  const ok = L.check({ down, startDown: S.startDown, pubilla: S.pubilla, inputs: S.inputs, kinds: S.used.map((i) => S.hand[i]) });
  const outOfClubs = S.used.length >= S.hand.length || down.filter(Boolean).length >= 5 || !!L.oneShot;
  if (ok) {
    cheer(true);
    vibrate([20, 40, 20]);
    S.phase = 'result';
    hud.rack.classList.remove('point');
    setTimeout(() => card(`<div style="text-align:center;padding:6px 0"><span class="stamp green">Fet!</span></div><h2>${L.success}</h2>`, [
      { label: S.lesson + 1 < LESSONS.length ? 'Següent lliçó' : 'Acaba', primary: true, onClick: () => startTutorial(S.lesson + 1) },
      { label: 'Repeteix', onClick: () => { closeCard(); setupLesson(L); } },
    ], 'note'), 700);
  } else if (outOfClubs) {
    S.phase = 'result';
    setTimeout(() => card(`<h2>Gairebé</h2><p>${L.fail}</p>`, [
      { label: 'Torna-hi', primary: true, onClick: () => { closeCard(); setupLesson(L); } },
      { label: 'Salta aquesta lliçó', flat: true, onClick: () => startTutorial(S.lesson + 1) },
    ], 'note'), 700);
  } else {
    toAim();
  }
}

function tutorialDone() {
  const regles = store.get('regles-fet') === '1';
  card(`<div style="text-align:center;padding:6px 0"><span class="stamp green">Après</span></div><h2>Ja saps jugar</h2>
    <p>Ja domines el llançament, la punteria, l'efecte i els bitllots.${regles ? '' : ' Si vols saber com es puntua de debò i per què val més deixar-ne una, llegeix les regles.'}</p>`, [
    { label: 'Juga una partida', primary: true, onClick: () => startPartida('partida') },
    ...(regles ? [] : [{ label: 'Les regles del joc', onClick: () => showRegles(0) }]),
    { label: 'Menú', flat: true, onClick: menu },
  ], 'note');
}

// ---------- Partida i plantada del dia ----------
function startPartida(mode: 'partida' | 'daily', plan?: DailyPlan) {
  S.mode = mode;
  S.plan = plan ?? planFromSeed((Math.random() * 2 ** 31) | 0, 0);
  S.partida = newPartida();
  S.log = [];
  S.tirada = 0;
  S.ghost = null;
  hud.goal.hidden = true;
  hud.rack.classList.remove('point');
  chooseBench();
}

// ---------- Plantada del dia: un intent per dia i rànquing ----------
type DiariaGuardada = { partida: Partida; log: TiradaEnviada[]; enviada?: boolean; rank?: number; count?: number };
const diariaKey = (date: string) => `diaria:${date}`;
function diariaGuardada(date: string): DiariaGuardada | null {
  try { return JSON.parse(store.get(diariaKey(date)) ?? 'null'); } catch { return null; }
}
function jugador(): string {
  let id = store.get('jugador');
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).toLowerCase();
    store.set('jugador', id);
  }
  return id;
}
function fins(minuts: number) {
  const h = Math.floor(minuts / 60), m = minuts % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

async function startDaily() {
  // La data i la llavor es calculen igual al client i al servidor; el servidor mana si respon.
  let date = dailyDate();
  try {
    const r = await fetch('/api/daily');
    if (r.ok) { const j = (await r.json()) as { date: string }; date = j.date; }
  } catch { /* sense xarxa: data local */ }
  S.dailyDate = date;
  const ja = diariaGuardada(date);
  if (ja) { S.mode = 'daily'; S.partida = ja.partida; S.log = ja.log; return showActa(ja); }
  startPartida('daily', dailyPlan(date));
}

/** Demana l'àlies (un sol cop) i envia la partida al rànquing. */
async function enviaDiaria(g: DiariaGuardada) {
  const alies = store.get('alies');
  if (!alies) return demanaAlies(g);
  try {
    const r = await fetch('/api/daily/score', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: S.dailyDate, player: jugador(), name: alies, tirades: g.log }),
    });
    if (r.ok) {
      const j = (await r.json()) as { rank: number; count: number };
      Object.assign(g, { enviada: true, rank: j.rank, count: j.count });
      store.set(diariaKey(S.dailyDate), JSON.stringify(g));
    }
  } catch { /* sense xarxa: es reintentarà en obrir la plantada */ }
  showActa(g);
}

function demanaAlies(g: DiariaGuardada) {
  card(`<div class="step">Rànquing de la plantada del dia</div><h2>Com et diem?</h2>
    <p class="small">El teu àlies sortirà al rànquing. Només el demanem una vegada.</p>
    <label class="field"><span>Àlies</span><input id="alies" maxlength="20" autocomplete="nickname" placeholder="p. ex. Pere de Vilanova"></label>
    <p class="small" id="alies-err" hidden>Ha de tenir entre 2 i 20 lletres.</p>`, [
    { label: 'Envia al rànquing', primary: true, onClick: () => {
      const n = netejaAlies(($('alies') as HTMLInputElement).value);
      if (!n) { $('alies-err').hidden = false; return; }
      store.set('alies', n);
      void enviaDiaria(g);
    } },
    { label: 'Ara no', flat: true, onClick: () => showActa(g) },
  ], 'paper');
  setTimeout(() => ($('alies') as HTMLInputElement | null)?.focus(), 50);
}

async function showRanking() {
  card(`<div class="slate-head">Rànquing · ${S.dailyDate}</div><div class="slate-list" id="rank-list"><p>Carregant…</p></div>`, [
    { label: 'Tanca', onClick: () => { const g = diariaGuardada(S.dailyDate); if (g) showActa(g); else menu(); } },
  ], 'pissarra');
  const list = $('rank-list');
  try {
    const r = await fetch(`/api/daily/ranking?player=${encodeURIComponent(jugador())}`);
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { count: number; top: { name: string; total: number; bitlles: number }[]; me: { rank: number; total: number } | null };
    const alies = store.get('alies');
    list.innerHTML = j.top.length
      ? `<ol>${j.top.map((t, i) => `<li class="${t.name === alies && j.me && j.me.rank === i + 1 ? 'me' : ''}"><span class="pos">${i + 1}</span><span class="nom">${t.name.replace(/[&<>]/g, '')}</span><span class="pts">${t.total}</span></li>`).join('')}</ol>
         <p class="peu">${j.count} ${j.count === 1 ? 'jugador' : 'jugadors'} avui${j.me && j.me.rank > 20 ? ` · tu ets el ${ordinal(j.me.rank)} amb ${j.me.total}` : ''}</p>`
      : '<p>Encara no hi ha ningú. Sigues el primer!</p>';
  } catch {
    list.innerHTML = '<p>El rànquing no està disponible ara mateix.</p>';
  }
}

/** Tria 3 de 4: a l'inici de cada ronda, el jugador deixa un bitllot a la banqueta. */
function chooseBench() {
  const ronda = rondaOf(S.tirada) + 1;
  const items = ALL_BITLLOTS.map((k) => {
    const b = BITLLOTS[k];
    return `<button class="bitllot-pick" data-k="${k}">${clubIcon(k, 96)}<b>${b.name}</b><span>${b.hint}</span></button>`;
  }).join('');
  card(`<div class="step">Ronda ${ronda} de 3</div><h2>Quin deixes a la banqueta?</h2><p class="small">Portes 4 bitllots i en llances 3.</p><div class="picks">${items}</div>`, [], 'note');
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
  S.log.push({ down: [...down], used: S.used.length });
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
  const title = r.label === 'bitlla d\'or' ? 'Bitlla d\'or!' : r.label === 'bitlla' ? 'Bitlla!' : r.label === 'llenya' ? 'Llenya' : r.knocked === 0 ? 'Res' : `${r.knocked} ${r.knocked === 1 ? 'bitlla' : 'bitlles'}`;
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
  comptaPartida();
  const total = partidaScore(S.partida);
  const best = Number(store.get('millor') ?? 0);
  const record = total > best && best > 0;
  if (total > best) store.set('millor', String(total));
  if (S.mode === 'daily') {
    // Un sol intent per dia: es desa abans d'enviar-la.
    const g: DiariaGuardada = { partida: S.partida, log: S.log };
    store.set(diariaKey(S.dailyDate), JSON.stringify(g));
    return void enviaDiaria(g);
  }
  showActa(null, record);
}

/** Acta de la partida en curs (o de la plantada del dia ja jugada). */
function showActa(g: DiariaGuardada | null, record = false) {
  S.phase = 'end';
  hud.root.hidden = true;
  const daily = S.mode === 'daily';
  const p = S.partida;
  const total = partidaScore(p);
  const text = shareText(p, daily ? `Bitlla! ${S.dailyDate}` : 'Bitlla!') + (daily && g?.rank ? `\n${ordinal(g.rank)} de ${g.count}` : '');
  const bitlles = p.results.filter((r) => r.knocked === 5).length;
  const cell = (r?: TiradaResult) => r
    ? `<div class="cell ${r.knocked === 5 ? 'bitlla' : ''}">${r.total}<small>${r.label === 'bitlla d\'or' ? 'or' : r.label === 'bitlla' ? 'bitlla' : r.label === 'llenya' ? 'llenya' : `${r.knocked} tomb.`}</small></div>`
    : '<div class="cell"></div>';
  const rows = [0, 1, 2].map((rd) => `<div class="rh">Ronda ${rd + 1}</div>${[0, 1, 2].map((t) => cell(p.results[rd * 3 + t])).join('')}`).join('');
  const posicio = daily
    ? g?.rank ? `<p class="posicio">${ordinal(g.rank)} de ${g.count} avui</p>` : `<p class="small">${g?.enviada === false || !g?.enviada ? 'No s\'ha pogut enviar al rànquing.' : ''}</p>`
    : '';
  const dema = daily ? `<p class="small">Nova plantada d'aquí a ${fins(minutsFinsDema())}.</p>` : '';
  const buttons: Btn[] = [
    { label: 'Copia el resultat', primary: true, onClick: () => {
      navigator.clipboard?.writeText(text).then(() => { hud.hint.textContent = 'Copiat'; }).catch(() => {
        const sel = getSelection(); const r = document.createRange(); r.selectNodeContents($('share-text')); sel?.removeAllRanges(); sel?.addRange(r);
      });
    } },
  ];
  if (daily) {
    buttons.push({ label: 'Rànquing del dia', onClick: () => void showRanking() });
    if (g && !g.enviada) buttons.push({ label: store.get('alies') ? 'Torna a enviar' : 'Envia al rànquing', onClick: () => void enviaDiaria(g) });
  } else buttons.push({ label: 'Torna a jugar', onClick: () => startPartida('partida') });
  buttons.push({ label: 'Menú', flat: true, onClick: menu });
  card(`<div class="acta-head"><span>Acta de la partida</span><span>${daily ? S.dailyDate : 'Partida ràpida'}</span></div>
    <div class="acta-grid">${rows}</div>
    <div class="acta-total"><div><p class="small">${bitlles} bitlles de 9 tirades</p>${posicio}${record ? '<span class="stamp gold" style="font-size:20px;margin-top:6px">Rècord</span>' : ''}</div><span class="num">${total}</span></div>
    ${dema}
    <pre class="share" id="share-text">${text}</pre>
    ${notaInstallar()}`, buttons, 'acta');
  lligaNotaInstallar(() => showActa(g, record));
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
  scene.showGuide(null);
  gest.pred = null;
  renderRack();
  renderPins();
  maIdle();
}

function renderRack() {
  hud.rack.innerHTML = '';
  S.hand.forEach((k, i) => {
    const b = BITLLOTS[k];
    const el = document.createElement('button');
    el.className = `club ${S.used.includes(i) ? 'used' : ''} ${i === S.selected ? 'sel' : ''}`;
    el.innerHTML = `${clubIcon(k, 52)}<span>${b.name}</span>`;
    el.setAttribute('aria-label', `Bitllot ${b.name}${S.used.includes(i) ? ', ja llançat' : ''}`);
    el.disabled = S.used.includes(i) || S.phase !== 'aim';
    el.addEventListener('click', (e) => { e.stopPropagation(); S.selected = i; renderRack(); maIdle(); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    hud.rack.appendChild(el);
  });
}

function renderPins() {
  const down = field.down();
  hud.pins.innerHTML = down.map((d, i) => `<i class="${d ? 'down' : ''} ${i === S.pubilla ? 'pub' : ''}"></i>`).join('');
}

/** Franja de força que fa caure el bitllot just davant de les bitlles, per a la punteria i l'efecte actuals. */
function franjaBona(g: ThrowInput, spec: (typeof BITLLOTS)[BitllotKind]): [number, number] | null {
  let lo = -1, hi = -1;
  for (let k = 0; k <= 40; k++) {
    const p = k / 40;
    if (zonaDeCaiguda(launchFromInput({ ...g, power: p }, field.distance, spec).landing.z) === 'be') { if (lo < 0) lo = p; hi = p; }
  }
  return lo < 0 ? null : [lo, hi];
}

function maIdle() {
  const spec = BITLLOTS[S.hand[S.selected]];
  if (spec) scene.showHand({ nx: 0, ny: -0.5, aim: 0, spin: 0, power: 0, color: spec.color });
}

swipe.onMove = (g, path) => {
  if (S.phase !== 'aim') return;
  const spec = BITLLOTS[S.hand[S.selected]];
  hud.hint.hidden = true;
  hud.readout.hidden = true;
  S.ghost = null;
  hud.ghost.hidden = true;
  const last = path[path.length - 1];
  const w = stage.clientWidth, h = stage.clientHeight;
  scene.showHand({ nx: (last.x / w) * 2 - 1, ny: -(last.y / h) * 2 + 1, aim: g.aim, spin: g.spin, power: g.power, color: spec.color });
  if (!g.valid) { scene.showGuide(null); fx.update(path, 'curt', 0, g.power, null); return; }
  const pred = prediuTrajectoria(g, field.distance, spec);
  const down = field.down();
  const toca = bitllesEnCami(pred, PIN_LAYOUT).map((t, k) => t && !down[k]);
  gest.pred = pred; gest.toca = toca;
  scene.showGuide({ vol: pred.vol, terra: pred.terra, zona: pred.zona, toca });
  fx.update(path, pred.zona, g.spin, g.power, franjaBona(g, spec));
  // Vibració suau a cada esglaó de força i una mica més forta en entrar a la zona bona.
  const esglao = Math.floor(g.power * 10);
  if (esglao !== gest.esglao) { if (gest.esglao >= 0) vibrate(4); gest.esglao = esglao; }
  if (pred.zona === 'be' && gest.zona !== 'be') vibrate(16);
  gest.zona = pred.zona;
};
swipe.onCancel = () => { scene.showGuide(null); fx.clear(); gest.esglao = -1; gest.zona = ''; hud.readout.hidden = true; if (S.phase === 'aim') { maIdle(); hud.hint.hidden = false; } };
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
  // La guia queda atenuada durant el vol per comparar-la amb la traça real.
  if (gest.pred) scene.showGuide({ vol: gest.pred.vol, terra: gest.pred.terra, zona: gest.pred.zona, toca: gest.toca }, true);
  scene.showHand(null);
  fx.release();
  gest.esglao = -1; gest.zona = '';
  hud.readout.hidden = true;
  hud.hint.hidden = true;
  renderRack();
  vibrate(12);
};

// ---------- Il·lustracions del tutorial ----------
function triaArt() {
  return `<div class="picks">${ALL_BITLLOTS.map((k) => `<div class="bitllot-pick static">${clubIcon(k, 84)}<b>${BITLLOTS[k].name}</b><span>${BITLLOTS[k].hint}</span></div>`).join('')}</div>`;
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

  fx.draw(dt);
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
  iniciaInstallacio(() => { if (S.phase === 'menu') menu(); });
  await initPhysics();
  scene = new GameScene(canvas);
  // Estètica única: realisme. ?q=baixa per a mòbils modestos (sense postprocessat, ombres i còdols reduïts).
  const params0 = new URLSearchParams(location.search);
  $('loading').textContent = 'Carregant la plaça…';
  const { applyRealisme } = await import('./game/look-realisme');
  const escenari = params0.get('escenari') === 'parc' ? 'parc' : 'vilanova';
  await applyRealisme(scene, params0.get('q') === 'baixa' ? 'baixa' : 'alta', escenari);
  if (params0.has('fps')) startFps();
  const resize = () => { scene.resize(stage.clientWidth, stage.clientHeight); fx.resize(stage.clientWidth, stage.clientHeight); };
  addEventListener('resize', resize);
  resize();
  plant(distanceFor(), [true, true, true, true, true, true], 0);
  hud.root.hidden = true;
  $('loading').remove();
  requestAnimationFrame(frame);
  const params = new URLSearchParams(location.search);
  if (params.has('tutorial')) startTutorial(Number(params.get('tutorial')) || 0);
  else menu();
  (window as unknown as { __bitlla: unknown }).__bitlla = { S, field: () => field, swipe, scene: () => scene, endPartida, showActa };
}
void boot();
