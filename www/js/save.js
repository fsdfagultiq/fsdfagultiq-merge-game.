/* Versioned, validated save data with a backup copy and v1 migration. */
(function (N) {
  'use strict';
  const KEY = 'nmm_save_v2', BAK = 'nmm_save_v2_bak', RECEIPTS = 'nmm_mock_store_receipts';

  function defaults() {
    return {
      v: 2, best: 0, coins: 0, gems: 0, wildBank: 0, adsRemoved: false,
      runs: 0, declines: 0, adFreeUntil: 0,
      discovered: new Array(12).fill(false),
      upgrades: { steamer: 0, cat: 0, ladle: 0, spice: 0, lanterns: 0 },
      themes: { owned: ['wood'], active: 'wood' },
      settings: { sfx: true, music: true, haptics: true },
      onboarded: false,
      daily: { day: -1, missions: [] },
      streak: { lastClaim: -1, count: 0, lastPrompt: -1 },
      maxDay: 0,
      starterBundleBought: false, starterOfferShown: false,
      stats: { merges: 0, drops: 0, fevers: 0, boosters: 0, bestTier: 0 },
    };
  }
  const int = (v, d, min = 0, max = 1e12) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

  function sanitize(raw) {
    const d = defaults();
    raw = obj(raw);
    d.best = int(raw.best, 0); d.coins = int(raw.coins, 0); d.gems = int(raw.gems, 0);
    d.wildBank = int(raw.wildBank, 0, 0, 999); d.adsRemoved = bool(raw.adsRemoved, false);
    d.runs = int(raw.runs, 0); d.declines = int(raw.declines, 0); d.adFreeUntil = int(raw.adFreeUntil, 0, 0, 8.64e15);
    if (Array.isArray(raw.discovered)) for (let t = 1; t <= 11; t++) d.discovered[t] = bool(raw.discovered[t], false);
    const up = obj(raw.upgrades); for (const k of Object.keys(d.upgrades)) d.upgrades[k] = int(up[k], 0, 0, 5);
    const th = obj(raw.themes);
    if (Array.isArray(th.owned)) d.themes.owned = ['wood', ...th.owned.filter(k => k !== 'wood' && N.THEMES[k])].filter((k, i, a) => a.indexOf(k) === i);
    d.themes.active = d.themes.owned.includes(th.active) ? th.active : 'wood';
    const st = obj(raw.settings); for (const k of Object.keys(d.settings)) d.settings[k] = bool(st[k], true);
    d.onboarded = bool(raw.onboarded, false);
    const dl = obj(raw.daily);
    const ms = Array.isArray(dl.missions) ? dl.missions.filter(m => m && N.MISSION_POOL.some(p => p.id === m.id)) : [];
    if (ms.length === 3) { d.daily.day = int(dl.day, -1, -1, 1e7); d.daily.missions = ms.map(m => ({ id: m.id, progress: int(m.progress, 0), claimed: bool(m.claimed, false) })); }
    const sk = obj(raw.streak);
    d.streak.lastClaim = int(sk.lastClaim, -1, -1, 1e7); d.streak.count = int(sk.count, 0, 0, 7); d.streak.lastPrompt = int(sk.lastPrompt, -1, -1, 1e7);
    d.maxDay = int(raw.maxDay, 0, 0, 1e7);
    d.starterBundleBought = bool(raw.starterBundleBought, false); d.starterOfferShown = bool(raw.starterOfferShown, false);
    const sts = obj(raw.stats); for (const k of Object.keys(d.stats)) d.stats[k] = int(sts[k], 0);
    return d;
  }

  function readJSON(key) { try { const t = localStorage.getItem(key); return t ? JSON.parse(t) : null; } catch (e) { return null; } }

  N.Save = {
    data: defaults(), _t: 0,
    load() {
      let raw = null;
      for (const k of [KEY, BAK]) { const r = readJSON(k); if (r && typeof r === 'object' && r.v === 2) { raw = r; break; } }
      if (!raw) {                                                   // migrate the Phase 1–3 save
        const old = readJSON('nmm_profile');
        if (old && typeof old === 'object') raw = { v: 2, best: old.best, coins: old.coins, gems: old.gems, adsRemoved: old.adsRemoved, wildBank: old.wildBank, runs: old.runs };
      }
      this.data = sanitize(raw);
      const rec = N.Receipts.list();                                // old product id → new id
      if (rec.includes('remove_ads')) { N.Receipts.add('remove_ads_pack'); }
      this.save();
      return this.data;
    },
    save() {
      clearTimeout(this._t);
      try { const t = JSON.stringify(this.data); localStorage.setItem(KEY, t); localStorage.setItem(BAK, t); } catch (e) {}
    },
    saveSoon() { clearTimeout(this._t); this._t = setTimeout(() => this.save(), 400); },
    /* Local calendar day number. Clock-safe: if the device clock goes backwards we keep the
       furthest day already seen, so missions/streaks can't be re-claimed by rewinding time. */
    today() {
      const now = new Date();
      const real = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5), d = this.data;
      // Strict high-water mark: day numbers never move backwards, so no clock change can re-pay a streak day or
      // regenerate missions. Trade-off (deliberate): if a device clock was once set far ahead and then corrected,
      // dailies pause until real time catches up. Phones normally use network time, so this is rare.
      if (real > d.maxDay) { d.maxDay = real; this.saveSoon(); }
      return Math.max(real, d.maxDay);
    },
    _sanitize: sanitize, _defaults: defaults,
  };

  // Simulated store-side receipts (used only while STORE_CONFIG.USE_MOCK_IAP is true)
  N.Receipts = {
    list() { const r = readJSON(RECEIPTS); return Array.isArray(r) ? r.filter(x => typeof x === 'string') : []; },
    add(id) { const l = this.list(); if (!l.includes(id)) { l.push(id); try { localStorage.setItem(RECEIPTS, JSON.stringify(l)); } catch (e) {} } },
  };

  const flush = () => N.Save.save();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
})(window.NMM);
