const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('http://localhost:8787/');
  await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/1-title.png' });
  const box = await p.locator('canvas').boundingBox();
  const L = (x, y) => [box.x + x / 216 * box.width, box.y + y / (box.height/box.width*216) * box.height];
  const H = box.height/box.width*216;
  console.log('H internal', H);
  const tapAt = async (x,y) => { const [a,c]=L(x,y); await p.mouse.move(a,c); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(150); };
  // nova partida
  await p.evaluate(() => window.__bitlles.newGame());
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/2-news.png' });
  await tapAt(100, 200);
  await p.waitForTimeout(1300);
  await p.screenshot({ path: out + '/3-tut.png' });
  console.log(JSON.stringify((await p.evaluate(() => window.__bitlles.state)).modal));
  // close tut
  await p.evaluate(() => { });
  const st = await p.evaluate(() => window.__bitlles.state);
  console.log(st.mode, st.phase, st.modal);
  // press ENTESOS: find by tapping center bottom of modal — just evaluate close
  await p.evaluate(() => { const s = window.__bitlles; });
  for (let k=0;k<3;k++){
    const s2 = await p.evaluate(() => window.__bitlles.state);
    if (!s2.modal) break;
    // tap all candidate positions for buttons
    await tapAt(108, H/2 + 40); await tapAt(108, H/2+50); await tapAt(108,H/2+60);
  }
  console.log(JSON.stringify(await p.evaluate(() => { const s = window.__bitlles.state; return {m:s.mode,ph:s.phase,mo:s.modal}; })));
  // drag throw
  const [sx, sy] = L(50, 200); const [ex, ey] = L(50+60, 200-30);
  await p.mouse.move(sx, sy); await p.mouse.down();
  for (let i=1;i<=10;i++){ await p.mouse.move(sx+(ex-sx)*i/10, sy+(ey-sy)*i/10); await p.waitForTimeout(16);} 
  await p.screenshot({ path: out + '/4-aim.png' });
  await p.mouse.up();
  await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/5-sim.png' });
  await p.waitForTimeout(2200);
  await p.screenshot({ path: out + '/6-after.png' });
  console.log(JSON.stringify(await p.evaluate(() => { const s = window.__bitlles.state; return {m:s.mode,ph:s.phase,mo:s.modal,t:s.tirada,ti:s.throwIdx}; })));
  console.log('ERRS', errs);
  await b.close();
})();
