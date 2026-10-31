const { chromium } = require('playwright');
const out = process.argv[2]; const startDay = +(process.argv[3]||1);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: +(process.argv[4]||844) }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('http://localhost:8787/');
  await p.waitForTimeout(400);
  const box = await p.locator('canvas').boundingBox();
  const H = box.height/box.width*216;
  const L = (x, y) => [box.x + x / 216 * box.width, box.y + y / H * box.height];
  const st = () => p.evaluate(() => { const s = window.__bitlles.state; return {m:s.mode,ph:s.phase,mo:s.modal,d:s.day,t:s.tirada,ti:s.throwIdx,money:s.game&&s.game.money}; });
  const tapAt = async (x,y) => { const [a,c]=L(x,y); await p.mouse.move(a,c); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(120); };
  await p.evaluate(n => window.__bitlles.skipTo(n), startDay);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/d${startDay}-news.png` });
  await tapAt(100, 200);
  let shots = 0;
  for (let it = 0; it < 80; it++) {
    const s = await st();
    if (s.m === 'ledger') { await p.screenshot({ path: `${out}/d${startDay}-ledger.png` }); break; }
    if (s.m !== 'play') { await tapAt(108, 200); continue; }
    if (s.mo) {
      if (shots < 3) { await p.screenshot({ path: `${out}/d${startDay}-modal${shots++}.png` }); }
      // close / accept: use exposed close
      await p.evaluate(() => window.__bitlles.closeModal());
      await p.waitForTimeout(700);
      continue;
    }
    if (s.ph === 'aim') {
      const [sx, sy] = L(40, H-200); 
      const ang = (Math.random()-0.5)*0.4; const len = 70 + Math.random()*30;
      const dx = Math.cos(-0.4636+ang)*len, dy = Math.sin(-0.4636+ang)*len;
      await p.mouse.move(sx, sy); await p.mouse.down();
      if (startDay>1) for (let i=0;i<16;i++){ const a=i/16*Math.PI*2; await p.mouse.move(sx+Math.cos(a)*30, sy+Math.sin(a)*30); }
      for (let i=1;i<=8;i++){ const [x,y]=L(40+dx*i/8, H-200+dy*i/8); await p.mouse.move(x,y); await p.waitForTimeout(16);} 
      if (it===1) await p.screenshot({ path: `${out}/d${startDay}-aim.png` });
      await p.mouse.up();
      await p.waitForTimeout(500);
      if (it===1) await p.screenshot({ path: `${out}/d${startDay}-sim.png` });
      continue;
    }
    if (s.ph === 'result' && shots < 6) { await p.waitForTimeout(400); await p.screenshot({ path: `${out}/d${startDay}-result${shots++}.png` }); }
    await p.waitForTimeout(300);
  }
  console.log(JSON.stringify(await st()));
  console.log('ERRS', errs);
  await b.close();
})();
