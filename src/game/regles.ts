// "Les regles del joc": llibret del reglament real (FCBB, 2010) i qüestionari per posar-se a prova.
// Separat del tutorial de mecànica (`tutorial.ts`), que ensenya a controlar el joc.
import { THROW_DISTANCE } from './constants';
import { baseScore, mulberry32 } from './rules';
import { angleSvg, materialSvg, pistaSvg, plantadaSvg } from './art';

export type Pagina = { title: string; html: string };

const taula = `<table class="taula">
  <tr><th>Bitlles tombades</th><th>Punts</th></tr>
  <tr class="destacat"><td>5 · <i>bitlla</i></td><td>10</td></tr>
  <tr><td>6 · <i>llenya</i></td><td>6</td></tr>
  <tr><td>4</td><td>4</td></tr><tr><td>3</td><td>3</td></tr><tr><td>2</td><td>2</td></tr><tr><td>1</td><td>1</td></tr><tr><td>0</td><td>0</td></tr>
</table>`;

export const PAGINES: Pagina[] = [
  {
    title: 'El joc',
    html: `${plantadaSvg([true, true, false, true, true, true])}
      <p>Les bitlles catalanes són un joc tradicional dels pobles i les places de Catalunya. Es juga amb sis bitlles i tres bitllots de fusta.</p>
      <p>L'objectiu no és tombar-les totes: és <b>tombar-ne cinc i deixar-ne una dreta</b>. Això es diu <i>fer bitlla</i>.</p>`,
  },
  {
    title: 'El material',
    html: `${materialSvg()}
      <p>Les <b>bitlles</b> (o birles) són de fusta d'alzina tornejada, més primes al terç de dalt, amb una anella de ferro a la base.</p>
      <p>Els <b>bitllots</b> (o birlots) també són d'alzina: una part ampla per colpejar i un mànec per agafar-los.</p>`,
  },
  {
    title: 'La plantada',
    html: `${plantadaSvg()}
      <p>Les sis bitlles es planten en <b>dues fileres de tres</b>, centrades a la pista. La primera filera va just damunt de la línia.</p>
      <p>Entre les bases hi ha d'haver <b>7,5 cm</b>. Per plantar-les bé es fa servir una plantilla de fusta abans de cada tirada.</p>`,
  },
  {
    title: 'La tirada',
    html: `${pistaSvg()}
      <p>Una tirada són <b>tres bitllots</b>, llançats un darrere l'altre des de la línia de la teva categoria, sense trepitjar-la.</p>
      <p>Pots portar fins a quatre bitllots a la pista i triar quins tres llances. Si fas bitlla amb el primer o el segon, <b>ja no cal llançar més</b>.</p>`,
  },
  {
    title: 'La puntuació',
    html: `${taula}
      <p>Tombar-les totes, la <i>llenya</i>, només val 6 punts. Per això el bon jugador busca la precisió, no la força.</p>`,
  },
  {
    title: 'Bitlla tombada',
    html: `${angleSvg(38)}
      <p>Una bitlla compta com a <b>tombada</b> quan queda inclinada <b>menys de 45°</b> respecte al terra. En cas de dubte, l'àrbitre mesura l'alçada del cap: ha de ser de menys de 37,5 cm.</p>
      <p class="nota">Al joc, quan una bitlla tentineja a prop del límit, el temps s'alenteix i apareix un transportador.</p>`,
  },
  {
    title: 'La partida',
    html: `<div class="rondes">${[1, 2, 3].map((r) => `<div><b>Ronda ${r}</b><span>${[1, 2, 3].map((t) => `<i>${(r - 1) * 3 + t}</i>`).join('')}</span></div>`).join('')}</div>
      <p>Una partida són <b>nou tirades</b> per jugador, dividides en <b>tres rondes de tres</b>. Es pot jugar individualment o per equips de cinc.</p>
      <p>Guanya qui suma més punts. El màxim, sense mecàniques del joc, és 90: nou bitlles seguides.</p>`,
  },
];

// ---------- Qüestionari ----------
export type Pregunta = {
  html: string;
  options: string[];
  correct: number;
  /** Explicació que es mostra després de respondre. */
  why: string;
};

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function choice(correct: string, wrong: string[], r: () => number) {
  const options = shuffle([correct, ...wrong], r);
  return { options, correct: options.indexOf(correct) };
}

function preguntaPunts(r: () => number, knocked: number): Pregunta {
  const idx = shuffle([0, 1, 2, 3, 4, 5], r);
  const down = [false, false, false, false, false, false];
  idx.slice(0, knocked).forEach((i) => (down[i] = true));
  const pts = baseScore(knocked);
  const wrongPool = [...new Set([knocked, 6, 10, 5, 4, 12].filter((v) => v !== pts))];
  const c = choice(String(pts), shuffle(wrongPool, r).slice(0, 3).map(String), r);
  const why = knocked === 5 ? 'Cinc tombades i una dreta és bitlla: 10 punts.'
    : knocked === 6 ? 'Totes sis és llenya: només 6 punts.'
    : `Si no és bitlla ni llenya, val el nombre de bitlles tombades: ${pts}.`;
  return { html: `${plantadaSvg(down)}<p>Has acabat la tirada així. Quants punts fas?</p>`, ...c, why };
}

function preguntaAngle(r: () => number): Pregunta {
  const deg = shuffle([30, 38, 52, 60], r)[0];
  const tombada = deg < 45;
  const c = { options: ['Sí, és tombada', 'No, compta com a dreta'], correct: tombada ? 0 : 1 };
  return {
    html: `${angleSvg(deg, false)}<p>Aquesta bitlla ha quedat inclinada ${deg}° respecte al terra. Compta com a tombada?</p>`,
    ...c,
    why: `El límit és 45°: per sota és tombada, per sobre és dreta. ${deg}° ${tombada ? 'és menys' : 'és més'} de 45°.`,
  };
}

function preguntaDistancia(r: () => number): Pregunta {
  const cats: [string, number][] = [['un jugador sènior masculí', THROW_DISTANCE.masculina], ['una jugadora sènior', THROW_DISTANCE.femenina], ['un jugador aleví', THROW_DISTANCE.alevina], ['un jugador benjamí', THROW_DISTANCE.benjamina]];
  const [who, m] = cats[Math.floor(r() * cats.length)];
  const fmt = (v: number) => `${String(v).replace('.', ',')} m`;
  const all = [6.5, 8, 9.5, 11.5];
  const c = choice(fmt(m), all.filter((v) => v !== m).map(fmt), r);
  return { html: `${pistaSvg()}<p>Des de quina distància llança ${who}?</p>`, ...c, why: `Les distàncies són 11,5 m (masculí), 9,5 m (femení i infantil), 8 m (aleví) i 6,5 m (benjamí).` };
}

const FIXES: ((r: () => number) => Pregunta)[] = [
  (r) => ({
    html: '<p>Fas bitlla amb el <b>primer</b> bitllot. Què passa amb els altres dos?</p>',
    ...choice('Ja no cal llançar-los', ['Els has de llançar igualment', 'Es tornen a plantar les bitlles', 'Sumen 5 punts cadascun'], r),
    why: 'Si fas bitlla amb el primer o el segon bitllot, la tirada s\'acaba.',
  }),
  (r) => ({
    html: '<p>Quantes tirades té una partida?</p>',
    ...choice('9, en tres rondes de tres', ['3', '6, en dues rondes de tres', '10'], r),
    why: 'Una partida són nou tirades per jugador, en tres rondes de tres.',
  }),
  (r) => ({
    html: '<p>Quants bitllots pots portar a la pista?</p>',
    ...choice('Fins a 4, i en llances 3', ['Exactament 3', 'Fins a 6', 'Només 1'], r),
    why: 'Pots portar-ne fins a quatre i llançar els tres que et convinguin.',
  }),
];

/** Cinc preguntes deterministes per a una llavor: dues de punts (una sempre de bitlla o llenya), angle, distància i una de fixa. */
export function questionari(seed: number): Pregunta[] {
  const r = mulberry32(seed);
  const trampa = r() < 0.5 ? 5 : 6;
  const altra = [1, 2, 3, 4, trampa === 5 ? 6 : 5][Math.floor(r() * 5)];
  return [
    preguntaPunts(r, trampa),
    preguntaAngle(r),
    preguntaPunts(r, altra),
    preguntaDistancia(r),
    FIXES[Math.floor(r() * FIXES.length)](r),
  ];
}
