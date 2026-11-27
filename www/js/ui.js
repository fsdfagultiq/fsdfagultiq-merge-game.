/* DOM UI: HUD, evolution strip, thumb bar, modals (shop/stall/themes, daily, album, settings, pause, game over), ads & IAP glue. */
(function (N) {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = () => N.Save.data;
  const P = () => window.Platform;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const reward = r => [r.coins && `<span class="rw"><i class="coin"></i>${fmt(r.coins)}</span>`, r.gems && `<span class="rw"><i class="gem"></i>${fmt(r.gems)}</span>`,
    r.wild && `<span class="rw"><img src="${UI.urls.wild}" alt="">×${r.wild}</span>`].filter(Boolean).join('');

  const UI = N.UI = {
    urls: {}, scene: null, modal: null, closedAt: 0, toastT: 0, toastT2: 0, feverT: 0, discT: 0, overOpen: false,

    sceneReady(scene) {
      this.scene = scene;
      this.buildStrip();
      $('spiceImg').src = this.urls.wild;
      $('btnToss').onclick = () => this.onToss();
      $('btnSwap').onclick = () => this.onBoost('swap');
      $('btnEat').onclick = () => this.onBoost('eat');
      $('btnShop').onclick = () => this.shop('shop');
      $('btnGear').onclick = () => this.settings();
      $('btnDaily').onclick = () => this.daily();
      $('strip').onclick = () => this.album();
      $('spiceBtn').onclick = () => { if (scene.useSpice()) { N.Sfx.click(); this.toast('Golden Spice loaded. It upgrades any dish it touches.'); } };
      $('ui').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { b.blur(); } });
      N.Meta.onChange(() => this.refresh());
      if (!D().onboarded) $('hint').hidden = false;
      this.refresh();
      setTimeout(() => this.launchPrompts(), 600);
    },

    /* ---------- HUD */
    buildStrip() {
      const s = $('strip'); s.innerHTML = '';
      for (let t = 1; t <= 11; t++) { const i = document.createElement('i'); i.dataset.t = t; i.innerHTML = `<img src="${this.urls['food' + t]}" alt="">`; s.appendChild(i); }
    },
    refresh() {
      const s = this.scene; if (!s || s.score == null) return;
      const d = D();
      $('score').textContent = fmt(s.score);
      $('best').textContent = fmt(Math.max(d.best, s.score));
      $('coins').textContent = fmt(d.coins);
      $('gems').textContent = fmt(d.gems);
      if (s.next) { const src = this.urls[s.keyOf(s.next)]; if ($('nextImg').getAttribute('src') !== src) $('nextImg').src = src; $('nextIce').hidden = !s.next.frozen; }
      $('spiceCount').textContent = '×' + d.wildBank;
      $('spiceBtn').disabled = d.wildBank <= 0 || s.state !== 'play' || !!(s.current && s.current.wild);
      $('tagToss').textContent = s.tossFree > 0 ? `${s.tossFree} FREE` : 'AD'; $('tagToss').className = 'tag' + (s.tossFree > 0 ? ' free' : '');
      $('tagSwap').textContent = s.swapFree > 0 ? `${s.swapFree} FREE` : 'AD · 30'; $('tagSwap').className = 'tag ' + (s.swapFree > 0 ? 'free' : 'gemtag');
      $('tagEat').textContent = 'AD · 50';
      const canUp = N.UPGRADES.some(u => { const c = N.Meta.upgradeCost(u.id); return c != null && d.coins >= c; });
      $('tagShop').textContent = canUp ? 'UPGRADE' : (d.adsRemoved ? 'AD-FREE' : '');
      const n = N.Meta.claimableCount(); $('dailyBadge').textContent = n; $('dailyBadge').hidden = n === 0;
      for (const i of $('strip').children) { const t = +i.dataset.t; i.classList.toggle('found', !!d.discovered[t]); i.classList.toggle('top', t === s.runMaxTier); }
    },
    fever(mult) {
      const el = $('fever'); el.textContent = `WOK FEVER ×${mult}`; el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      clearTimeout(this.feverT); this.feverT = setTimeout(() => { el.hidden = true; }, this.scene ? this.scene.fx.comboWindow : 1500);
    },
    toast(msg) {
      const el = $('toast'); el.textContent = msg; el.hidden = false; el.style.opacity = 1; clearTimeout(this.toastT); clearTimeout(this.toastT2);
      this.toastT = setTimeout(() => { el.style.opacity = 0; this.toastT2 = setTimeout(() => { el.hidden = true; }, 260); }, 2400);
    },
    firstDrop() {
      if (D().onboarded) return;
      D().onboarded = true; N.Save.save();
      const h = $('hint'); h.classList.add('out'); setTimeout(() => { h.hidden = true; }, 500);
    },

    /* ---------- non-blocking discovery card */
    discovery(tier, gems) {
      const t = N.TIERS[tier], el = $('disc');
      el.innerHTML = `<img src="${this.urls['food' + tier]}" alt=""><div><b>NEW DISH DISCOVERED!</b><span>${esc(t.name)} · <i class="gem"></i> +${gems}</span></div>
        <button type="button" class="mini" id="discAd">Watch Ad ×2</button>`;
      this.grantDisc = gems; N.Meta.grant({ gems });
      el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      N.Sfx.chime(); N.Haptics.fire('success');
      $('discAd').onclick = async () => {
        const btn = $('discAd'); btn.disabled = true; clearTimeout(this.discT);
        if (await this.rewarded('discovery_2x')) { N.Meta.grant({ gems }); btn.textContent = `+${gems} more!`; this.toast(`Doubled: +${gems} more gems.`); }
        else btn.disabled = false;
        this.discT = setTimeout(() => this.hideDisc(), 2200);
      };
      clearTimeout(this.discT); this.discT = setTimeout(() => this.hideDisc(), 6000);
      this.refresh();
    },
    hideDisc() { const el = $('disc'); el.classList.add('out'); setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 300); },

    /* ---------- modal system */
    open({ title, text = '', html = '', actions = [], closable = true, onBack = null, cls = '' }) {
      this.modal = { closable, onBack };
      if (this.scene) this.scene.setPause('modal', true);
      const root = $('sheet'); root.innerHTML = '';
      const card = document.createElement('div'); card.className = 'card ' + cls; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', title);
      card.innerHTML = `${closable ? '<button type="button" class="x" aria-label="Close">×</button>' : ''}<h2>${title}</h2>${text ? `<p>${text}</p>` : ''}${html}`;
      if (actions.length) {
        const acts = document.createElement('div'); acts.className = 'acts';
        actions.forEach((a, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (a.kind || 'ghost'); b.id = a.id || ('act' + i);
          b.innerHTML = a.label; b.disabled = !!a.disabled; b.onclick = () => { if (!b.disabled) { N.Sfx.click(); a.onClick(); } }; acts.appendChild(b); });
        card.appendChild(acts);
      }
      if (closable) card.querySelector('.x').onclick = () => this.close();
      root.appendChild(card); root.hidden = false;
      return card;
    },
    close() {
      this.closedAt = performance.now();
      $('sheet').hidden = true; $('sheet').innerHTML = ''; this.modal = null;
      if (this.scene) this.scene.setPause('modal', false);
      this.refresh();
    },
    showOver(html) { const o = $('over'); o.innerHTML = `<div class="card small">${html}</div>`; o.hidden = false; this.overOpen = true; if (this.scene) this.scene.setPause('over', true); },
    hideOver() { const o = $('over'); o.hidden = true; o.innerHTML = ''; this.overOpen = false; this.closedAt = performance.now(); if (this.scene) this.scene.setPause('over', false); },

    /* ---------- ads (real AdMob via Platform on native, mock overlay on web) */
    async rewarded(placement) {
      this.showOver('<div class="spin"></div><p>Loading ad…</p>');
      let ok = false;
      try { ok = await P().showRewarded(placement); } catch (e) { ok = false; }
      this.hideOver();
      if (!ok) this.toast('No reward this time. The ad was closed early or none was available.');
      return ok;
    },
    async interstitial(placement) {
      this.showOver('<div class="spin"></div><p>One moment…</p>');
      try { await P().showInterstitial(placement); } catch (e) {}
      this.hideOver();
    },
    mockAd(kind) {
      return new Promise(res => {
        const rewardedAd = kind === 'rewarded';
        this.showOver(`<h2>${rewardedAd ? 'Rewarded ad' : 'Ad break'}</h2><div class="adbox">${rewardedAd ? 'Your reward is cooking…' : 'Thanks for playing! Back in a moment.'}<br><small>Simulated ad · 1 second</small></div><div class="adbar"><i></i></div>`);
        setTimeout(() => res(true), 1000);
      });
    },
    mockPurchase(id) {
      return new Promise(res => {
        const pr = N.PRODUCTS[id]; if (!pr) return res(false);
        this.showOver(`<h2>Confirm purchase</h2><p>${esc(pr.name)} for ${esc(this.price(id))}. Test mode: nothing is charged.</p>
          <div class="acts"><button type="button" class="btn primary" id="mpBuy">Buy for ${esc(this.price(id))}</button><button type="button" class="btn ghost" id="mpCancel">Cancel</button></div>`);
        $('mpCancel').onclick = () => res(false);
        $('mpBuy').onclick = () => {
          this.showOver('<h2>Processing…</h2><div class="adbar"><i></i></div>');
          setTimeout(() => { N.Receipts.add(id); res(true); }, 700);
        };
      });
    },
    price(id) { try { return P().getPrice(id) || N.PRODUCTS[id].fallbackPrice; } catch (e) { return N.PRODUCTS[id].fallbackPrice; } },
    async buy(id) {
      this.showOver('<div class="spin"></div><p>Connecting to the store…</p>');
      let ok = false;
      try { ok = await P().purchase(id); } catch (e) { ok = false; }
      this.hideOver();
      if (ok) { this.grantProduct(id); N.Sfx.chime(); }
      else this.toast('Purchase not completed. You were not charged.');
      return ok;
    },
    grantProduct(id) {
      const d = D();
      if (id === 'remove_ads_pack') { d.adsRemoved = true; this.toast('Ads removed. Coins now count double.'); }
      if (id === 'starter_gems') { N.Meta.grant({ gems: 500, wild: 3 }); this.toast('Added 500 gems and 3 Golden Spice wildcards.'); }
      if (id === 'starter_bundle') { d.starterBundleBought = true; d.adFreeUntil = Math.max(d.adFreeUntil, Date.now() + 3 * 864e5); N.Meta.grant({ gems: 500, wild: 3 }); this.toast('Starter Bundle added: 500 gems, 3 wildcards, 3 ad-free days.'); }
      N.Save.save(); this.refresh();
    },
    async restore() {
      this.showOver('<div class="spin"></div><p>Restoring purchases…</p>');
      let ids = [];
      try { ids = await P().restore(); } catch (e) { ids = null; }
      this.hideOver();
      if (ids === null) { this.toast('Could not reach the store. Check your connection and try again.'); return; }
      const d = D(); const got = [];
      if (ids.includes('remove_ads_pack')) { if (!d.adsRemoved) got.push('Remove Ads + 2x Coins'); d.adsRemoved = true; }
      if (ids.includes('starter_bundle')) { d.starterBundleBought = true; }
      N.Save.save(); this.refresh();
      this.toast(got.length ? `Restored: ${got.join(', ')}.` : (ids.includes('remove_ads_pack') ? 'Remove Ads + 2x Coins is already active.' : 'No previous purchases found to restore.'));
    },

    /* ---------- thumb bar */
    busy() { const s = this.scene; return !s || s.state !== 'play' || this.modal || this.overOpen; },
    async onToss() {
      const s = this.scene; if (this.busy()) return;
      if (s.tossFree > 0) { s.tossFree--; s.toss(); this.refresh(); return; }
      if (await this.rewarded('booster_toss')) s.toss();
    },
    onBoost(which) {
      const s = this.scene; if (this.busy()) return;
      if (which === 'swap' && s.current && s.current.wild) { this.toast('You are holding a Golden Spice. Drop it first.'); return; }
      if (which === 'swap' && s.swapFree > 0) { s.swapFree--; s.swap(); return; }
      const cost = which === 'swap' ? 30 : 50, act = which === 'swap' ? () => s.swap() : () => s.eatSmall();
      this.open({
        title: which === 'swap' ? 'Swap piece' : 'Eat small',
        text: which === 'swap' ? 'Reroll the dish in your hand for a different one.' : 'Gobble every Boba Pearl and Edamame in the steamer.',
        actions: [
          { label: 'Watch ad', kind: 'primary', onClick: async () => { this.close(); if (await this.rewarded('booster_' + which)) act(); } },
          { label: `Use ${cost} gems <small>(you have ${fmt(D().gems)})</small>`, kind: 'jade', disabled: D().gems < cost,
            onClick: () => { D().gems -= cost; N.Save.save(); this.close(); act(); } },
        ] });
    },

    /* ---------- shop / stall / themes */
    shop(tab = 'shop') {
      const d = D();
      const tabs = `<div class="tabs" role="tablist">${[['shop', 'Shop'], ['stall', 'Stall'], ['themes', 'Themes']].map(([k, l]) =>
        `<button type="button" role="tab" class="tab${k === tab ? ' on' : ''}" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>`;
      const wallet = `<div class="walletline"><span><i class="coin"></i>${fmt(d.coins)}</span><span><i class="gem"></i>${fmt(d.gems)}</span><span><img src="${this.urls.wild}" alt="">×${d.wildBank}</span></div>`;
      let body = '';
      if (tab === 'shop') {
        const item = (id, owned) => `<div class="item"><div><h3>${esc(N.PRODUCTS[id].name)}</h3><span>${esc(N.PRODUCTS[id].desc)}</span></div>
          <button type="button" class="btn ${owned ? 'ghost' : 'primary'} buy" data-id="${id}" ${owned ? 'disabled' : ''}>${owned ? 'Owned' : esc(this.price(id))}</button></div>`;
        body = (d.starterBundleBought ? '' : item('starter_bundle', false)) + item('remove_ads_pack', d.adsRemoved) + item('starter_gems', false) +
          `<button type="button" class="btn jade" id="restoreBtn">Restore Purchases</button>` +
          `<p class="fine">${(window.STORE_CONFIG && window.STORE_CONFIG.USE_MOCK_IAP !== false) ? 'Test mode: purchases are simulated. Nothing is charged.' : 'Payments are handled by Google Play.'}</p>`;
      } else if (tab === 'stall') {
        body = '<div class="list">' + N.UPGRADES.map(u => {
          const lv = N.Meta.upgradeLevel(u.id), cost = N.Meta.upgradeCost(u.id);
          const pips = Array.from({ length: 5 }, (_, i) => `<b class="${i < lv ? 'on' : ''}"></b>`).join('');
          return `<div class="item up"><div><h3>${esc(u.name)} <small>Lv ${lv}/5</small></h3><span class="pips">${pips}</span>
            <span>${esc(u.effect(lv))}${cost != null ? `<br><em>Next: ${esc(u.next(lv))}</em>` : ''}</span></div>
            ${cost == null ? '<button type="button" class="btn ghost" disabled>MAX</button>' :
              `<button type="button" class="btn primary upg" data-id="${u.id}" ${d.coins < cost ? 'disabled' : ''}><i class="coin"></i>${fmt(cost)}</button>`}</div>`;
        }).join('') + '</div>';
      } else {
        body = '<div class="list">' + N.THEME_ORDER.map(k => {
          const th = N.THEMES[k], owned = d.themes.owned.includes(k), active = d.themes.active === k;
          return `<div class="item theme"><i class="swatch sw-${k}"></i><div><h3>${esc(th.name)}</h3><span>${esc(th.blurb)}</span></div>
            <div class="col">${owned ? `<button type="button" class="btn ${active ? 'ghost' : 'jade'} use" data-k="${k}" ${active ? 'disabled' : ''}>${active ? 'In use' : 'Use'}</button>` :
              `<button type="button" class="btn primary bt" data-k="${k}" data-c="coins" ${d.coins < th.coins ? 'disabled' : ''}><i class="coin"></i>${fmt(th.coins)}</button>
               <button type="button" class="btn jade bt" data-k="${k}" data-c="gems" ${d.gems < th.gems ? 'disabled' : ''}><i class="gem"></i>${fmt(th.gems)}</button>`}</div></div>`;
        }).join('') + '</div>';
      }
      const card = this.open({ title: 'Night Market', html: tabs + wallet + body, cls: 'wide' });
      card.querySelectorAll('.tab').forEach(b => { b.onclick = () => { N.Sfx.click(); this.shop(b.dataset.tab); }; });
      card.querySelectorAll('.buy').forEach(b => { b.onclick = async () => { await this.buy(b.dataset.id); this.shop('shop'); }; });
      const rb = card.querySelector('#restoreBtn'); if (rb) rb.onclick = async () => { await this.restore(); this.shop('shop'); };
      card.querySelectorAll('.upg').forEach(b => { b.onclick = () => {
        if (N.Meta.buyUpgrade(b.dataset.id)) { N.Sfx.chime(); N.Haptics.fire('success'); this.toast(`${N.UPGRADES.find(u => u.id === b.dataset.id).name} upgraded! Applies from your next run.`); }
        this.shop('stall'); }; });
      card.querySelectorAll('.bt').forEach(b => { b.onclick = () => { if (N.Meta.buyTheme(b.dataset.k, b.dataset.c)) { this.scene.applyTheme(b.dataset.k); this.applyThemeCss(); N.Sfx.chime(); } this.shop('themes'); }; });
      card.querySelectorAll('.use').forEach(b => { b.onclick = () => { if (N.Meta.setTheme(b.dataset.k)) { this.scene.applyTheme(b.dataset.k); this.applyThemeCss(); } this.shop('themes'); }; });
    },
    applyThemeCss() { $('wrap').dataset.theme = D().themes.active; },

    /* ---------- daily: 7-day streak + 3 missions */
    daily() {
      const st = N.Meta.streak();
      const cells = N.STREAK.map((r, i) => {
        const claimed = i < st.done, today = st.claimable && i === st.done;
        return `<div class="day${claimed ? ' got' : ''}${today ? ' today' : ''}"><small>DAY ${i + 1}</small><div class="rws">${reward(r)}</div>${claimed ? '<em>✓</em>' : ''}</div>`;
      }).join('');
      const ms = N.Meta.missions().map(m => {
        const done = m.progress >= m.def.goal, pct = Math.min(100, (m.progress / m.def.goal) * 100);
        const prog = m.def.type === 'tier' ? (done ? 'Done' : 'Not yet') : `${fmt(m.progress)} / ${fmt(m.def.goal)}`;
        return `<div class="item mission"><div><h3>${esc(m.def.text)}</h3><div class="bar"><i style="width:${pct}%"></i></div><span>${prog} · ${reward({ gems: m.def.gems, coins: m.def.coins })}</span></div>
          <button type="button" class="btn ${m.claimed ? 'ghost' : 'primary'} claim" data-id="${m.id}" ${m.claimed || !done ? 'disabled' : ''}>${m.claimed ? 'Claimed' : 'Claim'}</button></div>`;
      }).join('');
      const card = this.open({ title: 'Daily Rewards',
        html: `<div class="streak">${cells}</div>
          <button type="button" class="btn primary" id="claimStreak" ${st.claimable ? '' : 'disabled'}>${st.claimable ? `Claim Day ${st.done + 1}` : 'Come back tomorrow'}</button>
          <h4>Today's missions</h4><div class="list">${ms}</div><p class="fine">New missions every day at midnight.</p>`, cls: 'wide' });
      card.querySelector('#claimStreak').onclick = () => { const r = N.Meta.claimStreak(); if (r) { N.Sfx.chime(); N.Haptics.fire('success'); this.toast(`Day ${r.idx + 1} reward collected!`); } this.daily(); };
      card.querySelectorAll('.claim').forEach(b => { b.onclick = () => { const def = N.Meta.claimMission(b.dataset.id); if (def) { N.Sfx.chime(); this.toast(`+${def.gems} gems, +${def.coins} coins`); } this.daily(); }; });
    },
    launchPrompts() {
      if (this.modal || this.overOpen) return;
      if (N.Meta.shouldPromptStreak()) { N.Meta.markStreakPrompted(); this.daily(); }
    },

    /* ---------- discovery album */
    album() {
      const d = D(), found = d.discovered.filter(Boolean).length;
      const grid = N.TIERS.slice(1).map((t, i) => {
        const tier = i + 1, ok = d.discovered[tier];
        return `<div class="dish${ok ? '' : ' unk'}"><div class="pic"><img src="${this.urls['food' + tier]}" alt="">${ok ? '' : '<b>?</b>'}</div>
          <small>T${tier}</small><span>${ok ? esc(t.name) : '???'}</span>${!ok && N.DISCOVERY_GEMS[tier] ? `<em><i class="gem"></i>${N.DISCOVERY_GEMS[tier]}</em>` : ''}</div>`;
      }).join('');
      this.open({ title: 'Dish Album', text: `${found} of 11 dishes discovered. Merge two identical dishes to cook the next one.`, html: `<div class="album">${grid}</div>`, cls: 'wide' });
    },

    /* ---------- settings / pause / exit */
    settings() {
      const st = D().settings, row = (k, label) => `<div class="setrow"><span>${label}</span><button type="button" class="switch" role="switch" aria-checked="${st[k]}" data-k="${k}" aria-label="${label}"><i></i></button></div>`;
      let privacy = false; try { privacy = !!(P().privacyOptionsRequired && P().privacyOptionsRequired()); } catch (e) {}
      const card = this.open({ title: 'Settings',
        html: row('sfx', 'Sound effects') + row('music', 'Music') + row('haptics', 'Vibration') +
          `<div class="acts">${privacy ? '<button type="button" class="btn ghost" id="privBtn">Privacy choices</button>' : ''}
          <button type="button" class="btn ghost" id="howBtn">How to play</button>
          <button type="button" class="btn ghost" id="restoreBtn2">Restore Purchases</button></div>
          <p class="fine">Dim Sum Drop v${N.VERSION} · Fonts: Fredoka & Nunito (SIL OFL)</p>` });
      card.querySelectorAll('.switch').forEach(b => { b.onclick = () => {
        const k = b.dataset.k; st[k] = !st[k]; N.Save.save(); b.setAttribute('aria-checked', st[k]);
        N.Sfx.unlock(); N.Sfx.applySettings(); if (k === 'haptics' && st.haptics) N.Haptics.fire('light'); }; });
      const pb = card.querySelector('#privBtn'); if (pb) pb.onclick = async () => { try { await P().showPrivacyOptions(); } catch (e) {} };
      card.querySelector('#howBtn').onclick = () => this.howTo();
      card.querySelector('#restoreBtn2').onclick = () => this.restore();
    },
    howTo() {
      this.open({ title: 'How to play', html: `<ul class="how">
        <li>Drag to aim, release to drop a dish into the steamer.</li>
        <li>Two identical dishes merge into the next one, up to the Giant Hotpot.</li>
        <li>Merge again within 1.5s to build <b>Wok Fever</b> (up to ×5 score and coins).</li>
        <li><b>Golden Spice</b> upgrades any dish it touches.</li>
        <li><b>Frozen Dumplings</b> can't merge until a merge happens right next to them.</li>
        <li>If a dish stays above the red line, a 3-second kitchen timer starts. Clear it in time!</li></ul>`,
        actions: [{ label: 'Got it', kind: 'primary', onClick: () => this.close() }] });
    },
    pause() {
      if (this.modal || this.overOpen || !this.scene || this.scene.state !== 'play') return;
      const acts = [{ label: 'Resume', kind: 'primary', onClick: () => this.close() }, { label: 'Settings', kind: 'ghost', onClick: () => this.settings() }];
      if (P() && P().isNative) acts.push({ label: 'Exit game', kind: 'ghost', onClick: () => this.confirmExit() });
      this.open({ title: 'Paused', text: 'Your steamer is waiting.', actions: acts });
    },
    confirmExit() {
      this.open({ title: 'Leave the market?', text: 'Your current run will end. Coins and progress are saved.',
        actions: [{ label: 'Keep playing', kind: 'primary', onClick: () => this.close() },
          { label: 'Exit game', kind: 'ghost', onClick: () => { N.Save.save(); try { P().exitApp(); } catch (e) {} } }] });
    },
    onBack() {                                       // Android hardware back
      if (this.overOpen) return;
      if (this.modal) { if (this.modal.onBack) this.modal.onBack(); else if (this.modal.closable) this.close(); return; }
      if (this.scene && this.scene.state === 'play') this.pause();
    },

    /* ---------- game over flow */
    gameOver({ isBest }) {
      const s = this.scene, d = D(), canRevive = !s.revived;
      const acts = [];
      if (canRevive) acts.push({ id: 'reviveBtn', label: 'REVIVE (Watch Ad)', kind: 'primary', onClick: async () => {
        this.close(); if (await this.rewarded('revive')) { s.revive(); } else this.gameOver({ isBest: false }); } });
      if (!s.doubled && s.runCoins > 0) acts.push({ id: 'doubleBtn', label: `2x Coins (Watch Ad) <small>+${fmt(s.runCoins)}</small>`, kind: 'jade', onClick: async () => {
        this.close(); if (await this.rewarded('double_coins')) { s.doubled = true; this.justRewarded = true; N.Meta.grant({ coins: s.runCoins }); s.runCoins *= 2; this.toast('Coins doubled!'); }
        this.gameOver({ isBest: false }); } });
      acts.push({ id: 'againBtn', label: 'Play again', kind: canRevive ? 'ghost' : 'primary', onClick: () => this.endRun() });
      this.open({ title: isBest ? 'New best feast!' : 'The steamer overflowed!', closable: false, onBack: () => {},
        text: canRevive ? 'Watch an ad to clear the top 30% of dishes and keep cooking. You can revive once per run.' : 'Your stall is closing for the night.',
        html: `<div class="stats"><div><small>SCORE</small><strong>${fmt(s.score)}</strong></div><div><small>BEST</small><strong>${fmt(d.best)}</strong></div><div><small>COINS</small><strong>+${fmt(s.runCoins)}</strong></div></div>
          ${s.fx.runBonusCoins ? `<p class="fine">Includes +${s.fx.runBonusCoins} Golden Ladle bonus.</p>` : ''}`,
        actions: acts });
    },
    async endRun() {
      const d = D(), s = this.scene;
      d.runs++; d.declines++; N.Save.save();
      this.close();
      const offer = d.runs === 3 && !d.starterBundleBought && !d.starterOfferShown;
      const adDue = d.runs >= 2 && d.declines % 2 === 0 && !d.adsRemoved && Date.now() > d.adFreeUntil && !this.justRewarded;   // never on run #1
      this.justRewarded = false;
      if (offer) { d.starterOfferShown = true; N.Save.save(); s.newRun(); this.starterOffer(); return; }
      if (adDue) await this.interstitial('game_over');
      s.newRun();
    },
    starterOffer() {
      this.open({ title: 'Starter Bundle', cls: 'offer',
        html: `<div class="ribbon">ONE-TIME OFFER</div><ul class="perks"><li><i class="gem"></i><b>500 Gems</b></li><li><img src="${this.urls.wild}" alt=""><b>3 Golden Spice wildcards</b></li><li><span class="noad">AD</span><b>3 days with no ad breaks</b></li></ul>`,
        actions: [{ label: `Get it for ${esc(this.price('starter_bundle'))}`, kind: 'primary', onClick: async () => { this.close(); await this.buy('starter_bundle'); } },
          { label: 'No thanks', kind: 'ghost', onClick: () => this.close() }] });
    },
  };
})(window.NMM);
