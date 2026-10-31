// Ajust de dificultat per Monte Carlo: `npm run sim`.
// Simula tirades completes (3 bitllots) amb gestos aleatoris d'un jugador "mitjà" i en mostra la distribució.
import { initPhysics, simulateThrows } from '../src/game/physics';
import { ALL_BITLLOTS, BITLLOTS, baseScore, mulberry32 } from '../src/game/rules';
import { THROW_DISTANCE } from '../src/game/constants';

await initPhysics();
const N = Number(process.env.N ?? 120);
const distance = THROW_DISTANCE[(process.env.CAT as keyof typeof THROW_DISTANCE) ?? 'infantil'] ?? 9.5;
const rnd = mulberry32(7);
const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5; // ~[-1,1]

console.log(`distància ${distance} m · ${N} tirades per bitllot · jugador mitjà (aim±0.5, power 0.75±0.25)`);
const t0 = performance.now();
for (const kind of ALL_BITLLOTS) {
  const spec = BITLLOTS[kind];
  const hist = Array(7).fill(0);
  let pts = 0, early = 0;
  for (let i = 0; i < N; i++) {
    const throws = [0, 1, 2].map(() => ({ input: { aim: gauss() * 0.5, power: 0.75 + gauss() * 0.25, spin: gauss() * 0.5 }, spec }));
    const after = simulateThrows(distance, throws);
    const idx = after.findIndex((d) => d.filter(Boolean).length >= 5);
    const final = idx >= 0 ? after[idx] : after[2];
    if (idx >= 0 && idx < 2) early++;
    const k = final.filter(Boolean).length;
    hist[k]++; pts += baseScore(k);
  }
  const pct = (n: number) => `${((100 * n) / N).toFixed(0)}%`.padStart(4);
  console.log(`${spec.name.padEnd(10)} 0..6: ${hist.map(pct).join(' ')} · bitlla ${pct(hist[5])} · llenya ${pct(hist[6])} · mitjana ${(pts / N).toFixed(2)} · bitlla abans del 3r ${pct(early)}`);
}
console.log(`${((performance.now() - t0) / 1000).toFixed(1)} s`);
