/* Procedural kawaii food art (3 face variants per tier), wildcard, ice, themed backgrounds & steamer. */
(function (N) {
'use strict';
const { W, H, S, BOX, TIERS, WILD_R } = N;
if (!CanvasRenderingContext2D.prototype.roundRect) {        // Safari < 16, Firefox < 112
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.max(0, Math.min(typeof r === 'number' ? r : 0, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); return this;
  };
}
const mkCanvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(hex, amt) { const [r, g, b] = rgb(hex), t = amt > 0 ? 255 : 0, p = Math.abs(amt);
  return `rgb(${Math.round(r + (t - r) * p)},${Math.round(g + (t - g) * p)},${Math.round(b + (t - b) * p)})`; }
function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function circ(c, x, y, r, fill, stroke, lw) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); } }
function ell(c, x, y, rx, ry, rot, fill) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
function ball(c, r, hex, o = {}) {
  const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r);
  g.addColorStop(0, mix(hex, o.hi ?? 0.45)); g.addColorStop(0.55, hex); g.addColorStop(1, mix(hex, -(o.lo ?? 0.28)));
  circ(c, 0, 0, r, g, o.line || mix(hex, -0.5), Math.max(3, r * 0.06));
}
function gloss(c, r, a = 0.6) {
  c.save(); c.translate(-r * 0.36, -r * 0.44); c.rotate(-0.6); ell(c, 0, 0, r * 0.26, r * 0.12, 0, `rgba(255,255,255,${a})`); c.restore();
  circ(c, -r * 0.64, -r * 0.1, r * 0.05, `rgba(255,255,255,${a * 0.8})`);
}
let FACE = 'normal';                                   // 'normal' | 'blink' | 'surprised'
function face(c, x, y, s, o = {}) {
  const eye = o.eye || '#2B1B17', mouth = o.mouth || eye;
  c.lineCap = 'round';
  if (FACE === 'blink') {
    for (const sx of [-1, 1]) { c.beginPath(); c.arc(x + sx * s * 0.3, y - s * 0.03, s * 0.08, 0.15 * Math.PI, 0.85 * Math.PI); c.lineWidth = Math.max(2, s * 0.045); c.strokeStyle = eye; c.stroke(); }
  } else if (FACE === 'surprised') {
    for (const sx of [-1, 1]) { circ(c, x + sx * s * 0.3, y - s * 0.02, s * 0.12, eye); circ(c, x + sx * s * 0.3 - s * 0.045, y - s * 0.07, s * 0.045, o.shine || '#fff'); circ(c, x + sx * s * 0.3 + s * 0.04, y + s * 0.03, s * 0.02, o.shine || '#fff'); }
  } else {
    for (const sx of [-1, 1]) { circ(c, x + sx * s * 0.3, y, s * 0.085, eye); circ(c, x + sx * s * 0.3 - s * 0.03, y - s * 0.035, s * 0.03, o.shine || '#fff'); }
  }
  if (FACE === 'surprised') { ell(c, x, y + s * 0.13, s * 0.065, s * 0.085, 0, mouth); }
  else { c.beginPath(); c.arc(x, y + s * 0.04, s * 0.1, 0.18 * Math.PI, 0.82 * Math.PI); c.lineWidth = Math.max(2, s * 0.045); c.strokeStyle = mouth; c.stroke(); }
  for (const sx of [-1, 1]) ell(c, x + sx * s * 0.5, y + s * 0.1, s * 0.12, s * 0.065, 0, o.blush || 'rgba(255,110,140,.5)');
}
function clipCircle(c, r) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.clip(); }

const ART = {
  1(c, r, h) { ball(c, r, h, { hi: 0.3, lo: 0.1, line: '#0d0605' }); gloss(c, r, 0.75); face(c, 0, r * 0.12, r * 0.95, { eye: '#F7E1C8', shine: '#2B1B17' }); },
  2(c, r, h) {
    ball(c, r, h);
    for (const sx of [-1, 1]) { circ(c, sx * r * 0.4, -r * 0.36, r * 0.27, mix(h, 0.22), mix(h, -0.35), Math.max(2, r * 0.05)); circ(c, sx * r * 0.4 - r * 0.08, -r * 0.44, r * 0.07, 'rgba(255,255,255,.55)'); }
    c.beginPath(); c.moveTo(0, -r * 0.95); c.quadraticCurveTo(r * 0.12, -r * 1.12, r * 0.22, -r * 1.05); c.lineWidth = r * 0.1; c.lineCap = 'round'; c.strokeStyle = '#4E8F5E'; c.stroke();
    face(c, 0, r * 0.25, r * 0.78);
  },
  3(c, r, h, rnd) {
    const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, '#36493F'); g.addColorStop(1, '#16211C');
    circ(c, 0, 0, r, g, '#0b120f', Math.max(3, r * 0.06));
    circ(c, 0, 0, r * 0.8, '#FBF7F0', '#E2D9CB', Math.max(2, r * 0.03));
    for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, d = r * (0.5 + rnd() * 0.26); ell(c, Math.cos(a) * d, Math.sin(a) * d, r * 0.07, r * 0.035, a + 1.2, '#ECE4D6'); }
    const fg = c.createRadialGradient(-r * 0.12, -r * 0.12, 1, 0, 0, r * 0.46); fg.addColorStop(0, mix(h, 0.3)); fg.addColorStop(1, mix(h, -0.15));
    circ(c, 0, 0, r * 0.46, fg, mix(h, -0.35), Math.max(2, r * 0.03));
    c.save(); clipCircle(c, r * 0.46); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = r * 0.04;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-r, i * r * 0.17 - r * 0.3); c.lineTo(r, i * r * 0.17 + r * 0.3); c.stroke(); } c.restore();
    circ(c, r * 0.24, -r * 0.24, r * 0.1, '#76C893', '#3E7D52', Math.max(1.5, r * 0.025));
    gloss(c, r, 0.35); face(c, 0, r * 0.06, r * 0.5);
  },
  4(c, r, h) {
    ball(c, r, h, { hi: 0.5 });
    c.save(); clipCircle(c, r); const cg = c.createLinearGradient(0, r * 0.35, 0, r); cg.addColorStop(0, 'rgba(140,70,20,0)'); cg.addColorStop(1, 'rgba(140,70,20,.7)');
    c.fillStyle = cg; c.fillRect(-r, r * 0.3, 2 * r, r); c.restore();
    c.strokeStyle = mix(h, -0.35); c.lineWidth = Math.max(2.5, r * 0.06); c.lineCap = 'round';
    c.beginPath(); c.arc(0, r * 0.55, r * 1.05, 1.18 * Math.PI, 1.82 * Math.PI); c.stroke();
    for (let i = 0; i < 7; i++) { const a = (1.24 + i * 0.087) * Math.PI, x = Math.cos(a) * r * 1.05, y = r * 0.55 + Math.sin(a) * r * 1.05;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x * 0.9 + r * 0.05, y - r * 0.2, x * 0.85, y - r * 0.32); c.stroke(); }
    gloss(c, r, 0.5); face(c, 0, r * 0.22, r * 0.72);
  },
  5(c, r, h, rnd) {
    ball(c, r, h, { hi: 0.35 });
    c.beginPath(); c.moveTo(-r * 0.92, -r * 0.05);
    c.arc(0, 0, r * 0.92, Math.PI, 2 * Math.PI);
    for (let i = 0; i <= 8; i++) { const x = r * 0.92 - i * r * 0.23; c.lineTo(x, (i % 2 ? r * 0.12 : -r * 0.02)); }
    c.closePath(); c.fillStyle = '#4A2511'; c.fill();
    c.strokeStyle = '#FFF8E7'; c.lineWidth = Math.max(2, r * 0.045); c.lineJoin = 'round'; c.beginPath();
    for (let i = 0; i <= 8; i++) { const x = -r * 0.7 + i * r * 0.175, y = -r * 0.5 + (i % 2 ? r * 0.28 : 0); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    for (let i = 0; i < 14; i++) { const a = Math.PI + rnd() * Math.PI, d = r * rnd() * 0.8; circ(c, Math.cos(a) * d, Math.sin(a) * d - r * 0.05, r * 0.035, '#6BAA4A'); }
    for (let i = 0; i < 4; i++) { c.save(); c.translate((rnd() - 0.5) * r, -r * 0.35 - rnd() * r * 0.4); c.rotate(rnd() * 3); ell(c, 0, 0, r * 0.13, r * 0.05, 0, '#E8A98A'); c.restore(); }
    gloss(c, r, 0.4); face(c, 0, r * 0.42, r * 0.6);
  },
  6(c, r, h, rnd) {
    ball(c, r, h, { hi: 0.6, lo: 0.12, line: '#C3C8CE' });
    c.save(); clipCircle(c, r * 0.98); c.fillStyle = '#1F2D27'; c.fillRect(-r * 0.5, r * 0.42, r, r);
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-r * 0.5, r * 0.42, r * 0.12, r); c.restore();
    for (let i = 0; i < 12; i++) { const a = rnd() * Math.PI * 2, d = r * (0.2 + rnd() * 0.65); if (Math.sin(a) * d > r * 0.3) continue;
      ell(c, Math.cos(a) * d, Math.sin(a) * d, r * 0.03, r * 0.015, rnd() * 3, '#2B2B2B'); }
    gloss(c, r, 0.9); face(c, 0, -r * 0.02, r * 0.7);
  },
  7(c, r, h) {
    ball(c, r, h, { hi: 0.55, lo: 0.2 });
    c.strokeStyle = mix(h, -0.28); c.lineWidth = Math.max(2.5, r * 0.035); c.lineCap = 'round';
    const cx = 0, cy = -r * 0.38;
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * r * 0.05, cy + Math.sin(a) * r * 0.05);
      c.quadraticCurveTo(cx + Math.cos(a + 0.6) * r * 0.25, cy + Math.sin(a + 0.6) * r * 0.2, cx + Math.cos(a + 0.3) * r * 0.38, cy + Math.sin(a + 0.3) * r * 0.3); c.stroke(); }
    circ(c, cx, cy, r * 0.06, '#E63946');
    gloss(c, r, 0.55); face(c, 0, r * 0.25, r * 0.66);
  },
  8(c, r, h, rnd) {
    const dg = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); dg.addColorStop(0, '#F6CF97'); dg.addColorStop(1, '#C98A47');
    circ(c, 0, 0, r, dg, '#8A5527', Math.max(3, r * 0.05));
    c.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, rr = r * (0.84 + 0.05 * Math.sin(a * 7) + 0.03 * Math.sin(a * 13));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath();
    const gg = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r); gg.addColorStop(0, mix(h, 0.4)); gg.addColorStop(1, mix(h, -0.2));
    c.fillStyle = gg; c.fill(); c.strokeStyle = mix(h, -0.4); c.lineWidth = Math.max(2, r * 0.025); c.stroke();
    const cols = ['#FFF8E7', '#FF9EB5', '#6B3E26', '#FFD166'];
    for (let i = 0; i < 24; i++) { const a = rnd() * Math.PI * 2, d = r * (0.38 + rnd() * 0.38); if (Math.sin(a) > 0.55 && d < r * 0.7) continue;
      c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(rnd() * 3); c.fillStyle = cols[i % 4];
      c.beginPath(); c.roundRect(-r * 0.06, -r * 0.018, r * 0.12, r * 0.036, r * 0.018); c.fill(); c.restore(); }
    c.save(); c.globalCompositeOperation = 'destination-out'; circ(c, 0, -r * 0.06, r * 0.26, '#000'); c.restore();
    circ(c, 0, -r * 0.06, r * 0.26, null, '#B57A3C', Math.max(3, r * 0.05));
    gloss(c, r, 0.45); face(c, 0, r * 0.52, r * 0.46);
  },
  9(c, r, h, rnd) {
    const bg = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r); bg.addColorStop(0, mix(h, 0.25)); bg.addColorStop(1, mix(h, -0.3));
    circ(c, 0, 0, r, bg, mix(h, -0.55), Math.max(3, r * 0.04));
    c.strokeStyle = '#FFF8E7'; c.lineWidth = r * 0.025;
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; c.beginPath(); c.arc(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.045, a, a + Math.PI); c.stroke(); }
    const br = c.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 0.8); br.addColorStop(0, '#F8D79A'); br.addColorStop(1, '#C9822F');
    circ(c, 0, 0, r * 0.8, br, '#7A2A22', Math.max(2, r * 0.03));
    c.save(); clipCircle(c, r * 0.79);
    c.strokeStyle = '#F7DC7E'; c.lineWidth = r * 0.035; c.lineCap = 'round';
    for (let k = 0; k < 9; k++) { c.beginPath(); const y0 = r * (0.05 + k * 0.08); for (let x = -r * 0.8; x <= r * 0.8; x += r * 0.04) { const y = y0 + Math.sin(x / r * 14 + k) * r * 0.03; x === -r * 0.8 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); }
    c.restore();
    c.save(); c.translate(-r * 0.05, -r * 0.62); c.rotate(-0.12); c.fillStyle = '#1F2D27'; c.fillRect(-r * 0.26, -r * 0.18, r * 0.52, r * 0.34); c.restore();
    circ(c, -r * 0.38, -r * 0.18, r * 0.24, '#C77B5C', '#8E4B33', r * 0.02); circ(c, -r * 0.38, -r * 0.18, r * 0.16, '#E7A98C'); circ(c, -r * 0.38, -r * 0.18, r * 0.07, '#F4D2BF');
    ell(c, r * 0.32, -r * 0.22, r * 0.23, r * 0.18, 0.3, '#FFFDF6'); circ(c, r * 0.33, -r * 0.21, r * 0.11, '#F7A531'); circ(c, r * 0.3, -r * 0.24, r * 0.035, 'rgba(255,255,255,.7)');
    circ(c, r * 0.05, r * 0.42, r * 0.15, '#FFFDF6', '#E8D9C4', r * 0.015);
    c.strokeStyle = '#F25C8A'; c.lineWidth = r * 0.025; c.beginPath(); for (let t = 0; t < 12; t += 0.2) { const rr = t * r * 0.009, x = r * 0.05 + Math.cos(t) * rr, y = r * 0.42 + Math.sin(t) * rr; t ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, d = r * (0.1 + rnd() * 0.6); circ(c, Math.cos(a) * d, Math.sin(a) * d, r * 0.035, null, '#5DAE52', r * 0.018); }
    face(c, r * 0.33, -r * 0.2, r * 0.16, { eye: '#5A2A10' });
  },
  10(c, r, h, rnd) {
    const pg = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r); pg.addColorStop(0, '#FFFFFF'); pg.addColorStop(1, '#E3DACB');
    circ(c, 0, 0, r, pg, '#A68A5B', Math.max(3, r * 0.035));
    circ(c, 0, 0, r * 0.91, null, h, r * 0.035);
    const cg = c.createRadialGradient(r * 0.1, r * 0.1, r * 0.1, 0, 0, r * 0.8); cg.addColorStop(0, mix(h, 0.1)); cg.addColorStop(1, '#C98F2E');
    c.beginPath(); for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2, rr = r * (0.76 + 0.03 * Math.sin(a * 6)); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.closePath(); c.fillStyle = cg; c.fill();
    circ(c, -r * 0.28, -r * 0.18, r * 0.43, '#FFFEFA', '#E6DDCF', r * 0.015);
    for (let i = 0; i < 30; i++) { const a = rnd() * Math.PI * 2, d = r * 0.38 * Math.sqrt(rnd()); ell(c, -r * 0.28 + Math.cos(a) * d, -r * 0.18 + Math.sin(a) * d, r * 0.04, r * 0.02, rnd() * 3, '#EFE8DA'); }
    for (let i = 0; i < 4; i++) { c.save(); c.translate(r * (0.12 + i * 0.13), r * (0.28 + i * 0.05)); c.rotate(-0.5);
      c.fillStyle = '#C8792B'; c.beginPath(); c.roundRect(-r * 0.06, -r * 0.2, r * 0.12, r * 0.4, r * 0.03); c.fill(); c.fillStyle = '#F2E6D2'; c.fillRect(-r * 0.045, -r * 0.18, r * 0.02, r * 0.36); c.restore(); }
    for (let i = 0; i < 6; i++) { const x = r * (0.2 + rnd() * 0.45), y = -r * (0.05 + rnd() * 0.5); c.save(); c.translate(x, y); c.rotate(rnd());
      c.fillStyle = i % 2 ? '#F08A24' : '#F3D88F'; c.beginPath(); c.roundRect(-r * 0.06, -r * 0.06, r * 0.12, r * 0.12, r * 0.03); c.fill(); c.restore(); }
    face(c, -r * 0.28, -r * 0.14, r * 0.36);
  },
  11(c, r, h, rnd) {
    const mg = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.2, 0, 0, r); mg.addColorStop(0, '#C9D1D6'); mg.addColorStop(1, '#4B545B');
    circ(c, 0, 0, r, mg, '#2A2F33', Math.max(3, r * 0.03));
    circ(c, 0, 0, r * 0.92, null, 'rgba(255,255,255,.35)', r * 0.012);
    const R = r * 0.86; c.save(); clipCircle(c, R);
    const red = c.createRadialGradient(-r * 0.3, 0, r * 0.1, 0, 0, R); red.addColorStop(0, mix(h, 0.2)); red.addColorStop(1, mix(h, -0.35));
    c.fillStyle = red; c.fillRect(-R, -R, 2 * R, 2 * R);
    c.beginPath(); c.moveTo(0, -R); c.arc(0, -R / 2, R / 2, -Math.PI / 2, Math.PI / 2, false); c.arc(0, R / 2, R / 2, -Math.PI / 2, Math.PI / 2, true); c.arc(0, 0, R, Math.PI / 2, -Math.PI / 2, true); c.closePath();
    c.fillStyle = '#F3E3C3'; c.fill();
    c.beginPath(); c.moveTo(0, -R); c.arc(0, -R / 2, R / 2, -Math.PI / 2, Math.PI / 2, false); c.arc(0, R / 2, R / 2, -Math.PI / 2, Math.PI / 2, true);
    c.strokeStyle = '#7E878D'; c.lineWidth = r * 0.04; c.stroke();
    for (let i = 0; i < 26; i++) { const x = -R + rnd() * R * 1.1, y = (rnd() - 0.5) * 2 * R; circ(c, x, y, r * (0.015 + rnd() * 0.03), 'rgba(255,170,40,.55)'); }
    c.restore();
    for (let i = 0; i < 5; i++) { c.save(); c.translate(-r * 0.45 + rnd() * r * 0.25, -r * 0.45 + i * r * 0.2); c.rotate(rnd() * 3); ell(c, 0, 0, r * 0.09, r * 0.025, 0, '#8E0000'); c.restore(); }
    for (let i = 0; i < 3; i++) { c.save(); c.translate(r * 0.42, -r * 0.35 + i * r * 0.18); c.rotate(0.2 * i); c.fillStyle = '#FFFBEF'; c.strokeStyle = '#E2D3B5'; c.lineWidth = r * 0.012;
      c.beginPath(); c.roundRect(-r * 0.09, -r * 0.07, r * 0.18, r * 0.14, r * 0.02); c.fill(); c.stroke(); c.restore(); }
    c.strokeStyle = '#F7F1E1'; c.lineWidth = r * 0.018; c.lineCap = 'round';
    for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(r * 0.15 + i * r * 0.025, r * 0.15); c.lineTo(r * 0.22 + i * r * 0.03, r * 0.5); c.stroke(); circ(c, r * 0.22 + i * r * 0.03, r * 0.5, r * 0.018, '#E9DFC6'); }
    c.strokeStyle = '#FF7F50'; c.lineWidth = r * 0.06; for (let i = 0; i < 2; i++) { c.beginPath(); c.arc(-r * 0.25 + i * r * 0.22, r * 0.45, r * 0.09, 0.2, 4.4); c.stroke(); }
    ell(c, -r * 0.08, -r * 0.62, r * 0.16, r * 0.08, -0.3, '#4D9E3A'); ell(c, r * 0.55, r * 0.05, r * 0.15, r * 0.07, 1.1, '#5DB24A');
    circ(c, -r * 0.42, r * 0.02, r * 0.13, '#F1E7DA', '#C8BBA6', r * 0.012);
    face(c, -r * 0.42, r * 0.02, r * 0.14, { eye: '#3B1F14' });
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = r * 0.03;
    for (let i = 0; i < 3; i++) { c.beginPath(); const x = -r * 0.2 + i * r * 0.2; c.moveTo(x, -r * 0.1); c.bezierCurveTo(x + r * 0.1, -r * 0.2, x - r * 0.1, -r * 0.3, x, -r * 0.42); c.stroke(); }
  },
};

function foodCanvas(tier, mode = 'normal') {
  FACE = mode;
  const t = TIERS[tier], r = t.r * S, pad = 8 * S, size = Math.ceil(2 * (r + pad));
  const cv = mkCanvas(size), c = cv.getContext('2d'); c.translate(size / 2, size / 2);
  ART[tier](c, r, t.hex, seeded(tier * 977)); FACE = 'normal'; return cv;
}
function wildCanvas() {
  const r = WILD_R * S, pad = 8 * S, size = Math.ceil(2 * (r + pad)), cv = mkCanvas(size), c = cv.getContext('2d'); c.translate(size / 2, size / 2);
  const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r); g.addColorStop(0, '#FFF3B0'); g.addColorStop(0.5, '#FFC93C'); g.addColorStop(1, '#C27A0E');
  circ(c, 0, 0, r, g, '#7A4A05', Math.max(3, r * 0.08));
  c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.27 : r * 0.62; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath();
  c.fillStyle = '#FFFBEA'; c.fill(); c.lineWidth = r * 0.06; c.strokeStyle = '#E09F3E'; c.lineJoin = 'round'; c.stroke();
  const rnd = seeded(77); for (let i = 0; i < 8; i++) { const a = rnd() * 6.28, d = r * (0.66 + rnd() * 0.2); ell(c, Math.cos(a) * d, Math.sin(a) * d, r * 0.07, r * 0.03, a, '#D62828'); }
  gloss(c, r, 0.8); return cv;
}
function iceCanvas(tier) {
  const r = TIERS[tier].r * S * 1.04, pad = 8 * S, size = Math.ceil(2 * (r + pad)), cv = mkCanvas(size), c = cv.getContext('2d'); c.translate(size / 2, size / 2);
  const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r); g.addColorStop(0, 'rgba(240,252,255,.65)'); g.addColorStop(1, 'rgba(150,210,245,.5)');
  circ(c, 0, 0, r, g, 'rgba(235,250,255,.95)', Math.max(3, r * 0.07));
  const rnd = seeded(tier * 31); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = Math.max(1.5, r * 0.02);
  for (let k = 0; k < 4; k++) { let a = rnd() * 6.28, x = Math.cos(a) * r * 0.95, y = Math.sin(a) * r * 0.95; c.beginPath(); c.moveTo(x, y);
    for (let s = 0; s < 4; s++) { x *= 0.72; y *= 0.72; x += (rnd() - 0.5) * r * 0.25; y += (rnd() - 0.5) * r * 0.25; c.lineTo(x, y); } c.stroke(); }
  c.save(); c.translate(-r * 0.4, -r * 0.42); c.rotate(-0.7); ell(c, 0, 0, r * 0.3, r * 0.09, 0, 'rgba(255,255,255,.8)'); c.restore();
  for (let i = 0; i < 3; i++) { const x = (rnd() - 0.3) * r, y = (rnd() - 0.6) * r, s = r * 0.08; c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.25, y); c.lineTo(x, y + s); c.lineTo(x - s * 0.25, y); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x - s, y); c.lineTo(x, y + s * 0.25); c.lineTo(x + s, y); c.lineTo(x, y - s * 0.25); c.closePath(); c.fill(); }
  return cv;
}

function bgCanvas(th) {
  const cv = mkCanvas(W, H), c = cv.getContext('2d'); c.fillStyle = th.bg; c.fillRect(0, 0, W, H);
  const rnd = seeded(5);
  if (th.pattern === 'planks') {
    for (let y = 0, i = 0; y < H; y += 74, i++) {
      c.fillStyle = mix(th.bg, (rnd() - 0.5) * 0.12); c.fillRect(0, y, W, 74);
      c.strokeStyle = 'rgba(255,220,180,.05)'; c.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) { c.beginPath(); const yy = y + 12 + k * 15 + rnd() * 6; for (let x = 0; x <= W; x += 12) { const v = yy + Math.sin(x / 70 + k + i) * 3; x ? c.lineTo(x, v) : c.moveTo(x, v); } c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, y, W, 2);
    }
  } else if (th.pattern === 'grid') {
    const g0 = c.createLinearGradient(0, 0, 0, H); g0.addColorStop(0, '#0B0820'); g0.addColorStop(1, '#1D1250'); c.fillStyle = g0; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(62,242,255,.07)'; c.lineWidth = 1;
    for (let x = 0; x <= W; x += 30) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y <= H; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.strokeStyle = 'rgba(255,79,216,.12)'; c.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const x = rnd() * W, y = rnd() * H, l = 20 + rnd() * 60; c.beginPath(); c.moveTo(x, y); c.lineTo(x - l * 0.15, y + l); c.stroke(); }   // rain streaks
  } else if (th.pattern === 'clouds') {
    const g0 = c.createLinearGradient(0, 0, 0, H); g0.addColorStop(0, '#3A080E'); g0.addColorStop(1, '#5E121A'); c.fillStyle = g0; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(232,184,74,.14)'; c.lineWidth = 2.5;
    for (let row = 0; row < 12; row++) for (let col = 0; col < 5; col++) {
      const x = col * 120 + (row % 2) * 60, y = row * 84 + 30;
      c.beginPath(); c.arc(x, y, 16, Math.PI, 0); c.arc(x + 26, y, 10, Math.PI, 0); c.arc(x - 22, y + 2, 8, Math.PI, 0); c.stroke();
      c.beginPath(); c.moveTo(x - 30, y + 2); c.lineTo(x + 36, y); c.stroke();
    }
  }
  for (const [x, y, rr, a, col] of [[70, 40, 300, 0.24, th.glow], [480, 20, 260, 0.2, th.glow2], [270, 900, 380, 0.16, th.glow]]) {
    const g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${th.vignette})`); c.fillStyle = v; c.fillRect(0, 0, W, H);
  return cv;
}
function steamerBack(th) {
  const cv = mkCanvas(W, H), c = cv.getContext('2d');
  const g = c.createLinearGradient(0, BOX.y, 0, BOX.bottom); g.addColorStop(0, th.innerTop); g.addColorStop(1, th.innerBot); c.fillStyle = g; c.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
  for (let x = BOX.x, i = 0; x < BOX.right; x += 23, i++) {
    c.fillStyle = `rgba(${th.slat},${i % 2 ? 0.05 : 0.1})`; c.fillRect(x, BOX.y, 23, BOX.h);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x, BOX.y, 1.5, BOX.h);
    for (let y = BOX.y + 90 + (i % 3) * 40; y < BOX.bottom; y += 150) { c.fillStyle = `rgba(${th.slat},.12)`; c.fillRect(x + 2, y, 19, 3); }
  }
  const sh = c.createLinearGradient(0, BOX.y, 0, BOX.y + 90); sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(BOX.x, BOX.y, BOX.w, 90);
  const fl = c.createRadialGradient(W / 2, BOX.bottom, 10, W / 2, BOX.bottom, 300); fl.addColorStop(0, `rgba(${th.floor},.16)`); fl.addColorStop(1, `rgba(${th.floor},0)`); c.fillStyle = fl; c.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
  return cv;
}
function steamerFront(th) {
  const cv = mkCanvas(W, H), c = cv.getContext('2d'), T = 16;
  const band = (x, y, w, h, rad) => {
    c.save(); c.beginPath(); c.roundRect(x, y, w, h, rad); c.fillStyle = th.rim; c.fill(); c.clip();
    const cell = 8;
    for (let i = 0; i * cell < w; i++) for (let j = 0; j * cell < h; j++) {
      const cx = x + i * cell, cy = y + j * cell; c.fillStyle = (i + j) % 2 ? th.rimA : th.rimB; c.fillRect(cx, cy, cell, cell);
      c.strokeStyle = th.rimLine; c.lineWidth = 1; c.beginPath();
      if ((i + j) % 2) { c.moveTo(cx, cy + cell / 2); c.lineTo(cx + cell, cy + cell / 2); } else { c.moveTo(cx + cell / 2, cy); c.lineTo(cx + cell / 2, cy + cell); } c.stroke();
    }
    const hl = c.createLinearGradient(x, y, x + w, y + h); hl.addColorStop(0, 'rgba(255,240,200,.25)'); hl.addColorStop(1, 'rgba(0,0,0,.2)'); c.fillStyle = hl; c.fillRect(x, y, w, h);
    c.restore();
    c.save(); if (th.rimGlow) { c.shadowColor = th.rimGlow; c.shadowBlur = 14; }
    c.beginPath(); c.roundRect(x, y, w, h, rad); c.lineWidth = 3; c.strokeStyle = th.rimEdge; c.stroke(); c.restore();
  };
  band(BOX.x - T, BOX.y - 14, T, BOX.h + 14 + T, 7);
  band(BOX.right, BOX.y - 14, T, BOX.h + 14 + T, 7);
  band(BOX.x - T, BOX.bottom, BOX.w + 2 * T, T + 4, 8);
  for (const x of [BOX.x - T - 3, BOX.right - 3]) {
    c.save(); if (th.rimGlow) { c.shadowColor = th.cap; c.shadowBlur = 16; }
    c.beginPath(); c.roundRect(x, BOX.y - 22, T + 6, 14, 6); c.fillStyle = th.cap; c.fill(); c.lineWidth = 3; c.strokeStyle = th.rimEdge; c.stroke(); c.restore();
  }
  return cv;
}
function dotCanvas() { const cv = mkCanvas(32), c = cv.getContext('2d'); const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); return cv; }

N.Art = { foodCanvas, wildCanvas, iceCanvas, bgCanvas, steamerBack, steamerFront, dotCanvas, mkCanvas, mix, seeded, circ, ell };
})(window.NMM);
