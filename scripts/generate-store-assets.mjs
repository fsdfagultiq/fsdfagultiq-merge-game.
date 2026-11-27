// Generates Google Play store graphics into store-assets/ by rendering the real game in headless Chromium.
//   npm run assets      (or: node scripts/generate-store-assets.mjs)
// Outputs: app-icon-512.png, feature-graphic-1024x500.png, screenshot-1-gameplay.png, screenshot-2-fever.png,
//          screenshot-3-stall.png, screenshot-4-shop.png (1080×1920).
import { createRequire } from 'node:module';
// Uses Playwright (install once with: npm i -D playwright && npx playwright install chromium)
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'store-assets');
const PORT = 5197, BASE = `http://localhost:${PORT}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T0 = new Date('2026-11-27T10:00:00');
const dayIndex = d => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
mkdirSync(OUT, { recursive: true });

// Find the launcher icon / splash PNGs Capacitor generated and keep their exact sizes.
function pngSize(file) { const b = readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
function nativeTargets() {
  const out = [], res = 'android/app/src/main/res';
  if (existsSync(join(ROOT, res))) for (const dir of readdirSync(join(ROOT, res))) {
    for (const [file, kind] of [['ic_launcher.png', 'square'], ['ic_launcher_round.png', 'round'], ['ic_launcher_foreground.png', 'fg'], ['splash.png', 'splash']]) {
      const rel = `${res}/${dir}/${file}`; if (existsSync(join(ROOT, rel))) out.push([rel, ...pngSize(join(ROOT, rel)), kind]);
    }
  }
  const ios = 'ios/App/App/Assets.xcassets';
  const icon = `${ios}/AppIcon.appiconset/AppIcon-512@2x.png`;
  if (existsSync(join(ROOT, icon))) out.push([icon, ...pngSize(join(ROOT, icon)), 'ios-icon']);
  if (existsSync(join(ROOT, ios, 'Splash.imageset'))) for (const f of readdirSync(join(ROOT, ios, 'Splash.imageset')).filter(f => f.endsWith('.png'))) {
    const rel = `${ios}/Splash.imageset/${f}`; out.push([rel, ...pngSize(join(ROOT, rel)), 'splash']);
  }
  return out;
}

const save = (extra = {}) => JSON.stringify({
  v: 2, best: 18452, coins: 6480, gems: 735, wildBank: 3, onboarded: true,
  discovered: [false, true, true, true, true, true, true, true, true, true, false, false],
  upgrades: { steamer: 3, cat: 2, ladle: 3, spice: 1, lanterns: 2 },
  streak: { lastClaim: dayIndex(T0), count: 3, lastPrompt: dayIndex(T0) }, maxDay: dayIndex(T0),
  settings: { sfx: false, music: false, haptics: false }, ...extra,
});

async function gamePage(browser, extra) {
  const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.route('**/*', r => (r.request().url().startsWith(BASE) ? r.continue() : r.abort()));
  await p.clock.setFixedTime(T0);
  await p.addInitScript(s => { localStorage.setItem('nmm_save_v2', s); }, save(extra));
  await p.goto(BASE);
  await p.waitForFunction(() => window.NMM && NMM.game && NMM.UI.scene, null, { timeout: 20000 });
  await sleep(900);
  return p;
}
const pile = `(() => { const s = NMM.game;
  for (const q of [...s.pieces]) s.removePiece(q);
  const L = [[9,150,700],[7,370,740],[8,300,620],[6,110,560],[5,440,610],[4,210,520],[3,330,500],[2,420,520],[1,250,470],
             [5,90,440],[3,160,420],[2,470,450],[1,380,430],[4,280,420],[2,200,400],[1,330,380]];
  for (const [t,x,y] of L) s.spawn({ tier: t }, x, y);
  s.score = 12840; s.aimX = 300; s.current = { tier: 4 }; s.next = { tier: 2 }; s.runMaxTier = 9; NMM.UI.refresh(); return 1; })()`;

async function frame(browser, png, caption, sub, theme) {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.route('**/*', r => (r.request().url().startsWith(BASE) ? r.continue() : r.abort()));
  await p.goto(BASE + 'css/style.css');                       // same-origin page so local fonts resolve
  const bg = { wood: ['#3B1F14', '#170D0F', '#FF8A3D'], neon: ['#22186A', '#0A0820', '#3EF2FF'], gold: ['#7A1620', '#2A0709', '#FFD166'] }[theme];
  await p.setContent(`<!doctype html><html><head><base href="${BASE}"><style>
    @font-face{font-family:Fredoka;font-weight:700;src:url(fonts/fredoka-latin-700-normal.woff2)}
    @font-face{font-family:Nunito;font-weight:800;src:url(fonts/nunito-latin-800-normal.woff2)}
    html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
    body{background:radial-gradient(circle at 50% 8%, ${bg[0]}, ${bg[1]} 70%);font-family:Fredoka,sans-serif;color:#FFF8E7;display:flex;flex-direction:column;align-items:center}
    h1{margin:110px 60px 0;font-size:96px;line-height:1.02;text-align:center;text-shadow:0 8px 0 rgba(0,0,0,.45);letter-spacing:.5px}
    h1 em{font-style:normal;color:${bg[2]}}
    p{margin:22px 0 0;font-family:Nunito,sans-serif;font-weight:800;font-size:42px;opacity:.85}
    img{margin-top:56px;width:820px;height:1458px;border-radius:56px;border:10px solid rgba(255,248,231,.9);box-shadow:0 30px 80px rgba(0,0,0,.55), 0 0 90px ${bg[2]}55;object-fit:cover;object-position:top}
  </style></head><body><h1>${caption}</h1><p>${sub}</p><img src="data:image/png;base64,${png.toString('base64')}"></body></html>`);
  await p.evaluate(() => document.fonts.ready); await sleep(300);
  const buf = await p.screenshot({ clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  await ctx.close(); return buf;
}

const srv = spawn('node', [join(ROOT, 'scripts/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await sleep(700);
const browser = await chromium.launch();
try {
  /* ---- icon + feature graphic, drawn with the game's own procedural art ---- */
  const p0 = await gamePage(browser);
  const targets = nativeTargets();
  await p0.evaluate(t => { window.__nativeTargets = t; }, targets);
  const art = await p0.evaluate(async () => {
    const A = NMM.Art, food = (t, m) => A.foodCanvas(t, m || 'normal');
    function steamerRing(c, cx, cy, R, w) {
      c.save(); c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.arc(cx, cy, R - w, 0, Math.PI * 2, true); c.closePath();
      const g = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R); g.addColorStop(0, '#FFE7A1'); g.addColorStop(0.5, '#E8B84A'); g.addColorStop(1, '#9C6A1E');
      c.fillStyle = g; c.fill(); c.clip();
      c.strokeStyle = 'rgba(107,60,16,.45)'; c.lineWidth = 3;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 36) { c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - w), cy + Math.sin(a) * (R - w)); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke(); }
      c.restore();
      c.lineWidth = 6; c.strokeStyle = '#5A3420'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(cx, cy, R - w, 0, Math.PI * 2); c.stroke();
    }
    const put = (c, t, x, y, d, mode) => { const f = food(t, mode); c.drawImage(f, x - d / 2, y - d / 2, d, d); };

    // App icon 512×512 (full-bleed square; Play applies its own mask). withBg=false → transparent art for adaptive foregrounds.
    function makeIcon(withBg) {
    const ic = A.mkCanvas(512), c = ic.getContext('2d');
    let g;
    if (withBg) {
    g = c.createRadialGradient(256, 200, 20, 256, 256, 380); g.addColorStop(0, '#7A2A1A'); g.addColorStop(0.55, '#3B1F14'); g.addColorStop(1, '#1A0C0E');
    c.fillStyle = g; c.fillRect(0, 0, 512, 512);
    for (const [x, y, r, a] of [[90, 70, 220, 0.35], [430, 60, 200, 0.28]]) { const lg = c.createRadialGradient(x, y, 0, x, y, r); lg.addColorStop(0, `rgba(255,150,60,${a})`); lg.addColorStop(1, 'rgba(255,150,60,0)'); c.fillStyle = lg; c.fillRect(0, 0, 512, 512); }
    }
    c.save(); c.beginPath(); c.arc(256, 276, 196, 0, Math.PI * 2); const ig = c.createRadialGradient(256, 240, 30, 256, 276, 196); ig.addColorStop(0, '#5A3420'); ig.addColorStop(1, '#24120C'); c.fillStyle = ig; c.fill(); c.restore();
    put(c, 3, 150, 300, 118); put(c, 4, 372, 302, 132); put(c, 1, 300, 404, 66); put(c, 2, 205, 404, 80);
    put(c, 7, 262, 236, 228);
    steamerRing(c, 256, 276, 222, 34);
    put(c, 1, 418, 128, 58); put(c, 5, 96, 150, 92, 'surprised');
    c.fillStyle = '#FFF3C4'; for (const [x, y, s] of [[452, 210, 9], [70, 300, 7], [338, 70, 8], [180, 92, 6]]) { c.beginPath(); c.moveTo(x, y - s * 2); c.lineTo(x + s * 0.5, y); c.lineTo(x, y + s * 2); c.lineTo(x - s * 0.5, y); c.closePath(); c.fill(); c.beginPath(); c.moveTo(x - s * 2, y); c.lineTo(x, y + s * 0.5); c.lineTo(x + s * 2, y); c.lineTo(x, y - s * 0.5); c.closePath(); c.fill(); }
    return ic;
    }
    const ic = makeIcon(true), icFg = makeIcon(false);

    // Feature graphic 1024×500
    const fg = A.mkCanvas(1024, 500), f = fg.getContext('2d');
    let g = f.createLinearGradient(0, 0, 1024, 500); g.addColorStop(0, '#3B1F14'); g.addColorStop(1, '#170D0F'); f.fillStyle = g; f.fillRect(0, 0, 1024, 500);
    for (const [x, y, r, a, col] of [[120, 40, 360, 0.35, '255,140,60'], [900, 100, 380, 0.3, '230,57,70'], [700, 520, 300, 0.25, '255,209,102']]) { const lg = f.createRadialGradient(x, y, 0, x, y, r); lg.addColorStop(0, `rgba(${col},${a})`); lg.addColorStop(1, `rgba(${col},0)`); f.fillStyle = lg; f.fillRect(0, 0, 1024, 500); }
    for (let i = 0; i < 7; i++) { const x = 40 + i * 150, y = 26 + (i % 2) * 12; f.strokeStyle = 'rgba(255,248,231,.25)'; f.lineWidth = 2; f.beginPath(); f.moveTo(x - 75, y - 8); f.quadraticCurveTo(x, y + 10, x + 75, y - 8); f.stroke();
      const lg = f.createRadialGradient(x, y + 22, 2, x, y + 22, 26); lg.addColorStop(0, '#FFB060'); lg.addColorStop(1, '#C0262F'); f.fillStyle = lg; f.beginPath(); f.ellipse(x, y + 24, 16, 20, 0, 0, Math.PI * 2); f.fill(); }
    const burst = [[11, 770, 300, 250], [9, 905, 175, 150], [8, 610, 400, 130], [7, 930, 400, 120], [6, 640, 170, 100], [5, 820, 455, 80], [4, 540, 270, 70], [3, 990, 290, 60], [2, 700, 70, 50], [1, 560, 95, 38]];
    for (const [t, x, y, d] of burst) put(f, t, x, y, d, t === 6 ? 'surprised' : 'normal');
    put(f, 3, 470, 430, 58);
    f.drawImage(A.wildCanvas(), 980 - 36, 40, 72, 72);
    f.textBaseline = 'alphabetic'; f.lineJoin = 'round';
    f.font = '700 104px Fredoka'; f.lineWidth = 18; f.strokeStyle = '#2C1A1D';
    f.strokeText('Dim Sum', 52, 220); f.fillStyle = '#FFF8E7'; f.fillText('Dim Sum', 52, 220);
    f.strokeText('Drop', 52, 322); const tg = f.createLinearGradient(0, 250, 0, 322); tg.addColorStop(0, '#FFE08A'); tg.addColorStop(1, '#F4A261'); f.fillStyle = tg; f.fillText('Drop', 52, 322);
    f.fillStyle = '#E63946'; f.beginPath(); f.roundRect(56, 352, 330, 54, 27); f.fill(); f.strokeStyle = '#2C1A1D'; f.lineWidth = 5; f.stroke();
    f.font = '700 30px Fredoka'; f.fillStyle = '#FFF8E7'; f.fillText('NIGHT MARKET', 104, 390);
    f.font = '600 26px Fredoka'; f.fillStyle = 'rgba(255,248,231,.85)'; f.fillText('Drop. Merge. Feast!', 60, 456);
    // Native launcher icons & splash screens (sizes come from the files Capacitor generated)
    const native = {};
    for (const [path, w, h, kind] of window.__nativeTargets) {
      const cv = A.mkCanvas(w, h), x = cv.getContext('2d');
      if (kind === 'square') x.drawImage(ic, 0, 0, w, h);
      else if (kind === 'round') { x.beginPath(); x.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); x.clip(); x.drawImage(ic, 0, 0, w, h); }
      else if (kind === 'fg') { const d = w * 0.64; x.drawImage(icFg, (w - d) / 2, (h - d) / 2 + w * 0.02, d, d); }     // adaptive safe zone (66/108)
      else if (kind === 'splash') {
        x.fillStyle = '#2C1A1D'; x.fillRect(0, 0, w, h);
        const gl = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6); gl.addColorStop(0, 'rgba(255,140,60,.25)'); gl.addColorStop(1, 'rgba(255,140,60,0)'); x.fillStyle = gl; x.fillRect(0, 0, w, h);
        const d = Math.min(w, h) * 0.42; x.save(); x.beginPath(); x.arc(w / 2, h / 2, d / 2, 0, Math.PI * 2); x.clip(); x.drawImage(ic, w / 2 - d / 2, h / 2 - d / 2, d, d); x.restore();
      }
      native[path] = cv.toDataURL('image/png');
    }
    return { icon: ic.toDataURL('image/png'), iconFull: ic.toDataURL('image/png'), feature: fg.toDataURL('image/png'), native };
  });
  writeFileSync(join(OUT, 'app-icon-512.png'), Buffer.from(art.icon.split(',')[1], 'base64'));
  {                                                       // Play requires a 24-bit feature graphic (no alpha): flatten via a screenshot
    const fctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 }); const fp = await fctx.newPage();
    await fp.setContent(`<html><body style="margin:0;background:#170D0F"><img src="${art.feature}" style="display:block"></body></html>`);
    writeFileSync(join(OUT, 'feature-graphic-1024x500.png'), await fp.screenshot({ clip: { x: 0, y: 0, width: 1024, height: 500 } }));
    await fctx.close();
  }
  await p0.context().close();
  for (const [path, , , kind] of targets) {
    if (kind === 'ios-icon') continue;
    writeFileSync(join(ROOT, path), Buffer.from(art.native[path].split(',')[1], 'base64'));
  }
  for (const [path, w, h, kind] of targets.filter(t => t[3] === 'ios-icon')) {   // App Store icons must have no alpha channel
    const ictx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const ip = await ictx.newPage();
    await ip.setContent(`<html><body style="margin:0"><img src="${art.iconFull}" style="display:block;width:${w}px;height:${h}px"></body></html>`);
    writeFileSync(join(ROOT, path), await ip.screenshot({ clip: { x: 0, y: 0, width: w, height: h } })); await ictx.close();
  }
  const bgXml = join(ROOT, 'android/app/src/main/res/values/ic_launcher_background.xml');
  if (existsSync(bgXml)) writeFileSync(bgXml, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#3B1F14</color>\n</resources>\n');
  console.log(`Native icons/splash written: ${targets.length} files`);

  /* ---- screenshot 1: gameplay ---- */
  let p = await gamePage(browser);
  await p.evaluate(pile); await sleep(2600);
  await p.evaluate(() => { for (const id of ['toast', 'disc']) document.getElementById(id).hidden = true; });
  let shot = await p.screenshot();
  writeFileSync(join(OUT, 'screenshot-1-gameplay.png'), await frame(browser, shot, 'Drop. Merge. <em>Feast!</em>', '11 kawaii street foods to cook', 'wood'));

  /* ---- screenshot 2: Wok Fever ---- */
  await p.evaluate(`(() => { const s = NMM.game; s.combo = 3; s.lastMergeAt = s.playClock; return 1; })()`);
  await p.evaluate(`(() => { const s = NMM.game; s.spawn({tier:3}, 250, 300); s.spawn({tier:3}, 270, 300); s.spawn({tier:2}, 400, 330); s.spawn({tier:2}, 415, 330); return 1; })()`);
  await sleep(420);
  await p.evaluate(() => { for (const id of ['toast', 'disc']) document.getElementById(id).hidden = true; });
  shot = await p.screenshot();
  writeFileSync(join(OUT, 'screenshot-2-fever.png'), await frame(browser, shot, 'Chain merges for <em>WOK FEVER ×5</em>', 'Combos multiply your score and coins', 'wood'));
  await p.context().close();

  /* ---- screenshot 3: stall upgrades ---- */
  p = await gamePage(browser, { themes: { owned: ['wood', 'gold'], active: 'gold' } });
  await p.evaluate(pile); await sleep(1500);
  await p.evaluate(() => NMM.UI.shop('stall')); await sleep(500);
  await p.evaluate(() => { for (const id of ['toast', 'disc']) document.getElementById(id).hidden = true; });
  shot = await p.screenshot();
  writeFileSync(join(OUT, 'screenshot-3-stall.png'), await frame(browser, shot, 'Upgrade your <em>Night Market stall</em>', 'Permanent boosts for every run', 'gold'));
  await p.context().close();

  /* ---- screenshot 4: shop / themes ---- */
  p = await gamePage(browser, { themes: { owned: ['wood', 'neon'], active: 'neon' } });
  await p.evaluate(pile); await sleep(1500);
  await p.evaluate(() => NMM.UI.shop('themes')); await sleep(500);
  await p.evaluate(() => { for (const id of ['toast', 'disc']) document.getElementById(id).hidden = true; });
  shot = await p.screenshot();
  writeFileSync(join(OUT, 'screenshot-4-shop.png'), await frame(browser, shot, 'Unlock dazzling <em>market themes</em>', 'Tokyo Neon · Imperial Gold · and more', 'neon'));
  await p.context().close();
  console.log('Store assets written to', OUT);
} finally {
  await browser.close(); srv.kill();
}
