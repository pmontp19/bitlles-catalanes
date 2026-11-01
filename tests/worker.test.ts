import { describe, expect, it } from 'vitest';
import { dailySeed } from '../src/game/diaria';

describe('plantada del dia', () => {
  it('la llavor és estable per dia i canvia entre dies', () => {
    expect(dailySeed('2026-10-31')).toBe(dailySeed('2026-10-31'));
    expect(dailySeed('2026-10-31')).not.toBe(dailySeed('2026-11-01'));
  });
});
