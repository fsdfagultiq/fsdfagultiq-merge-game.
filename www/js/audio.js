/* Procedural Web Audio: 4 spec SFX + a soft pentatonic lo-fi Night Market BGM loop. Haptics manager. */
(function (N) {
  'use strict';
  const S = () => N.Save.data.settings;

  const Sfx = N.Sfx = {
    ctx: null, sfxBus: null, musicBus: null, noiseBuf: null, lastTap: 0,
    unlock() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
          const c = this.ctx = new AC();
          const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(c.destination);
          this.sfxBus = c.createGain(); this.sfxBus.gain.value = S().sfx ? 0.55 : 0; this.sfxBus.connect(comp);
          this.musicBus = c.createGain(); this.musicBus.gain.value = 0; this.musicBus.connect(comp);
          const len = Math.floor(c.sampleRate * 0.6);
          this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
          const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        if (this.ctx.state !== 'running') this.ctx.resume();
        if (S().music) Music.start();
      } catch (e) {}
    },
    ok() { return this.ctx && this.ctx.state === 'running' && S().sfx; },
    applySettings() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.sfxBus.gain.setTargetAtTime(S().sfx ? 0.55 : 0, t, 0.05);
      if (S().music) Music.start(); else Music.stop();
    },
    suspend() { try { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); } catch (e) {} },
    resume() { try { if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume(); } catch (e) {} },   // also iOS 'interrupted'
    tone(type, t0, pts, dur, vol, bus) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(pts[0][0], t0);
      for (let i = 1; i < pts.length; i++) o.frequency.exponentialRampToValueAtTime(pts[i][0], t0 + pts[i][1]);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.004, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(bus || this.sfxBus); o.start(t0); o.stop(t0 + dur + 0.03);
    },
    noise(t0, dur, type, freq, vol, q = 1, bus) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(bus || this.sfxBus); s.start(t0, Math.random() * 0.4); s.stop(t0 + dur + 0.03);
    },
    // (1) soft bamboo/squish tap — throttled 60ms: 20ms sine 320→140Hz + 12ms bandpass noise @1200Hz
    tap(strength = 1) {
      if (!this.ok()) return; const now = performance.now(); if (now - this.lastTap < 60) return; this.lastTap = now;
      const t = this.ctx.currentTime, v = Math.min(1, 0.45 + strength * 0.12);
      this.tone('sine', t, [[320, 0], [140, 0.02]], 0.02, 0.32 * v);
      this.noise(t, 0.012, 'bandpass', 1200, 0.22 * v, 1.4);
    },
    // (2) bubbly pop: 350Hz × 1.12246^(tier+comboCount) + 60ms highpass noise @4500Hz on Tier 5+/combos
    pop(tier, combo) {
      if (!this.ok()) return; const t = this.ctx.currentTime;
      const f = 350 * Math.pow(1.12246, tier + combo);
      this.tone('sine', t, [[f * 0.7, 0], [f * 1.25, 0.045], [f, 0.13]], 0.16, 0.38);
      this.tone('triangle', t + 0.01, [[f * 2, 0], [f * 2.4, 0.05]], 0.08, 0.07);
      if (tier >= 5 || combo > 0) this.noise(t, 0.06, 'highpass', 4500, 0.22);
    },
    // (3) kitchen-timer double beep 880Hz
    beep() { if (!this.ok()) return; const t = this.ctx.currentTime; this.tone('sine', t, [[880, 0]], 0.07, 0.3); this.tone('sine', t + 0.13, [[880, 0]], 0.07, 0.3); },
    // (4) Eat Small pop-crunch 400→700→200Hz
    eat() {
      if (!this.ok()) return; const t = this.ctx.currentTime;
      this.tone('sine', t, [[400, 0], [700, 0.06], [200, 0.18]], 0.2, 0.4);
      this.noise(t + 0.05, 0.05, 'bandpass', 2600, 0.25, 0.8); this.noise(t + 0.11, 0.04, 'bandpass', 1900, 0.18, 0.8);
    },
    sizzle() { if (!this.ok()) return; this.noise(this.ctx.currentTime, 0.35, 'highpass', 3200, 0.2); },
    chime() {                                   // discovery / reward sparkle
      if (!this.ok()) return; const t = this.ctx.currentTime;
      [72, 76, 79, 84].forEach((m, i) => this.tone('sine', t + i * 0.07, [[mtof(m), 0]], 0.35, 0.18));
    },
    click() { if (!this.ok()) return; const t = this.ctx.currentTime; this.tone('sine', t, [[660, 0], [520, 0.03]], 0.04, 0.12); },
  };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  /* Lo-fi BGM: 76 BPM swung 8ths, Am7 – Fmaj7 – Cmaj7 – G6, C-major-pentatonic melody, soft kick/hat, vinyl crackle. */
  const PROG = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 64]];
  const PENTA = [60, 62, 64, 67, 69, 72, 74, 76];
  const Music = N.Music = {
    playing: false, timer: 0, step: 0, nextTime: 0, seed: 7,
    rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; },
    start() {
      const c = Sfx.ctx; if (!c || this.playing) return;
      this.playing = true; this.nextTime = c.currentTime + 0.15;
      Sfx.musicBus.gain.cancelScheduledValues(c.currentTime);
      Sfx.musicBus.gain.setTargetAtTime(0.42, c.currentTime, 0.8);
      clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 90);
    },
    stop() {
      const c = Sfx.ctx; this.playing = false; clearInterval(this.timer);
      if (c) Sfx.musicBus.gain.setTargetAtTime(0, c.currentTime, 0.15);
    },
    tick() {
      const c = Sfx.ctx; if (!c || c.state !== 'running' || !this.playing) return;
      if (this.nextTime < c.currentTime - 1) this.nextTime = c.currentTime + 0.05;   // after a suspend, don't burst-catch-up
      const eighth = 60 / 76 / 2;
      while (this.nextTime < c.currentTime + 0.3) {
        const swing = this.step % 2 === 0 ? 1.16 : 0.84;
        this.note(this.step, this.nextTime, eighth);
        this.nextTime += eighth * swing; this.step = (this.step + 1) % 64;
      }
    },
    note(step, t, e) {
      const bus = Sfx.musicBus, bar = Math.floor(step / 8), beat = step % 8, chord = PROG[bar % 4];
      if (beat === 0) chord.forEach((m, i) => this.keys(mtof(m), t + i * 0.012, e * 7.6, 0.05));
      if (beat === 0 || beat === 5) this.bass(mtof(chord[0] - 12), t, e * (beat ? 2.6 : 4.5));
      if (beat === 0 || beat === 4) Sfx.tone('sine', t, [[110, 0], [48, 0.12]], 0.2, 0.16, bus);
      if (beat % 2 === 1) Sfx.noise(t, 0.035, 'highpass', 7500, 0.03, 0.7, bus);
      if (beat === 4) Sfx.noise(t, 0.12, 'bandpass', 1800, 0.035, 0.6, bus);
      const r = this.rand();
      if ((beat % 2 === 0 && r < 0.42) || r < 0.1) {
        const m = PENTA[Math.floor(this.rand() * PENTA.length)] + (this.rand() < 0.2 ? 12 : 0);
        this.keys(mtof(m), t, e * (1.5 + this.rand() * 2), 0.045);
      }
      if (this.rand() < 0.3) Sfx.noise(t + this.rand() * e, 0.008, 'highpass', 3000, 0.02, 0.5, bus);   // vinyl crackle
    },
    keys(f, t, dur, vol) {                          // soft e-piano: detuned triangles through a lowpass
      const c = Sfx.ctx, g = c.createGain(), lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.4;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      for (const d of [-4, 4]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.05); }
      lp.connect(g); g.connect(Sfx.musicBus);
    },
    bass(f, t, dur) {
      const c = Sfx.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(Sfx.musicBus); o.start(t); o.stop(t + dur + 0.05);
    },
  };

  /* Haptics: Capacitor Haptics on native (via Platform.haptic), navigator.vibrate on web. */
  N.Haptics = {
    last: 0,
    fire(kind) {
      if (!S().haptics) return;
      const now = performance.now(); if (now - this.last < 60) return; this.last = now;
      try {
        if (window.Platform && typeof window.Platform.haptic === 'function') window.Platform.haptic(kind);
        else if (navigator.vibrate) navigator.vibrate({ light: 10, medium: 25, heavy: 40, warning: [30, 40, 30], success: [15, 30, 15] }[kind] || 10);
      } catch (e) {}
    },
  };

  window.addEventListener('pointerdown', () => Sfx.unlock(), { once: true, capture: true });
  window.addEventListener('keydown', () => Sfx.unlock(), { once: true, capture: true });
})(window.NMM);
