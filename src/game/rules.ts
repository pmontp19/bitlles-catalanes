// Regles pures (sense física ni render): puntuació, tirada, partida, pubilla i bitllots.
import { BITLLOTS_PER_TIRADA, KNOCK_ANGLE_DEG, RONDES, TIRADES_PER_RONDA } from './constants';

export type Quat = { x: number; y: number; z: number; w: number };

/** Inclinació de la bitlla respecte a la vertical, en graus (0 = dreta, 90 = estirada). */
export function tiltFromVertical(q: Quat): number {
  // Component Y de l'eix local Y rotat pel quaternió.
  const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
  return (Math.acos(Math.max(-1, Math.min(1, upY))) * 180) / Math.PI;
}

/** Reglament 6.5: tombada si l'angle amb l'horitzontal és < 45°, és a dir, inclinació respecte a la vertical > 45°. */
export function isKnocked(q: Quat): boolean {
  return tiltFromVertical(q) > 90 - KNOCK_ANGLE_DEG;
}

/** Taula oficial (6.4): 5 tombades = 10 ("bitlla"), 6 = 6 ("llenya"), la resta val el que tombes. */
export function baseScore(knocked: number): number {
  if (knocked === 5) return 10;
  return Math.max(0, Math.min(6, knocked));
}

export type TiradaResult = {
  knocked: number;
  /** Índex de la bitlla que ha quedat dreta quan s'ha fet bitlla. */
  standing: number[];
  pubilla: number | null;
  bitllotsUsed: number;
  base: number;
  /** Bitlla amb la pubilla dreta: es duplica. */
  bitllaOr: boolean;
  multiplier: number;
  total: number;
  label: 'bitlla d\'or' | 'bitlla' | 'llenya' | 'res' | 'punts';
  /** Bitllots no llançats perquè s'ha fet bitlla aviat (6.2). */
  saved: number;
};

/** Multiplicador per bitllots estalviats: cada bitllot no llançat suma ×0,5 a la tirada següent. */
export function multiplierFromSaved(saved: number): number {
  return 1 + 0.5 * saved;
}

export function scoreTirada(
  down: boolean[],
  pubilla: number | null,
  bitllotsUsed: number,
  multiplier = 1,
): TiradaResult {
  const knocked = down.filter(Boolean).length;
  const standing = down.map((d, i) => (d ? -1 : i)).filter((i) => i >= 0);
  const base = baseScore(knocked);
  const bitllaOr = knocked === 5 && pubilla !== null && standing[0] === pubilla;
  const raw = bitllaOr ? base * 2 : base;
  const saved = knocked === 5 ? BITLLOTS_PER_TIRADA - bitllotsUsed : 0;
  const total = Math.round(raw * multiplier);
  const label = bitllaOr ? 'bitlla d\'or' : knocked === 5 ? 'bitlla' : knocked === 6 ? 'llenya' : knocked === 0 ? 'res' : 'punts';
  return { knocked, standing, pubilla, bitllotsUsed, base, bitllaOr, multiplier, total, label, saved };
}

/** La tirada acaba quan s'han llançat 3 bitllots o quan hi ha bitlla abans (6.2). Amb llenya també s'acaba. */
export function tiradaOver(down: boolean[], bitllotsUsed: number): boolean {
  const k = down.filter(Boolean).length;
  return bitllotsUsed >= BITLLOTS_PER_TIRADA || k >= 5;
}

// ---------- Bitllots: tria 3 de 4 ----------
export type BitllotKind = 'alzina' | 'boix' | 'cinta' | 'torcat';
export type BitllotSpec = {
  kind: BitllotKind;
  name: string;
  hint: string;
  density: number;
  restitution: number;
  friction: number;
  /** Multiplica la sensibilitat de punteria (menys = més control). */
  aimScale: number;
  /** Multiplica el gir que dona la corba del gest. */
  spinScale: number;
  color: number;
};
export const BITLLOTS: Record<BitllotKind, BitllotSpec> = {
  alzina: { kind: 'alzina', name: 'Alzina', hint: 'Pesat. Arrasa, però costa deixar-ne una.', density: 1150, restitution: 0.15, friction: 0.55, aimScale: 1, spinScale: 0.8, color: 0x8a5a34 },
  boix: { kind: 'boix', name: 'Boix', hint: 'Lleuger i viu. Rebota i va lluny.', density: 650, restitution: 0.45, friction: 0.35, aimScale: 1, spinScale: 1, color: 0xd9b26a },
  cinta: { kind: 'cinta', name: 'Amb cinta', hint: 'Més control: la punteria és més fina.', density: 900, restitution: 0.25, friction: 0.5, aimScale: 0.6, spinScale: 0.9, color: 0x3d6fb6 },
  torcat: { kind: 'torcat', name: 'Torçat', hint: 'Efecte exagerat. Corba molt.', density: 900, restitution: 0.25, friction: 0.45, aimScale: 1, spinScale: 1.9, color: 0x6b8e3a },
};
export const ALL_BITLLOTS: BitllotKind[] = ['alzina', 'boix', 'cinta', 'torcat'];

// ---------- Partida: 9 tirades, 3 rondes ----------
export type Partida = {
  results: TiradaResult[];
  nextMultiplier: number;
};
export const TOTAL_TIRADES = RONDES * TIRADES_PER_RONDA;

export function newPartida(): Partida {
  return { results: [], nextMultiplier: 1 };
}

export function pushResult(p: Partida, r: TiradaResult): Partida {
  return { results: [...p.results, r], nextMultiplier: multiplierFromSaved(r.saved) };
}

export function partidaScore(p: Partida): number {
  return p.results.reduce((s, r) => s + r.total, 0);
}

export function rondaOf(tiradaIndex: number): number {
  return Math.floor(tiradaIndex / TIRADES_PER_RONDA);
}

/** Text per compartir, una fila per ronda. */
export function shareText(p: Partida, title: string): string {
  const icon = (r: TiradaResult) =>
    r.label === 'bitlla d\'or' ? '🌟' : r.label === 'bitlla' ? '🟨' : r.label === 'llenya' ? '🪵' : r.knocked === 0 ? '⬛' : '🟫';
  const rows: string[] = [];
  for (let i = 0; i < p.results.length; i += TIRADES_PER_RONDA) {
    rows.push(p.results.slice(i, i + TIRADES_PER_RONDA).map(icon).join(''));
  }
  return `${title} · ${partidaScore(p)} punts\n${rows.join('\n')}`;
}

// ---------- RNG determinista (plantada del dia) ----------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DailyPlan = { pubilles: number[]; wind: number[] };
/** Pla d'una partida a partir d'una llavor: pubilla de cada tirada i vent lateral (m/s²). */
export function planFromSeed(seed: number, windMax = 0.6): DailyPlan {
  const r = mulberry32(seed);
  const pubilles: number[] = [];
  const wind: number[] = [];
  for (let i = 0; i < TOTAL_TIRADES; i++) {
    pubilles.push(Math.floor(r() * 6));
    wind.push((r() * 2 - 1) * windMax);
  }
  return { pubilles, wind };
}
