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

import { bitllesEnCami, prediuTrajectoria, zonaDeCaiguda } from '../src/game/physics';
import { PIN_LAYOUT } from '../src/game/constants';

describe('previsió de la trajectòria', () => {
  it('sense efecte, cau on diu launchFromInput', () => {
    const input = { aim: 0.2, power: 0.7, spin: 0 };
    const p = prediuTrajectoria(input, D, BITLLOTS.cinta);
    const l = launchFromInput(input, D, BITLLOTS.cinta);
    expect(Math.abs(p.caiguda.x - l.landing.x)).toBeLessThan(0.08);
    expect(Math.abs(p.caiguda.z - l.landing.z)).toBeLessThan(0.15);
  });
  it('l\'efecte corba cap al costat contrari del signe', () => {
    const recte = prediuTrajectoria({ aim: 0, power: 0.7, spin: 0 }, D, BITLLOTS.torcat);
    const corba = prediuTrajectoria({ aim: 0, power: 0.7, spin: 1 }, D, BITLLOTS.torcat);
    expect(corba.caiguda.x).toBeLessThan(recte.caiguda.x - 0.2);
  });
  it('zones de caiguda', () => {
    expect(zonaDeCaiguda(4)).toBe('curt');
    expect(zonaDeCaiguda(1)).toBe('be');
    expect(zonaDeCaiguda(-1)).toBe('llarg');
  });
  it('un llançament centrat passa per les bitlles del mig', () => {
    const cami = bitllesEnCami(prediuTrajectoria({ aim: 0, power: 0.7, spin: 0 }, D, BITLLOTS.cinta), PIN_LAYOUT);
    expect(cami[1]).toBe(true);
    expect(cami[4]).toBe(true);
  });
});
