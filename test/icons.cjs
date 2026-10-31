const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:8787/');
  for (const s of [192, 512]) {
    await p.setViewportSize({ width: s, height: s });
    await p.setContent(`<style>body{margin:0}</style><img src="http://localhost:8787/icon.svg" style="width:${s}px;height:${s}px;image-rendering:pixelated">`);
    await p.waitForTimeout(200);
    await p.screenshot({ path: `public/icon-${s}.png` });
  }
  await b.close();
})();
