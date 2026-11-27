/* Boot: load save, wire the platform bridge (ads/IAP/back button/pause), size the stage, start Phaser. */
(function (N) {
  'use strict';
  const $ = id => document.getElementById(id);

  // Web fallback if platform.js failed to load for any reason
  if (!window.Platform) {
    const mock = {};
    window.Platform = {
      isNative: false, os: 'web',
      setMockHandlers(h) { Object.assign(mock, h); }, init: () => Promise.resolve(),
      showRewarded: p => mock.ad ? mock.ad('rewarded', p) : Promise.resolve(false),
      showInterstitial: p => (mock.ad ? mock.ad('interstitial', p) : Promise.resolve()).then(() => {}),
      purchase: id => mock.purchase ? mock.purchase(id) : Promise.resolve(false),
      restore: () => Promise.resolve(N.Receipts.list()), getPrice: () => '',
      privacyOptionsRequired: () => false, showPrivacyOptions: () => Promise.resolve(),
      onBack() {}, exitApp() {}, onPause() {}, onResume() {}, haptic(k) { try { navigator.vibrate && navigator.vibrate(k === 'medium' ? 25 : 10); } catch (e) {} },
    };
  }
  const P = window.Platform;

  N.Save.load();
  N.Meta.ensureDaily();
  $('wrap').dataset.theme = N.Save.data.themes.active;

  P.setMockHandlers({ ad: (kind, placement) => N.UI.mockAd(kind, placement), purchase: id => N.UI.mockPurchase(id) });
  P.onBack(() => N.UI.onBack());
  P.onPause(() => { N.Save.save(); N.Sfx.suspend(); if (N.game) { N.game.setPause('app', true); N.UI.pause(); } });
  P.onResume(() => { N.Sfx.resume(); if (N.game) N.game.setPause('app', false); });

  // Stage sizing: 9:16 box that fits inside the safe area
  const wrap = $('wrap'), app = $('app');
  function fit() {
    const vw = app.clientWidth, vh = app.clientHeight; let h = vh, w = h * 9 / 16; if (w > vw) { w = vw; h = w * 16 / 9; }
    wrap.style.width = w + 'px'; wrap.style.height = h + 'px'; document.documentElement.style.setProperty('--u', (w / N.W) + 'px');
  }
  fit(); window.addEventListener('resize', fit);
  // Block pinch-zoom, double-tap zoom, long-press menus and pull-to-refresh inside the app
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());

  function start() {
    new Phaser.Game({
      type: Phaser.AUTO, parent: 'wrap', width: N.W, height: N.H, backgroundColor: '#2C1A1D',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'matter', matter: { gravity: { x: 0, y: 1.4 }, debug: false, positionIterations: 8, velocityIterations: 6 } },
      input: { activePointers: 2 },
      banner: false,
      scene: N.Kitchen,
      callbacks: { postBoot: () => { const b = $('boot'); if (b) b.remove(); } },
    });
  }
  const fonts = document.fonts ? Promise.race([Promise.all(['700 24px Fredoka', '600 24px Fredoka', '700 16px Nunito'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
  const plat = Promise.race([P.init().catch(() => {}), new Promise(r => setTimeout(r, 7000))]);
  Promise.all([fonts.catch(() => {}), plat]).then(start, start);
})(window.NMM);
