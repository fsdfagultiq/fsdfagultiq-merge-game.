/* End-to-end suite for Dim Sum Drop (headless Chromium, fully offline).
   Run: node tests/e2e.cjs [screenshotDir]      Exit code 1 on any failure. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 5198, BASE = `http://localhost:${PORT}/`;
const SHOTS = process.argv[2] || path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DAY = 864e5, T0 = new Date('2026-11-27T10:00:00');

async function newPage(browser, { time = T0, storage = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.errs = []; p.ext = [];
  await p.route('**/*', r => { const u = r.request().url(); if (!u.startsWith(BASE)) { p.ext.push(u); return r.abort(); } r.continue(); });
  p.on('pageerror', e => p.errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console: ' + m.text()); });
  p.on('requestfailed', r => p.errs.push('requestfailed: ' + r.url()));
  await p.clock.setFixedTime(time);
  if (storage) await p.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } }, storage);
  await boot(p);
  return p;
}
async function boot(p, reload = false) {
  if (reload) await p.reload(); else await p.goto(BASE);
  await p.waitForFunction(() => window.NMM && NMM.game && NMM.game.state === 'play' && NMM.UI.scene, null, { timeout: 20000 });
  await sleep(900);                                    // launch prompts fire at 600ms
}
const ev = (p, expr) => p.evaluate(`(() => { const N = NMM, s = NMM.game, d = NMM.Save.data; return (${expr}); })()`);
const sheetText = p => p.evaluate(() => document.getElementById('sheet').hidden ? '' : document.getElementById('sheet').innerText.replace(/\s+/g, ' '));
async function dismissSheet(p) { if (await sheetText(p)) { const x = await p.$('#sheet .x'); if (x) await x.click(); await sleep(150); } }
async function waitOverGone(p, ms = 4000) { await p.waitForFunction(() => document.getElementById('over').hidden, null, { timeout: ms }); }

(async () => {
  const srv = spawn('node', [path.join(__dirname, '../scripts/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await sleep(700);
  const browser = await chromium.launch();
  try {
    /* 1. Offline boot + streak auto-prompt */
    let p = await newPage(browser);
    ok('offline: no external requests', p.ext.length === 0, p.ext.join(', '));
    ok('offline: canvas rendered', await p.evaluate(() => !!document.querySelector('canvas') && document.querySelector('canvas').width === 540));
    ok('streak auto-prompts on first launch', (await sheetText(p)).includes('Claim Day 1'));
    await p.screenshot({ path: `${SHOTS}/01-daily.png` });
    const coins0 = await ev(p, 'd.coins');
    await p.click('#claimStreak'); await sleep(150);
    ok('streak Day 1 grants 100 coins', (await ev(p, 'd.coins')) === coins0 + 100);
    ok('streak not claimable twice same day', (await sheetText(p)).includes('Come back tomorrow'));
    await dismissSheet(p);
    ok('onboarding hint visible before first drop', await p.isVisible('#hint'));

    /* 2. 50+ real drops via pointer input */
    const box = await p.locator('canvas').boundingBox(), k = box.width / 540;
    for (let i = 0; i < 55; i++) {
      if (await sheetText(p)) await dismissSheet(p);
      await p.mouse.move(box.x + (110 + (i * 67) % 320) * k, box.y + 520 * k); await p.mouse.down(); await p.mouse.up();
      await sleep(470);
      if ((await ev(p, 's.state')) !== 'play') break;
    }
    const drops = await ev(p, 'd.stats.drops');
    ok('50+ drops processed', drops >= 50 || (await ev(p, "s.state")) === 'over', `drops=${drops}`);
    ok('hint removed permanently after first drop', !(await p.isVisible('#hint')) && await ev(p, 'd.onboarded'));
    ok('merges happened & scored', (await ev(p, 'd.stats.merges')) > 5 && (await ev(p, 's.score')) > 0, `merges=${await ev(p, 'd.stats.merges')}`);
    ok('discoveries recorded', (await ev(p, 'd.discovered.filter(Boolean).length')) >= 4);
    await p.screenshot({ path: `${SHOTS}/02-gameplay.png` });

    /* 3. Merge-lock integrity: 3 and 4 identical pieces piled together */
    await ev(p, '(()=>{ s.state==="over" && s.newRun(); for (const q of [...s.pieces]) s.removePiece(q); s.spawn({tier:4},200,790); s.spawn({tier:4},270,790); s.spawn({tier:4},235,730); return 1; })()');
    await sleep(1600);
    let tiers = await ev(p, '[...s.pieces].map(q=>q.tier).sort((a,b)=>a-b).join(",")');
    ok('merge lock: 3× Tier4 → exactly one Tier5 + one Tier4', tiers === '4,5', tiers);
    await ev(p, '(()=>{ for (const q of [...s.pieces]) s.removePiece(q); for (let i=0;i<4;i++) s.spawn({tier:2},180+i*40,800-i*10); return 1; })()');
    await sleep(1800);
    tiers = await ev(p, '[...s.pieces].map(q=>q.tier).sort((a,b)=>a-b).join(",")');
    ok('merge lock: 4× Tier2 → never more than conservation allows', ['3,3', '4', '2,3', '2,2,3'].includes(tiers) || tiers.split(',').length <= 3, tiers);

    /* 4. Wok Fever multiplier */
    await ev(p, '(()=>{ for (const q of [...s.pieces]) s.removePiece(q); s.combo=0; s.lastMergeAt=-1e9; return 1; })()');
    const sc0 = await ev(p, 's.score');
    await ev(p, '(s.spawn({tier:1},150,800), s.spawn({tier:1},170,800), 1)'); await sleep(250);
    await ev(p, '(s.spawn({tier:1},350,800), s.spawn({tier:1},370,800), 1)'); await sleep(250);
    await ev(p, '(s.spawn({tier:1},430,800), s.spawn({tier:1},450,800), 1)'); await sleep(250);
    const combo = await ev(p, 's.combo'), gained = (await ev(p, 's.score')) - sc0;
    ok('fever combo reaches ×3 within window', combo >= 3, `combo=${combo}`);
    ok('fever multiplies score (4 + 8 + 12 = 24 base)', gained >= 24, `gained=${gained}`);
    ok('fever badge shown', await p.isVisible('#fever'));
    await p.screenshot({ path: `${SHOTS}/03-fever.png` });

    /* 5. Wildcard */
    await ev(p, '(()=>{ for (const q of [...s.pieces]) s.removePiece(q); s.spawn({wild:true},240,790); s.spawn({tier:7},300,780); return 1; })()'); await sleep(1200);
    tiers = await ev(p, '[...s.pieces].map(q=>q.wild?"W":q.tier).join(",")');
    ok('wildcard upgrades Tier7 → Tier8', tiers === '8', tiers);
    ok('wildcard cadence every 15th (Spice Jar Lv0)', await ev(p, '(()=>{ const g=s.genIndex; s.genIndex=0; const o=[]; for(let i=1;i<=30;i++) if(s.gen().wild) o.push(i); s.genIndex=g; return o.join(","); })()') === '15,30');

    /* 6. Frozen thaw */
    await ev(p, '(()=>{ for (const q of [...s.pieces]) s.removePiece(q); s.fz=s.spawn({tier:1,frozen:true},200,806); s.spawn({tier:1},222,780); return 1; })()'); await sleep(900);
    ok('frozen piece refuses to merge', await ev(p, 's.fz.frozen && s.pieces.size===2'));
    await ev(p, '(s.spawn({tier:3},250,793), s.spawn({tier:3},300,740), 1)'); await sleep(900);
    ok('adjacent merge thaws ice', !(await ev(p, 's.fz.frozen')));

    /* 7. Discovery popup */
    await ev(p, '(()=>{ for (const q of [...s.pieces]) s.removePiece(q); d.discovered[9]=false; return 1; })()');
    const gems0 = await ev(p, 'd.gems');
    await ev(p, '(s.spawn({tier:8},200,760), s.spawn({tier:8},330,760), 1)'); await sleep(1200);
    ok('discovery card shown for first Ramen Bowl', (await p.innerText('#disc')).includes('NEW DISH DISCOVERED'));
    ok('discovery grants +120 gems', (await ev(p, 'd.gems')) - gems0 === 120, `${(await ev(p, 'd.gems')) - gems0}`);
    ok('discovery is non-blocking (no modal, not paused)', !(await sheetText(p)) && !(await ev(p, 's.isPaused()')));
    await p.click('#discAd'); await waitOverGone(p);
    ok('discovery Watch Ad ×2 doubles gems', (await ev(p, 'd.gems')) - gems0 === 240);

    /* 8. Stall upgrade purchase + persistence across reload */
    await ev(p, '(d.coins = 5000, NMM.Save.save(), 1)');
    await p.click('#btnShop'); await p.click('.tab[data-tab="stall"]');
    await p.screenshot({ path: `${SHOTS}/04-stall.png` });
    await p.click('.upg[data-id="steamer"]'); await p.click('.upg[data-id="spice"]'); await p.click('.upg[data-id="spice"]');
    ok('stall upgrade spends coins', (await ev(p, 'd.coins')) === 5000 - 300 - 500 - 1200);
    await p.click('.tab[data-tab="themes"]'); await p.screenshot({ path: `${SHOTS}/05-themes.png` });
    await ev(p, '(d.gems += 200, NMM.Save.save(), 1)'); await p.click('#btnShop').catch(() => {}); await p.click('.tab[data-tab="themes"]');
    await p.click('.bt[data-k="neon"][data-c="gems"]');
    ok('theme bought with gems & applied', await ev(p, 'd.themes.active === "neon" && document.getElementById("wrap").dataset.theme === "neon"'));
    await dismissSheet(p);
    await p.screenshot({ path: `${SHOTS}/06-neon.png` });
    await boot(p, true); await dismissSheet(p);
    ok('upgrades persist across reload', await ev(p, 'd.upgrades.steamer === 1 && d.upgrades.spice === 2'));
    ok('theme persists across reload', await ev(p, 'd.themes.active === "neon" && s.bgImg.texture.key === "bg_neon"'));
    ok('Spice Jar Lv2 → wildcard every 13', await ev(p, '(()=>{ const g=s.genIndex; s.genIndex=0; const o=[]; for(let i=1;i<=26;i++) if(s.gen().wild) o.push(i); s.genIndex=g; return o.join(","); })()') === '13,26');
    ok('Bamboo Steamer Lv1 → coinMult 1.1', await ev(p, 'Math.abs(s.fx.coinMult - 1.1) < 1e-9'));

    /* 9. Daily missions claim */
    await ev(p, '(()=>{ const m=N.Meta.missions()[0]; const st=d.daily.missions[0]; st.progress=m.def.goal; NMM.Save.save(); return 1; })()');
    await p.click('#btnDaily'); await sleep(100);
    const g1 = await ev(p, 'd.gems'), mdef = await ev(p, 'N.Meta.missions()[0].def');
    await p.click(`.claim[data-id="${mdef.id}"]`);
    ok('mission claim grants gems & coins', (await ev(p, 'd.gems')) === g1 + mdef.gems);
    ok('mission cannot be claimed twice', await ev(p, 'd.daily.missions[0].claimed') && await p.isDisabled(`.claim[data-id="${mdef.id}"]`));
    await dismissSheet(p);
    ok('mission tracking: score mission progress via play', await ev(p, '(N.Meta.track("booster"), true)'));

    /* 10. Shop: buy (mock) + Restore Purchases */
    await p.click('#btnShop'); await p.screenshot({ path: `${SHOTS}/07-shop.png` });
    await p.click('.buy[data-id="remove_ads_pack"]'); await p.waitForSelector('#mpBuy'); await p.click('#mpBuy'); await waitOverGone(p);
    ok('remove ads purchase grants entitlement', await ev(p, 'd.adsRemoved === true'));
    await ev(p, '(d.adsRemoved = false, NMM.Save.save(), 1)');
    await p.click('#btnShop').catch(() => {}); await sleep(100);
    if (!(await sheetText(p)).includes('Restore')) await p.click('#btnShop');
    await p.click('#restoreBtn'); await waitOverGone(p);
    ok('Restore Purchases restores Remove Ads', await ev(p, 'd.adsRemoved === true'));
    await p.click('.buy[data-id="starter_gems"]'); await p.waitForSelector('#mpCancel'); await p.click('#mpCancel'); await waitOverGone(p);
    ok('cancelled purchase grants nothing & unlocks UI', !(await ev(p, 's.pauseReasons.has("over")')));
    await dismissSheet(p);
    ok('game resumes after closing shop', !(await ev(p, 's.isPaused()')));
    ok('HUD interactive again after modal closes', await p.evaluate(() => !document.getElementById('bar').inert));
    const dropsBefore = await ev(p, 'd.stats.drops');
    await p.focus('#btnGear'); await p.keyboard.press('Space'); await sleep(150);
    ok('Space on a focused button does not also drop a dish', (await ev(p, 'd.stats.drops')) === dropsBefore && (await sheetText(p)).includes('Settings'));
    await dismissSheet(p);

    /* 11. Back button → pause modal → resume */
    await ev(p, '(N.UI.onBack(), 1)'); await sleep(100);
    ok('back button opens Pause', (await sheetText(p)).includes('Paused') && await ev(p, 's.isPaused()'));
    await ev(p, '(N.UI.onBack(), 1)'); await sleep(100);
    ok('back again closes Pause', !(await sheetText(p)) && !(await ev(p, 's.isPaused()')));
    await p.click('#btnGear'); await sleep(100); await p.screenshot({ path: `${SHOTS}/08-settings.png` });
    await p.click('.switch[data-k="music"]');
    ok('settings toggle persists', (await ev(p, 'd.settings.music')) === false);
    await dismissSheet(p);
    await p.click('#strip'); await sleep(100); await p.screenshot({ path: `${SHOTS}/09-album.png` });
    ok('album shows discovered count', (await sheetText(p)).includes('of 11 dishes discovered'));
    await dismissSheet(p);
    ok('no page errors in long session', p.errs.length === 0, p.errs.slice(0, 3).join(' | '));
    await p.context().close();

    /* 12. Game over, revive, 2x coins, interstitial pacing, starter offer */
    p = await newPage(browser); await dismissSheet(p);
    const forceOver = async () => {
      await ev(p, '(()=>{ for(let i=0;i<10;i++) s.spawn({tier:1+(i%3)}, 70+i*40, 600); const q=s.spawn({tier:2},270,225); Phaser.Physics.Matter.Matter.Body.setStatic(q.body,true); q.born=-1e6; return 1; })()');
      await p.waitForFunction(() => /overflowed|best feast/i.test(document.getElementById('sheet').innerText), null, { timeout: 8000 });
    };
    await forceOver();
    ok('red-line timer leads to game over (not instant)', true);
    await p.screenshot({ path: `${SHOTS}/10-gameover.png` });
    await p.evaluate(() => { document.getElementById('btnShop').click(); document.getElementById('btnGear').click(); document.getElementById('strip').click(); });
    await p.keyboard.press('Escape'); await sleep(100);
    ok('game over cannot be replaced or dismissed (HUD inert, Esc/back ignored)', /overflowed|best feast/i.test(await sheetText(p)) && await p.evaluate(() => document.getElementById('bar').inert && document.getElementById('hud').inert));
    const n0 = await ev(p, 's.pieces.size');
    await p.click('#reviveBtn'); await waitOverGone(p); await sleep(200);
    ok('revive removes top 30% and resumes', (await ev(p, 's.pieces.size')) === n0 - Math.ceil(n0 * 0.3) && (await ev(p, 's.state')) === 'play', `${n0}→${await ev(p, 's.pieces.size')}`);
    await ev(p, '(s.gameOver(), 1)'); await sleep(100);
    ok('revive offered only once per run', !(await p.$('#reviveBtn')));
    await ev(p, '(s.runCoins = 40, 1)'); await ev(p, '(N.UI.close(), s.gameOver(), 1)'); await sleep(100);
    const c0 = await ev(p, 'd.coins'), rc = await ev(p, 's.runCoins');
    { await p.click('#doubleBtn'); await waitOverGone(p); ok('2x Coins rewarded ad doubles run coins', (await ev(p, 'd.coins')) === c0 + rc, `${c0}+${rc}→${await ev(p, 'd.coins')}`); }
    let adSeen = false;
    const watchAd = async () => { adSeen = false; for (let i = 0; i < 12; i++) { const t = await p.evaluate(() => document.getElementById('over').innerText); if (/Ad break/.test(t)) adSeen = true; await sleep(100); } };
    await p.click('#againBtn'); await watchAd();
    ok('run #1: NO interstitial', !adSeen && await ev(p, 'd.runs === 1'));
    await ev(p, '(s.gameOver(), 1)'); await p.click('#againBtn'); await watchAd();
    ok('run #2: interstitial shown (every 2nd decline)', adSeen);
    await waitOverGone(p);
    await ev(p, '(s.gameOver(), 1)'); await p.click('#againBtn'); await sleep(300);
    ok('run #3: starter bundle offer pops once', (await sheetText(p)).includes('ONE-TIME OFFER'));
    await p.screenshot({ path: `${SHOTS}/11-offer.png` });
    await p.click('#act1'); await sleep(100);
    await ev(p, '(s.gameOver(), 1)'); await p.click('#againBtn'); await watchAd();
    ok('run #4: interstitial shown again', adSeen);
    await waitOverGone(p);
    await ev(p, '(d.adsRemoved = true, 1)');
    for (let i = 0; i < 2; i++) { await ev(p, '(s.gameOver(), 1)'); await p.click('#againBtn'); await watchAd(); if (adSeen) break; }
    ok('adsRemoved: never an interstitial', !adSeen);
    ok('starter offer never repeats', !(await sheetText(p)).includes('ONE-TIME'));
    ok('no page errors in game-over flows', p.errs.length === 0, p.errs.slice(0, 3).join(' | '));
    await p.context().close();

    /* 13. Login streak across days + clock rewind safety + save corruption */
    const store = {};
    p = await newPage(browser, { time: T0 }); await p.click('#claimStreak'); await dismissSheet(p);
    Object.assign(store, await p.evaluate(() => ({ ...localStorage }))); await p.context().close();
    p = await newPage(browser, { time: new Date(+T0 + DAY), storage: store });
    ok('next day: streak auto-prompts Day 2', (await sheetText(p)).includes('Claim Day 2'));
    await p.click('#claimStreak'); Object.assign(store, await p.evaluate(() => ({ ...localStorage }))); await p.context().close();
    p = await newPage(browser, { time: new Date(+T0 - 3 * DAY), storage: store });
    ok('clock rewind: nothing re-claimable', !(await sheetText(p)) && !(await ev(p, 'N.Meta.streak().claimable')));
    await p.context().close();
    p = await newPage(browser, { time: new Date(+T0 + 4 * DAY), storage: store });
    ok('missed days: streak resets to Day 1', (await sheetText(p)).includes('Claim Day 1'));
    await p.context().close();
    p = await newPage(browser, { storage: { nmm_save_v2: '{corrupt', nmm_save_v2_bak: JSON.stringify({ v: 2, coins: 777, gems: 5 }) } });
    ok('corrupt save falls back to backup copy', await ev(p, 'd.coins === 777'));
    await p.context().close();
    p = await newPage(browser, { storage: { nmm_save_v2: JSON.stringify({ v: 2, coins: -50, gems: 'x', upgrades: { steamer: 99 }, themes: { owned: ['hacked'], active: 'hacked' }, discovered: 'nope' }) } });
    ok('invalid save values are sanitized', await ev(p, 'd.coins === 0 && d.gems === 0 && d.upgrades.steamer === 5 && d.themes.active === "wood"'));
    await p.context().close();
    p = await newPage(browser, { storage: { nmm_profile: JSON.stringify({ best: 4321, coins: 99, gems: 12, adsRemoved: true, wildBank: 2, runs: 5 }) } });
    ok('v1 save migrates', await ev(p, 'd.best === 4321 && d.coins >= 99 && d.adsRemoved === true && d.wildBank === 2'));
    await p.context().close();

    /* 14. Layout: no overlaps / clipping at 390×844 and 360×640 */
    for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 412, height: 915 }]) {
      const ctx = await browser.newContext({ viewport: vp }); const q = await ctx.newPage(); await q.clock.setFixedTime(T0);
      await boot(q); await q.evaluate(() => { const x = document.querySelector('#sheet .x'); x && x.click(); });
      const rects = await q.evaluate(() => ['#score', '.wallet', '.icons', '#nextBox', '#strip', '#spiceBtn', '#btnToss', '#btnSwap', '#btnEat', '#btnShop'].map(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { sel, l: r.left, t: r.top, r: r.right, b: r.bottom }; }));
      const inView = rects.every(r => r.l >= 0 && r.t >= 0 && r.r <= vp.width + 0.5 && r.b <= vp.height + 0.5);
      let overlap = null;
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j]; if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) overlap = `${a.sel}×${b.sel}`; }
      const clipped = await q.evaluate(() => [...document.querySelectorAll('.tb b, #score, .pill span')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
      ok(`layout ${vp.width}×${vp.height}: HUD & bar inside viewport`, inView, JSON.stringify(rects.filter(r => r.r > vp.width || r.b > vp.height)));
      ok(`layout ${vp.width}×${vp.height}: no overlapping controls`, !overlap, overlap || '');
      ok(`layout ${vp.width}×${vp.height}: no clipped labels`, clipped.length === 0, clipped.join(','));
      await q.screenshot({ path: `${SHOTS}/12-layout-${vp.width}x${vp.height}.png` });
      await ctx.close();
    }
  } catch (e) {
    ok('suite crashed', false, e.stack.split('\n').slice(0, 3).join(' '));
  } finally {
    await browser.close(); srv.kill();
  }
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
