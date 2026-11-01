// Plantada del dia: lògica compartida entre el joc (navegador) i el Worker (servidor).
// Pura: sense DOM ni física. El servidor la fa servir per recalcular puntuacions i no fiar-se del client.
import { BITLLOTS_PER_TIRADA } from './constants';
import { newPartida, partidaScore, planFromSeed, pushResult, scoreTirada, TOTAL_TIRADES, type Partida } from './rules';

export const ZONA = 'Europe/Madrid';

/** Data del dia (AAAA-MM-DD) a l'hora de Catalunya: la plantada canvia a mitjanit d'aquí. */
export function dailyDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Minuts que falten per a la propera mitjanit a Catalunya. */
export function minutsFinsDema(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return 24 * 60 - (h * 60 + m);
}

/** Llavor estable per dia, igual per a tothom. */
export function dailySeed(date: string): number {
  let h = 2166136261;
  for (const c of `bitlla:${date}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export const dailyPlan = (date: string) => planFromSeed(dailySeed(date));

/** El que el client envia de cada tirada: quines bitlles han quedat tombades i quants bitllots ha llançat. */
export type TiradaEnviada = { down: boolean[]; used: number };

export type Verificacio = { ok: true; total: number; bitlles: number; partida: Partida } | { ok: false; error: string };

/**
 * Recalcula una partida de la plantada del dia a partir de les tirades enviades.
 * Comprova que cada tirada sigui possible segons el reglament (una tirada només s'acaba abans
 * del tercer bitllot si s'ha fet bitlla o llenya) i aplica la pubilla real del dia.
 */
export function verificaPartida(date: string, tirades: unknown): Verificacio {
  if (!Array.isArray(tirades) || tirades.length !== TOTAL_TIRADES) return { ok: false, error: `Calen ${TOTAL_TIRADES} tirades` };
  const plan = dailyPlan(date);
  let p = newPartida();
  for (let i = 0; i < tirades.length; i++) {
    const t = tirades[i] as Partial<TiradaEnviada>;
    if (!t || !Array.isArray(t.down) || t.down.length !== 6 || !t.down.every((d) => typeof d === 'boolean')) return { ok: false, error: `Tirada ${i + 1}: bitlles no vàlides` };
    if (!Number.isInteger(t.used) || t.used! < 1 || t.used! > BITLLOTS_PER_TIRADA) return { ok: false, error: `Tirada ${i + 1}: bitllots no vàlids` };
    const knocked = t.down.filter(Boolean).length;
    if (t.used! < BITLLOTS_PER_TIRADA && knocked < 5) return { ok: false, error: `Tirada ${i + 1}: acabada abans d'hora` };
    p = pushResult(p, scoreTirada(t.down, plan.pubilles[i], t.used!, p.nextMultiplier));
  }
  return { ok: true, total: partidaScore(p), bitlles: p.results.filter((r) => r.knocked === 5).length, partida: p };
}

/** Àlies net: 2-20 caràcters, sense salts de línia ni etiquetes. */
export function netejaAlies(nom: unknown): string | null {
  if (typeof nom !== 'string') return null;
  const n = nom.replace(/[<>\n\r\t]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return n.length >= 2 ? n : null;
}

/** Ordinal en català: 1r, 2n, 3r, 4t, 5è... */
export function ordinal(n: number): string {
  return `${n}${n === 1 || n === 3 ? 'r' : n === 2 ? 'n' : n === 4 ? 't' : 'è'}`;
}
