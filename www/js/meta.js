/* Meta progression: daily missions, 7-day streak, discovery album, stall upgrades, themes. */
(function (N) {
  'use strict';
  const D = () => N.Save.data;

  N.Meta = {
    listeners: [],
    onChange(fn) { this.listeners.push(fn); },
    changed() { this.listeners.forEach(fn => { try { fn(); } catch (e) {} }); },

    grant(r) {
      const d = D();
      if (r.coins) d.coins += r.coins;
      if (r.gems) d.gems += r.gems;
      if (r.wild) d.wildBank = Math.min(999, d.wildBank + r.wild);
      N.Save.save(); this.changed();
    },

    /* ---------- daily missions */
    ensureDaily() {
      const day = N.Save.today(), dl = D().daily;
      if (dl.day === day && dl.missions.length === 3) return;
      if (dl.day > day) return;                                  // never regenerate for an earlier day
      const rnd = N.Art.seeded(day * 7919 + 13), pool = N.MISSION_POOL.slice(), picked = [], types = new Set();
      while (picked.length < 3 && pool.length) {
        const i = Math.floor(rnd() * pool.length), m = pool.splice(i, 1)[0];
        if (types.has(m.type)) continue; types.add(m.type); picked.push({ id: m.id, progress: 0, claimed: false });
      }
      dl.day = day; dl.missions = picked; N.Save.save();
    },
    missions() { this.ensureDaily(); return D().daily.missions.map(m => ({ ...m, def: N.MISSION_POOL.find(p => p.id === m.id) })); },
    track(type, value = 1) {
      this.ensureDaily();
      let completed = null;
      for (const m of D().daily.missions) {
        const def = N.MISSION_POOL.find(p => p.id === m.id);
        if (!def || def.type !== type || m.claimed || m.progress >= def.goal) continue;
        const before = m.progress;
        m.progress = (type === 'score' || type === 'tier') ? Math.max(m.progress, Math.min(def.goal, value)) : Math.min(def.goal, m.progress + value);
        if (before < def.goal && m.progress >= def.goal) completed = def;
      }
      N.Save.saveSoon();
      if (completed) { this.changed(); N.UI && N.UI.toast(`Mission complete: ${completed.text}. Claim it in Daily.`); }
    },
    claimMission(id) {
      const m = D().daily.missions.find(x => x.id === id), def = N.MISSION_POOL.find(p => p.id === id);
      if (!m || !def || m.claimed || m.progress < def.goal) return null;
      m.claimed = true; this.grant({ gems: def.gems, coins: def.coins }); return def;
    },

    /* ---------- 7-day login streak (clock-safe via Save.today) */
    streak() {
      const day = N.Save.today(), s = D().streak;
      const broken = s.lastClaim >= 0 && day - s.lastClaim > 1;
      const claimable = day > s.lastClaim;
      const done = broken ? 0 : (s.count >= 7 && claimable ? 0 : s.count);   // after Day 7 a new week starts
      return { day, claimable, broken, done, nextIndex: claimable ? done : Math.max(0, s.count - 1) };
    },
    claimStreak() {
      const st = this.streak(); if (!st.claimable) return null;
      const idx = st.done, reward = N.STREAK[idx], s = D().streak;
      s.count = idx + 1; s.lastClaim = st.day;
      this.grant(reward); return { idx, reward };
    },
    shouldPromptStreak() {
      const st = this.streak(), s = D().streak;
      return st.claimable && s.lastPrompt < st.day;
    },
    markStreakPrompted() { D().streak.lastPrompt = this.streak().day; N.Save.save(); },
    claimableCount() {
      const ms = this.missions().filter(m => !m.claimed && m.progress >= m.def.goal).length;
      return ms + (this.streak().claimable ? 1 : 0);
    },

    /* ---------- discovery album */
    discover(tier) {
      const d = D(); if (tier < 1 || tier > 11 || d.discovered[tier]) return 0;
      d.discovered[tier] = true; N.Save.saveSoon(); this.changed();
      return N.DISCOVERY_GEMS[tier] || 0;
    },

    /* ---------- stall upgrades */
    upgradeLevel(id) { return D().upgrades[id] || 0; },
    upgradeCost(id) { const def = N.UPGRADES.find(u => u.id === id), lv = this.upgradeLevel(id); return lv >= 5 ? null : def.costs[lv]; },
    buyUpgrade(id) {
      const cost = this.upgradeCost(id), d = D();
      if (cost == null || d.coins < cost) return false;
      d.coins -= cost; d.upgrades[id] = Math.min(5, d.upgrades[id] + 1); N.Save.save(); this.changed(); return true;
    },
    effects() { return N.effects(D().upgrades); },

    /* ---------- themes */
    buyTheme(key, currency) {
      const th = N.THEMES[key], d = D(); if (!th || d.themes.owned.includes(key)) return false;
      const price = currency === 'gems' ? th.gems : th.coins, have = currency === 'gems' ? d.gems : d.coins;
      if (have < price) return false;
      if (currency === 'gems') d.gems -= price; else d.coins -= price;
      d.themes.owned.push(key); d.themes.active = key; N.Save.save(); this.changed(); return true;
    },
    setTheme(key) { const d = D(); if (!d.themes.owned.includes(key)) return false; d.themes.active = key; N.Save.save(); this.changed(); return true; },
  };
})(window.NMM);
