// Prova de punta a punta en un mòbil simulat: tutorial sencer + partida de 9 tirades + captures.
// Ús: npm run build && npx vite preview --port 4173 &  ;  node scripts/e2e.cjs [url] [carpeta-captures]
const { chromium } = require('playwright');
const URL_ = process.argv[2] || 'http://localhost:4173/';
const OUT = process.argv[3] || 'e2e-shots';
// Paràmetres extra (per defecte '&q=baixa': el render per programari del contenidor és lent).
const Q = process.env.E2E_QUERY ?? '&q=baixa';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  const swipe = async (pts) => { await p.mouse.move(...pts[0]); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(q[0], q[1], { steps: 4 }); await p.mouse.up(); };
  const phase = () => p.evaluate(() => window.__bitlla.S.phase);
  const waitThrow = () => p.waitForFunction(() => window.__bitlla.S.phase !== 'flight', null, { timeout: 240000 });

  await p.goto(URL_ + '?tutorial=0' + Q); await p.waitForSelector('.card');
  await p.screenshot({ path: `${OUT}/01-leccio.png` });
  for (let i = 0; i < 12; i++) {
    if (await p.$('text=Ja saps jugar')) break;
    const btn = await p.$('button:has-text("Som-hi"), button:has-text("Continua")');
    if (!btn) throw new Error('tutorial encallat');
    const txt = await btn.textContent();
    await btn.click(); await p.waitForTimeout(400);
    if (txt !== 'Som-hi') continue;
    for (let k = 0; k < 3 && (await phase()) === 'aim'; k++) { await swipe([[195, 700], [195, 560], [196, 440]]); await waitThrow(); await p.waitForTimeout(800); }
    await p.waitForSelector('.card');
    console.log('lliçó:', await (await p.$('.card h2')).textContent());
    await (await p.$('button:has-text("Següent lliçó"), button:has-text("Salta aquesta lliçó"), button:has-text("Acaba")')).click();
    await p.waitForTimeout(300);
  }
  await p.click('text=Juga una partida');
  for (let guard = 0; guard < 300 && (await phase()) !== 'end'; guard++) {
    if (await p.$('.bitllot-pick[data-k]')) { await p.click('.bitllot-pick[data-k="torcat"]'); await p.waitForTimeout(300); continue; }
    if ((await phase()) === 'aim') {
      const dx = (Math.random() - 0.5) * 60;
      await swipe([[195, 700], [195 + dx / 2, 560], [195 + dx, 380 + Math.random() * 60]]);
      await waitThrow();
      await p.screenshot({ path: `${OUT}/02-tirada.png` });
    }
    await p.waitForTimeout(300);
  }
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/03-final.png` });
  const S = await p.evaluate(() => window.__bitlla.S);
  console.log('tirades:', S.partida.results.length, '·', S.partida.results.map((r) => `${r.label}:${r.total}`).join(' '));
  await b.close();
  if (errors.length || S.partida.results.length !== 9) { console.error('FALLA', errors); process.exit(1); }
  console.log('OK');
})();
