const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const { spawn } = require('child_process');
  const srv = spawn('node', [path.join(__dirname, '../scripts/serve.mjs')], { env: { ...process.env, PORT: '5199' }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 600));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errs = [], ext = [];
  await p.route('**/*', r => { const u = r.request().url(); if (!u.startsWith('http://localhost:5199')) { ext.push(u); return r.abort(); } r.continue(); });
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('requestfailed', r => errs.push('failed ' + r.url()));
  await p.goto('http://localhost:5199/');
  await p.waitForFunction(() => window.NMM && window.NMM.game && window.NMM.game.state, null, { timeout: 15000 });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: process.argv[2] + '/s0.png' });
  await p.click('#claimStreak'); await p.waitForTimeout(200); await p.click('#sheet .x'); await p.waitForTimeout(300);
  const box = await p.locator('canvas').boundingBox(); const sx = box.width / 540;
  for (let i = 0; i < 30; i++) { await p.mouse.click(box.x + (120 + (i * 61) % 300) * sx, box.y + 500 * sx); await p.waitForTimeout(470); }
  await p.waitForTimeout(800);
  await p.screenshot({ path: process.argv[2] + '/s1.png' });
  console.log(JSON.stringify(await p.evaluate(() => ({ score: NMM.game.score, pieces: NMM.game.pieces.size, coins: NMM.Save.data.coins, disc: NMM.Save.data.discovered.filter(Boolean).length }))));
  console.log('external requests:', ext, '\nERRORS:', errs);
  await b.close(); srv.kill();
})();
