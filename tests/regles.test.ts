import { describe, expect, it } from 'vitest';
import { PAGINES, questionari } from '../src/game/regles';

describe('llibret de regles', () => {
  it('té pàgines amb títol i contingut', () => {
    expect(PAGINES.length).toBeGreaterThanOrEqual(6);
    for (const p of PAGINES) { expect(p.title).toBeTruthy(); expect(p.html.length).toBeGreaterThan(50); }
  });

  it('el qüestionari és determinista i coherent', () => {
    for (let seed = 1; seed < 60; seed++) {
      const q = questionari(seed);
      expect(q).toEqual(questionari(seed));
      expect(q).toHaveLength(5);
      for (const p of q) {
        expect(p.correct).toBeGreaterThanOrEqual(0);
        expect(p.correct).toBeLessThan(p.options.length);
        expect(new Set(p.options).size).toBe(p.options.length);
      }
      // La primera pregunta sempre és la trampa: bitlla (10) o llenya (6).
      expect(['10', '6']).toContain(q[0].options[q[0].correct]);
    }
  });

  it('les respostes de punts segueixen la taula oficial', () => {
    const q = questionari(3)[0];
    const knocked = (q.html.match(/opacity="\.55"/g) ?? []).length / 2;
    const expected = knocked === 5 ? '10' : String(knocked);
    expect(q.options[q.correct]).toBe(expected);
  });
});
