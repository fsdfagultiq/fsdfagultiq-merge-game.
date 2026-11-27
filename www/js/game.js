/* Phaser scene: physics, merging (debounce lock), red-line grace timer, juice, faces, boosters. */
(function (N) {
  'use strict';
  const { W, H, S, BOX, DANGER_Y, HOLD_Y, WILD_R, CFG, PHYS, TIERS } = N;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MBody = () => Phaser.Physics.Matter.Matter.Body;
  const FONT = 'Fredoka, Nunito, sans-serif';

  class Kitchen extends Phaser.Scene {
    constructor() { super('kitchen'); }

    create() {
      N.game = this;
      const tex = this.textures;
      for (let t = 1; t <= 11; t++) {
        for (const [suf, mode] of [['', 'normal'], ['_b', 'blink'], ['_s', 'surprised']]) {
          const cv = N.Art.foodCanvas(t, mode); tex.addCanvas('food' + t + suf, cv);
          if (!suf) N.UI.urls['food' + t] = cv.toDataURL();
        }
      }
      const wild = N.Art.wildCanvas(); tex.addCanvas('wild', wild); N.UI.urls.wild = wild.toDataURL();
      tex.addCanvas('dot', N.Art.dotCanvas());

      this.bgImg = this.add.image(0, 0, '__WHITE').setOrigin(0).setDepth(0);
      this.backImg = this.add.image(0, 0, '__WHITE').setOrigin(0).setDepth(1);
      this.frontImg = this.add.image(0, 0, '__WHITE').setOrigin(0).setDepth(7);
      this.applyTheme(N.Save.data.themes.active);

      this.guideG = this.add.graphics().setDepth(2);
      this.ghostG = this.add.graphics().setDepth(4);
      this.dangerG = this.add.graphics().setDepth(8);
      this.timerText = this.add.text(W / 2, DANGER_Y + 74, '', { fontFamily: FONT, fontSize: '64px', fontStyle: '700', color: '#FFF8E7', stroke: '#E63946', strokeThickness: 10 })
        .setOrigin(0.5).setDepth(12).setVisible(false);
      this.timerSub = this.add.text(W / 2, DANGER_Y + 124, 'KITCHEN TIMER!', { fontFamily: FONT, fontSize: '22px', fontStyle: '700', color: '#FFD9DC', stroke: '#2C1A1D', strokeThickness: 6 })
        .setOrigin(0.5).setDepth(12).setVisible(false);

      const wo = { isStatic: true, friction: 0.06, restitution: 0.1, label: 'wall' };
      this.matter.add.rectangle(BOX.x - 20, BOX.bottom - (BOX.h + 700) / 2, 40, BOX.h + 700, wo);
      this.matter.add.rectangle(BOX.right + 20, BOX.bottom - (BOX.h + 700) / 2, 40, BOX.h + 700, wo);
      this.matter.add.rectangle(W / 2, BOX.bottom + 20, BOX.w + 80, 40, wo);
      this.matter.world.on('collisionstart', e => this.onCollide(e, true));
      this.matter.world.on('collisionactive', e => this.onCollide(e, false));

      this.pieces = new Set(); this.mergeQueue = []; this.iceMade = {}; this.pauseReasons = new Set();
      this.hold = this.add.image(W / 2, HOLD_Y, 'food1').setScale(1 / S).setDepth(11);
      this.holdIce = this.add.image(W / 2, HOLD_Y, 'wild').setScale(1 / S).setDepth(11).setVisible(false);
      this.aimX = W / 2;

      this.input.on('pointermove', p => { if (p.isDown || !p.wasTouch) this.aimX = p.x; });
      this.input.on('pointerdown', p => { this.aimX = p.x; this.armed = !this.isPaused() && performance.now() - (N.UI.closedAt || 0) > 250; });
      this.input.on('pointerup', p => { if (this.armed) { this.armed = false; this.aimX = p.x; this.drop(); } });
      this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,A,D');
      const keyDrop = () => { const a = document.activeElement; if (a && a.tagName === 'BUTTON') return; this.drop(); };   // Space on a focused button presses the button only
      this.input.keyboard.on('keydown-SPACE', keyDrop);
      this.input.keyboard.on('keydown-DOWN', keyDrop);

      this.events.once('shutdown', () => { N.game = null; });
      this.newRun();
      N.UI.sceneReady(this);
    }

    /* ---------- theme */
    applyTheme(key) {
      const th = N.THEMES[key] || N.THEMES.wood, tex = this.textures;
      for (const [name, fn] of [['bg', N.Art.bgCanvas], ['back', N.Art.steamerBack], ['front', N.Art.steamerFront]]) {
        const k = name + '_' + key; if (!tex.exists(k)) tex.addCanvas(k, fn(th));
      }
      this.bgImg.setTexture('bg_' + key); this.backImg.setTexture('back_' + key); this.frontImg.setTexture('front_' + key);
      this.dangerColor = th.danger;
    }

    /* ---------- pause (reasons: modal, overlay, app) */
    isPaused() { return this.pauseReasons.size > 0; }
    setPause(reason, on) {
      if (on) this.pauseReasons.add(reason); else this.pauseReasons.delete(reason);
      if (this.isPaused() || this.state !== 'play') this.matter.world.pause(); else this.matter.world.resume();
    }

    /* ---------- helpers */
    keyOf(spec) { return spec.wild ? 'wild' : 'food' + spec.tier; }
    radiusOf(spec) { return spec.wild ? WILD_R : TIERS[spec.tier].r; }
    iceKey(tier) { const k = 'ice' + tier; if (!this.iceMade[k]) { this.textures.addCanvas(k, N.Art.iceCanvas(tier)); this.iceMade[k] = true; } return k; }
    clampX(x, r) { return Phaser.Math.Clamp(x, BOX.x + r + 2, BOX.right - r - 2); }
    rollTier() { let roll = Math.random() * 100; for (let t = 1; t <= 5; t++) { roll -= TIERS[t].spawn; if (roll < 0) return t; } return 1; }
    gen() {
      this.genIndex++;
      if (this.genIndex % this.fx.spiceEvery === 0) return { wild: true };            // Golden Spice Orb cadence (Spice Jar)
      return { tier: this.rollTier(), frozen: this.score >= CFG.FROZEN_SCORE && Math.random() < CFG.FROZEN_CHANCE };
    }

    newRun() {
      for (const p of [...this.pieces]) this.removePiece(p);
      this.mergeQueue = [];
      this.fx = N.Meta.effects();
      Object.assign(this, {
        score: 0, runCoins: 0, combo: 0, lastMergeAt: -1e9, genIndex: 0, tossFree: this.fx.freeToss, swapFree: this.fx.freeSwap,
        revived: false, doubled: false, bonusGiven: false, countdown: null, playClock: 0, nextDropAt: 0, dangerSuspendUntil: 0,
        runMaxTier: 0, runMerges: 0, runFevers: 0, state: 'play',
      });
      this.current = this.gen(); this.next = this.gen();
      this.timerText.setVisible(false); this.timerSub.setVisible(false);
      this.setPause('none', false);
      N.UI.refresh();
    }

    spawn(spec, x, y) {
      const r = this.radiusOf(spec);
      const body = this.matter.add.circle(x, y, r, Object.assign({ label: 'piece' }, PHYS));
      body.isMerging = false;                                                          // merge debounce lock flag
      const sprite = this.add.image(x, y, this.keyOf(spec)).setScale(1 / S).setDepth(5);
      let ice = null;
      const frozen = !!(spec.frozen && !spec.wild);
      if (frozen) { ice = this.add.image(x, y, this.iceKey(spec.tier)).setScale(1 / S).setDepth(6); sprite.setTint(0xd2efff); }
      const p = { body, sprite, ice, tier: spec.wild ? 0 : spec.tier, wild: !!spec.wild, frozen, r, born: this.playClock,
        face: 'n', nextBlink: this.playClock + 1500 + Math.random() * 4000, blinkUntil: 0 };
      body.piece = p; this.pieces.add(p); return p;
    }
    removePiece(p) {
      this.tweens.killTweensOf(p.sprite);
      this.matter.world.remove(p.body); p.sprite.destroy(); if (p.ice) { this.tweens.killTweensOf(p.ice); p.ice.destroy(); }
      p.body.piece = null; this.pieces.delete(p);
    }

    /* ---------- actions */
    drop() {
      if (this.state !== 'play' || this.isPaused()) return;
      if (this.playClock < this.nextDropAt || !this.current) return;
      const spec = this.current, r = this.radiusOf(spec);
      this.spawn(spec, this.clampX(this.aimX, r), HOLD_Y);
      if (!spec.wild && spec.tier <= 4) N.Meta.discover(spec.tier);
      this.nextDropAt = this.playClock + CFG.DROP_COOLDOWN;
      this.current = this.next; this.next = this.gen();
      N.Save.data.stats.drops++; N.Meta.track('drop');
      N.UI.firstDrop();
      N.UI.refresh();
    }
    useSpice() {
      const d = N.Save.data;
      if (this.state !== 'play' || this.isPaused() || d.wildBank <= 0 || this.current.wild) return false;
      d.wildBank--; N.Save.save(); this.current = { wild: true }; N.UI.refresh(); return true;
    }
    toss() {
      const B = MBody();
      for (const p of this.pieces) {
        B.setVelocity(p.body, { x: (Math.random() - 0.5) * 9, y: -(6 + Math.random() * 6) });
        B.setAngularVelocity(p.body, (Math.random() - 0.5) * 0.3);
      }
      this.dangerSuspendUntil = this.playClock + 2000; this.countdown = null; this.timerText.setVisible(false); this.timerSub.setVisible(false);
      N.Sfx.sizzle(); N.Haptics.fire('medium'); if (!REDUCED) this.cameras.main.shake(220, 0.006);
      this.floatText(W / 2, BOX.y + 120, 'WOK TOSS!', '#FFD166', 34);
      this.boosterUsed();
    }
    swap() {
      if (this.current.wild) return false;
      const old = this.current.tier; let t = this.rollTier(), n = 0;
      while (t === old && n++ < 20) t = this.rollTier();
      this.current = { tier: t }; N.Sfx.tap(3); this.boosterUsed(); N.UI.refresh(); return true;
    }
    eatSmall() {
      const small = [...this.pieces].filter(p => !p.wild && p.tier <= 2 && !p.body.isMerging);
      let pts = 0;
      for (const p of small) { this.burst(p.body.position.x, p.body.position.y, p.tier, 6); pts += TIERS[p.tier].score; this.removePiece(p); }
      this.addScore(pts); N.Sfx.eat(); N.Haptics.fire('light');
      this.floatText(W / 2, BOX.y + 140, small.length ? `Itadakimasu! ${small.length} eaten` : 'Nothing small to eat', '#FFF8E7', 28);
      this.boosterUsed(); N.UI.refresh();
    }
    boosterUsed() { N.Save.data.stats.boosters++; N.Meta.track('booster'); }
    addScore(pts) { this.score += pts; N.Meta.track('score', this.score); }

    /* ---------- collisions & merging */
    onCollide(e, isStart) {
      if (this.state !== 'play') return;
      for (const pair of e.pairs) {
        const a = pair.bodyA.parent || pair.bodyA, b = pair.bodyB.parent || pair.bodyB;
        if (isStart) { const rv = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y); if (rv > 1.5) N.Sfx.tap(rv); }
        if (a.piece && b.piece) this.tryMerge(a, b);
      }
    }
    tryMerge(a, b) {
      if (a.isMerging || b.isMerging) return;                                          // DEBOUNCE LOCK
      const pa = a.piece, pb = b.piece;
      if (pa.frozen || pb.frozen) return;                                              // ice blocks merging
      let result, anchor = null;
      if (pa.wild && pb.wild) return;
      if (pa.wild || pb.wild) { const o = pa.wild ? pb : pa; if (o.tier < 1 || o.tier > 10) return; result = o.tier + 1; anchor = o; }
      else if (pa.tier === pb.tier) result = pa.tier + 1;
      else return;
      a.isMerging = true; b.isMerging = true;                                          // lock both immediately
      this.mergeQueue.push({ pa, pb, result, anchor });
    }
    processMerges() {
      if (!this.mergeQueue.length) return;
      const q = this.mergeQueue; this.mergeQueue = [];
      for (const m of q) {
        const { pa, pb } = m; if (!this.pieces.has(pa) || !this.pieces.has(pb)) continue;
        const A = pa.body.position, B = pb.body.position;
        const x = m.anchor ? m.anchor.body.position.x : (A.x + B.x) / 2, y = m.anchor ? m.anchor.body.position.y : (A.y + B.y) / 2;
        const vx = (pa.body.velocity.x + pb.body.velocity.x) / 2, vy = (pa.body.velocity.y + pb.body.velocity.y) / 2;
        this.removePiece(pa); this.removePiece(pb);
        this.merged(m.result, x, y, vx, vy, !!m.anchor);
      }
    }
    merged(result, x, y, vx, vy, viaWild) {
      const now = this.playClock, d = N.Save.data;
      this.combo = (now - this.lastMergeAt <= this.fx.comboWindow) ? Math.min(CFG.COMBO_MAX, this.combo + 1) : 1;   // Wok Fever: comboCount 1..5
      this.lastMergeAt = now;
      const mult = this.combo, fever = this.combo > 1, fxTier = Math.min(result, 11);
      let pts, coins;
      if (result > 11) {
        pts = 4096 * mult; coins = 300 * mult;
        this.floatText(x, y - 60, 'NIGHT MARKET FEAST!', '#FFD166', 40); this.burst(x, y, 11, 30);
      } else {
        const np = this.spawn({ tier: result }, this.clampX(x, TIERS[result].r), y);
        MBody().setVelocity(np.body, { x: vx * 0.5, y: Math.min(vy, 0) * 0.5 });
        this.squashPop(np.sprite);
        pts = TIERS[result].score * mult; coins = TIERS[result].coins * mult;
        this.burst(x, y, fxTier);
      }
      pts = Math.round(pts * this.fx.scoreMult);
      coins = Math.round(coins * this.fx.coinMult * (d.adsRemoved ? 2 : 1));
      this.addScore(pts); this.runCoins += coins; d.coins += coins;
      this.runMerges++; d.stats.merges++; N.Meta.track('merge');
      if (viaWild) N.Meta.track('wild');
      if (result <= 11) { N.Meta.track('tier', result); this.runMaxTier = Math.max(this.runMaxTier, result); d.stats.bestTier = Math.max(d.stats.bestTier, result); }
      if (this.combo === 3) { this.runFevers++; d.stats.fevers++; N.Meta.track('fever3'); }
      N.Save.saveSoon();

      N.Sfx.pop(fxTier, this.combo - 1);
      N.Haptics.fire(this.combo >= 3 ? 'medium' : 'light');
      this.floatText(x, y - 10, '+' + pts.toLocaleString(), '#FFF8E7', 26 + Math.min(fxTier, 8) * 2);
      if (fever) { this.floatText(x, y - 52, `x${mult} WOK FEVER!`, '#FF8A3D', 30); N.UI.fever(mult); }
      if (viaWild) this.floatText(x, y + 30, 'SPICED UP!', '#FFD166', 22);
      if ((fxTier >= 6 || fever) && !REDUCED) this.cameras.main.shake(160, fxTier >= 9 ? 0.009 : 0.004);
      this.thawNear(x, y, result <= 11 ? TIERS[result].r : 124);
      if (result <= 11) { const gems = N.Meta.discover(result); if (gems) N.UI.discovery(result, gems); }
      N.UI.refresh();
    }
    thawNear(x, y, mergedR) {
      for (const p of this.pieces) {
        if (!p.frozen) continue;
        if (Phaser.Math.Distance.Between(x, y, p.body.position.x, p.body.position.y) > Math.max(p.r, mergedR) * 2.5) continue;   // adjacent merge within radius*2.5
        p.frozen = false; p.sprite.clearTint();
        const ice = p.ice; p.ice = null;
        if (ice) this.tweens.add({ targets: ice, scale: ice.scale * 1.35, alpha: 0, duration: 260, onComplete: () => ice.destroy() });
        const em = this.add.particles(p.body.position.x, p.body.position.y, 'dot', { speed: { min: 60, max: 180 }, angle: { min: 0, max: 360 }, lifespan: 450,
          scale: { start: 0.45, end: 0 }, tint: [0xBDE9FF, 0xFFFFFF], emitting: false }).setDepth(9);
        em.explode(12); this.time.delayedCall(700, () => em.destroy());
        this.floatText(p.body.position.x, p.body.position.y, 'THAWED!', '#BDE9FF', 22);
        N.Meta.track('thaw');
      }
    }

    /* ---------- juice */
    squashPop(sprite) {
      const k = 1 / S; sprite.setScale(0.55 * k);
      this.tweens.chain({ targets: sprite, tweens: [
        { scaleX: 1.22 * k, scaleY: 1.12 * k, duration: 100, ease: 'Quad.easeOut' },
        { scaleX: 1.0 * k, scaleY: 1.0 * k, duration: 100, ease: 'Quad.easeIn' } ] });
    }
    burst(x, y, tier, count) {
      const hex = parseInt(TIERS[Math.max(1, tier)].hex.slice(1), 16);
      const em = this.add.particles(x, y, 'dot', {
        speed: { min: 70, max: 200 + tier * 14 }, angle: { min: 0, max: 360 }, lifespan: { min: 350, max: 750 },
        scale: { start: 0.5 + tier * 0.05, end: 0 }, alpha: { start: 1, end: 0 }, gravityY: -70, tint: [hex, 0xFFF8E7], emitting: false,
      }).setDepth(9);
      em.explode(count ?? (8 + tier * 2));
      this.time.delayedCall(900, () => em.destroy());
    }
    floatText(x, y, str, color, size) {
      const t = this.add.text(Phaser.Math.Clamp(x, 90, W - 90), y, str, { fontFamily: FONT, fontSize: size + 'px', fontStyle: '700',
        color, stroke: '#2C1A1D', strokeThickness: 7, align: 'center' }).setOrigin(0.5).setDepth(10);
      this.tweens.add({ targets: t, y: y - 70, alpha: { from: 1, to: 0 }, scale: { from: 0.7, to: 1.05 }, duration: 950, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
    }

    /* ---------- game over / revive */
    gameOver() {
      const d = N.Save.data;
      this.state = 'over'; this.countdown = null; this.timerText.setVisible(false); this.timerSub.setVisible(false);
      this.matter.world.pause();
      if (!this.bonusGiven && this.fx.runBonusCoins) { this.bonusGiven = true; this.runCoins += this.fx.runBonusCoins; d.coins += this.fx.runBonusCoins; }
      const isBest = this.score > d.best; if (isBest) d.best = this.score; N.Save.save();
      N.Haptics.fire('heavy');
      N.UI.gameOver({ isBest });
    }
    revive() {
      this.revived = true;
      const sorted = [...this.pieces].sort((a, b) => a.body.position.y - b.body.position.y);
      const n = Math.ceil(sorted.length * 0.3);
      for (const p of sorted.slice(0, n)) { this.burst(p.body.position.x, p.body.position.y, p.wild ? 1 : p.tier, 10); this.removePiece(p); }
      this.countdown = null; this.dangerSuspendUntil = this.playClock + 1500; this.timerText.setVisible(false); this.timerSub.setVisible(false);
      this.state = 'play'; this.setPause('none', false);
      N.Sfx.eat(); this.floatText(W / 2, BOX.y + 160, 'REVIVED!', '#52B788', 40);
      N.UI.refresh();
    }

    /* ---------- landing prediction for the ghost ring */
    landingY(x, r) {
      let y = BOX.bottom - r;
      for (const p of this.pieces) {
        const dx = Math.abs(p.body.position.x - x), rr = r + p.r;
        if (dx >= rr) continue;
        const cand = p.body.position.y - Math.sqrt(rr * rr - dx * dx);
        if (cand < y) y = cand;
      }
      return Math.max(y, HOLD_Y);
    }

    /* ---------- frame loop */
    update(time, delta) {
      const clock = this.playClock;
      for (const p of this.pieces) {
        const pos = p.body.position; p.sprite.setPosition(pos.x, pos.y).setRotation(p.body.angle);
        if (p.ice) p.ice.setPosition(pos.x, pos.y);
        if (p.wild) continue;
        // faces: surprised when falling fast or above the red line, occasional blink at rest
        const v = p.body.velocity, fast = v.y > 6.5 || Math.abs(v.x) > 7;
        const high = clock - p.born > 600 && pos.y - p.r < DANGER_Y + 6;
        if (clock > p.nextBlink) { p.blinkUntil = clock + 140; p.nextBlink = clock + 2200 + Math.random() * 4500; }
        const mode = (fast || high) ? 's' : (clock < p.blinkUntil ? 'b' : 'n');
        if (mode !== p.face) { p.face = mode; p.sprite.setTexture('food' + p.tier + (mode === 'n' ? '' : '_' + mode)); }
      }
      const playing = this.state === 'play' && !this.isPaused();

      // held piece, dotted trajectory and ghost ring
      const cur = this.current;
      this.guideG.clear(); this.ghostG.clear();
      if (cur && this.state === 'play') {
        if (playing) {
          if (this.keys.LEFT.isDown || this.keys.A.isDown) this.aimX -= 0.5 * delta;
          if (this.keys.RIGHT.isDown || this.keys.D.isDown) this.aimX += 0.5 * delta;
        }
        this.aimX = Phaser.Math.Clamp(this.aimX, BOX.x, BOX.right);
        const r = this.radiusOf(cur), x = this.clampX(this.aimX, r);
        const ready = clock >= this.nextDropAt;
        const holdKey = this.keyOf(cur);
        if (this.hold.texture.key !== holdKey) this.hold.setTexture(holdKey);
        this.hold.setVisible(true).setPosition(x, HOLD_Y).setAlpha(ready ? 1 : 0.35);
        if (cur.frozen) this.holdIce.setVisible(true).setTexture(this.iceKey(cur.tier)).setPosition(x, HOLD_Y).setAlpha(ready ? 1 : 0.35); else this.holdIce.setVisible(false);
        const ly = this.landingY(x, r);
        this.guideG.fillStyle(0xFFF8E7, ready ? 0.42 : 0.15);
        for (let y = HOLD_Y + r + 10; y < ly - r - 4; y += 16) this.guideG.fillCircle(x, y, 2.6);
        this.ghostG.lineStyle(3, 0xFFF8E7, ready ? 0.35 : 0.12);
        this.ghostG.fillStyle(0xFFF8E7, ready ? 0.07 : 0.03);
        this.ghostG.fillCircle(x, ly, r); this.ghostG.strokeCircle(x, ly, r);
      } else { this.hold.setVisible(false); this.holdIce.setVisible(false); }

      if (playing) {
        this.playClock += delta;
        this.processMerges();
        // 3-second red-line grace timer (never instant game over on drop)
        let danger = false;
        if (this.playClock >= this.dangerSuspendUntil) {
          for (const p of this.pieces) {
            if (p.body.isMerging) continue;
            if (this.playClock - p.born > CFG.MIN_AGE && p.body.position.y - p.r < DANGER_Y) { danger = true; break; }
          }
        }
        if (danger) {
          if (this.countdown === null) { this.countdown = CFG.GRACE_MS; this.lastBeep = 4; }
          this.countdown -= delta;
          const sec = Math.max(1, Math.ceil(this.countdown / 1000));
          if (sec < this.lastBeep) { this.lastBeep = sec; N.Sfx.beep(); N.Haptics.fire('warning'); }
          this.timerText.setText(String(sec)).setVisible(true); this.timerSub.setVisible(true);
          if (this.countdown <= 0) this.gameOver();
        } else if (this.countdown !== null) {
          this.countdown = null; this.timerText.setVisible(false); this.timerSub.setVisible(false);
        }
      }

      // danger line: idle 0.3, pulses 0.3 → 1.0 during the countdown
      const g = this.dangerG; g.clear();
      const counting = this.countdown !== null && this.state === 'play';
      g.setAlpha(counting ? 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * 0.014)) : 0.3);
      if (counting) { g.fillStyle(this.dangerColor, 0.18); g.fillRect(BOX.x, BOX.y, BOX.w, DANGER_Y - BOX.y); }
      g.lineStyle(4, this.dangerColor, 1);
      for (let x = BOX.x + 4; x < BOX.right - 4; x += 22) g.lineBetween(x, DANGER_Y, Math.min(x + 12, BOX.right - 4), DANGER_Y);
    }
  }
  N.Kitchen = Kitchen;
})(window.NMM);
