import { describe, expect, it } from 'vitest';
import { gestureToInput } from '../src/game/input';

const H = 800;
describe('gest', () => {
  it('recte cap amunt: punteria 0, sense efecte', () => {
    const g = gestureToInput([{ x: 200, y: 700 }, { x: 200, y: 550 }, { x: 200, y: 400 }], H);
    expect(g.valid).toBe(true);
    expect(g.aim).toBeCloseTo(0);
    expect(g.spin).toBe(0);
    expect(g.power).toBeGreaterThan(0.6);
  });
  it('inclinat a la dreta apunta a la dreta', () => {
    expect(gestureToInput([{ x: 200, y: 700 }, { x: 300, y: 400 }], H).aim).toBeGreaterThan(0.5);
  });
  it('corba cap a la dreta dona efecte positiu (el bitllot es desvia a l\'esquerra)', () => {
    const g = gestureToInput([{ x: 200, y: 700 }, { x: 250, y: 600 }, { x: 260, y: 520 }, { x: 200, y: 400 }], H);
    expect(g.spin).toBeGreaterThan(0.5);
  });
  it('un toc no és un llançament', () => {
    expect(gestureToInput([{ x: 200, y: 700 }, { x: 201, y: 690 }], H).valid).toBe(false);
  });
});
