import { describe, expect, it } from 'vitest';
import {
  baseScore, isKnocked, multiplierFromSaved, newPartida, partidaScore, planFromSeed, pushResult, scoreTirada, shareText, tiradaOver,
} from '../src/game/rules';

const rot = (deg: number) => { const a = (deg * Math.PI) / 180 / 2; return { x: 0, y: 0, z: Math.sin(a), w: Math.cos(a) }; };

describe('reglament', () => {
  it('taula de puntuació oficial', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(baseScore)).toEqual([0, 1, 2, 3, 4, 10, 6]);
  });

  it('tombada per sota de 45° amb l\'horitzontal', () => {
    expect(isKnocked(rot(0))).toBe(false);
    expect(isKnocked(rot(44))).toBe(false); // 46° amb l'horitzontal
    expect(isKnocked(rot(46))).toBe(true); // 44° amb l'horitzontal
    expect(isKnocked(rot(90))).toBe(true);
  });

  it('bitlla amb el 1r o 2n bitllot acaba la tirada', () => {
    const five = [true, true, true, true, true, false];
    expect(tiradaOver(five, 1)).toBe(true);
    expect(tiradaOver([true, false, false, false, false, false], 2)).toBe(false);
    expect(tiradaOver([true, false, false, false, false, false], 3)).toBe(true);
  });

  it('pubilla dreta = bitlla d\'or (doble)', () => {
    const r = scoreTirada([true, true, true, true, true, false], 5, 2);
    expect(r.bitllaOr).toBe(true);
    expect(r.total).toBe(20);
    expect(r.saved).toBe(1);
    const r2 = scoreTirada([true, true, true, true, true, false], 1, 3);
    expect(r2.bitllaOr).toBe(false);
    expect(r2.total).toBe(10);
  });

  it('llenya val 6 i no estalvia bitllots', () => {
    const r = scoreTirada([true, true, true, true, true, true], 0, 1);
    expect(r.label).toBe('llenya');
    expect(r.total).toBe(6);
    expect(r.saved).toBe(0);
  });

  it('bitllots estalviats multipliquen la tirada següent', () => {
    expect(multiplierFromSaved(2)).toBe(2);
    let p = newPartida();
    p = pushResult(p, scoreTirada([true, true, true, true, true, false], null, 1));
    expect(p.nextMultiplier).toBe(2);
    p = pushResult(p, scoreTirada([true, true, true, false, false, false], null, 3, p.nextMultiplier));
    expect(partidaScore(p)).toBe(16);
    expect(p.nextMultiplier).toBe(1);
  });

  it('plantada del dia determinista', () => {
    expect(planFromSeed(42)).toEqual(planFromSeed(42));
    expect(planFromSeed(42).pubilles).toHaveLength(9);
  });

  it('text per compartir', () => {
    let p = newPartida();
    p = pushResult(p, scoreTirada([true, true, true, true, true, false], 5, 3));
    p = pushResult(p, scoreTirada([true, true, true, true, true, true], 5, 3));
    p = pushResult(p, scoreTirada([false, false, false, false, false, false], 5, 3));
    expect(shareText(p, 'Bitlla!')).toBe('Bitlla! · 26 punts\n🌟🪵⬛');
  });
});
