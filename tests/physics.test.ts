import { beforeAll, describe, expect, it } from 'vitest';
import { Field, initPhysics, launchFromInput, simulateThrows } from '../src/game/physics';
import { BITLLOTS } from '../src/game/rules';
import { THROW_DISTANCE } from '../src/game/constants';

beforeAll(async () => { await initPhysics(); });

const D = THROW_DISTANCE.infantil;

describe('física', () => {
  it('les bitlles plantades es queden dretes soles', () => {
    const f = new Field(D);
    f.plant();
    for (let i = 0; i < 120 * 3; i++) f.step();
    expect(f.down().filter(Boolean).length).toBe(0);
    expect(Math.max(...f.tilts())).toBeLessThan(2);
    f.free();
  });

  it('la punteria i la força porten el bitllot on diu la previsió', () => {
    const l = launchFromInput({ aim: 0, power: 0.75, spin: 0 }, D, BITLLOTS.cinta);
    expect(Math.abs(l.landing.x)).toBeLessThan(0.01);
    expect(l.landing.z).toBeGreaterThan(-0.5);
    expect(l.landing.z).toBeLessThan(1.5);
  });

  it('un llançament centrat i ben dosificat tomba bitlles', () => {
    const [down] = simulateThrows(D, [{ input: { aim: 0, power: 0.75, spin: 0 }, spec: BITLLOTS.alzina }]);
    expect(down.filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });

  it('un llançament molt curt no arriba', () => {
    const [down] = simulateThrows(D, [{ input: { aim: 0, power: 0, spin: 0 }, spec: BITLLOTS.cinta }]);
    expect(down.filter(Boolean).length).toBe(0);
  });

  it('és determinista', () => {
    const t = [{ input: { aim: 0.2, power: 0.7, spin: 0.4 }, spec: BITLLOTS.boix }];
    expect(simulateThrows(D, t)).toEqual(simulateThrows(D, t));
  });

  it('les bitlles absents compten com a tombades', () => {
    const [down] = simulateThrows(D, [{ input: { aim: 0, power: 0, spin: 0 }, spec: BITLLOTS.cinta }], {
      present: [false, true, false, true, true, true],
    });
    expect(down).toEqual([true, false, true, false, false, false]);
  });
});
