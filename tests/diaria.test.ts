import { describe, expect, it } from 'vitest';
import { dailyDate, dailyPlan, minutsFinsDema, netejaAlies, ordinal, verificaPartida, type TiradaEnviada } from '../src/game/diaria';

const DATE = '2026-11-01';
const plan = dailyPlan(DATE);
const bitllaDeixant = (i: number) => [0, 1, 2, 3, 4, 5].map((k) => k !== i);
const tres = (n: number): TiradaEnviada => ({ down: [0, 1, 2, 3, 4, 5].map((k) => k < n), used: 3 });

describe('plantada del dia', () => {
  it('la data és la de Catalunya, no la UTC', () => {
    // 23:30 UTC del 31 d'octubre ja és 1 de novembre a Catalunya (UTC+1 a l'hivern).
    expect(dailyDate(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01');
    expect(dailyDate(new Date('2026-11-01T22:59:00Z'))).toBe('2026-11-01');
    expect(dailyDate(new Date('2026-11-01T23:01:00Z'))).toBe('2026-11-02');
  });

  it('compte enrere fins a la mitjanit de Catalunya', () => {
    expect(minutsFinsDema(new Date('2026-11-01T22:00:00Z'))).toBe(60);
  });

  it('recalcula la puntuació amb la pubilla real del dia', () => {
    // Totes les tirades: bitlla amb el primer bitllot deixant dreta la pubilla → bitlla d'or i bitllots estalviats.
    const tirades = plan.pubilles.map((p) => ({ down: bitllaDeixant(p), used: 1 }));
    const v = verificaPartida(DATE, tirades);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.bitlles).toBe(9);
      // 1a: 20; següents: 20 × 2 (dos bitllots estalviats) = 40.
      expect(v.total).toBe(20 + 8 * 40);
    }
  });

  it('una bitlla que no deixa dreta la pubilla no és d\'or', () => {
    const tirades = plan.pubilles.map((p) => ({ down: bitllaDeixant((p + 1) % 6), used: 3 }));
    const v = verificaPartida(DATE, tirades);
    expect(v.ok && v.total).toBe(90);
  });

  it('rebutja partides impossibles', () => {
    expect(verificaPartida(DATE, []).ok).toBe(false);
    expect(verificaPartida(DATE, Array(9).fill(tres(3))).ok).toBe(true);
    // Acabar amb un bitllot sense haver fet bitlla ni llenya no és possible.
    expect(verificaPartida(DATE, [...Array(8).fill(tres(3)), { down: tres(2).down, used: 1 }]).ok).toBe(false);
    expect(verificaPartida(DATE, [...Array(8).fill(tres(3)), { down: [true, true], used: 3 }]).ok).toBe(false);
    expect(verificaPartida(DATE, [...Array(8).fill(tres(3)), { down: tres(3).down, used: 4 }]).ok).toBe(false);
  });

  it('neteja l\'àlies', () => {
    expect(netejaAlies('  Pere   de <b>Vilanova</b>  ')).toBe('Pere de bVilanova/b');
    expect(netejaAlies('x')).toBeNull();
    expect(netejaAlies(42)).toBeNull();
    expect(netejaAlies('a'.repeat(40))).toHaveLength(20);
  });

  it('ordinals en català', () => {
    expect([1, 2, 3, 4, 5, 11, 21].map(ordinal)).toEqual(['1r', '2n', '3r', '4t', '5è', '11è', '21è']);
  });
});
