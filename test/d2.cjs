const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8787/'); await p.waitForTimeout(300);
  const box = await p.locator('canvas').boundingBox(); const H = box.height/box.width*216;
  const L = (x, y) => [box.x + x / 216 * box.width, box.y + y / H * box.height];
  await p.evaluate(() => { Math.random = (()=>{let s=7;return()=>{s=(s*16807)%2147483647;return s/2147483647;};})(); window.__bitlles.skipTo(3); });
  await p.waitForTimeout(200);
  let [a,c]=L(100,200); await p.mouse.click(a,c); await p.waitForTimeout(1200);
  for (let i=0;i<4;i++){ const s=await p.evaluate(()=>window.__bitlles.state); if(!s.modal) break; if (s.modal==='order'){ await p.screenshot({path:out+'/order.png'}); }
    await p.evaluate(()=>window.__bitlles.closeModal()); await p.waitForTimeout(800);}
  const [sx,sy]=L(60,H-190); await p.mouse.move(sx,sy); await p.mouse.down();
  for (let i=0;i<=24;i++){ const t=i/24*Math.PI*4; await p.mouse.move(sx+Math.cos(t)*40, sy+Math.sin(t)*40); await p.waitForTimeout(10);} 
  for (let i=1;i<=8;i++){ const [x,y]=L(60+i*9,H-190-i*4.5); await p.mouse.move(x,y); await p.waitForTimeout(16);} 
  await p.waitForTimeout(100);
  await p.screenshot({path:out+'/spin.png'});
  await p.mouse.up(); await p.waitForTimeout(450); await p.screenshot({path:out+'/spin2.png'});
  console.log(errs);
  await b.close();
})();
