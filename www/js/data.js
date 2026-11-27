/* Dim Sum Drop: Night Market — static game data (tiers, upgrades, themes, missions, rewards). */
window.NMM = window.NMM || {};
(function (N) {
  'use strict';

  N.VERSION = '1.0.0';
  N.W = 540; N.H = 960; N.S = 2;                       // logical size; S = texture supersampling
  N.BOX = { x: 40, y: 205, w: 460, h: 620 };
  N.BOX.right = N.BOX.x + N.BOX.w; N.BOX.bottom = N.BOX.y + N.BOX.h;
  N.DANGER_Y = N.BOX.y + 40;
  N.HOLD_Y = 168;
  N.WILD_R = 26;
  N.CFG = { DROP_COOLDOWN: 450, MIN_AGE: 1500, GRACE_MS: 3000, COMBO_WINDOW: 1500, COMBO_MAX: 5, FROZEN_SCORE: 1500, FROZEN_CHANCE: 0.1 };
  N.PHYS = { restitution: 0.25, friction: 0.06, frictionAir: 0.005, density: 0.002 };

  N.TIERS = [null,
    { name: 'Boba Pearl',    r: 18,  hex: '#2B1B17', score: 2,    coins: 1,   spawn: 30 },
    { name: 'Edamame',       r: 24,  hex: '#76C893', score: 4,    coins: 1,   spawn: 28 },
    { name: 'Maki Roll',     r: 31,  hex: '#FF6B6B', score: 8,    coins: 2,   spawn: 22 },
    { name: 'Golden Gyoza',  r: 39,  hex: '#F4A261', score: 16,   coins: 3,   spawn: 12 },
    { name: 'Takoyaki',      r: 48,  hex: '#8D5524', score: 32,   coins: 5,   spawn: 8 },
    { name: 'Onigiri',       r: 58,  hex: '#F8F9FA', score: 64,   coins: 8,   spawn: 0 },
    { name: 'Steamed Baozi', r: 69,  hex: '#FFE5B4', score: 128,  coins: 12,  spawn: 0 },
    { name: 'Matcha Donut',  r: 81,  hex: '#52B788', score: 256,  coins: 20,  spawn: 0 },
    { name: 'Ramen Bowl',    r: 94,  hex: '#E63946', score: 512,  coins: 35,  spawn: 0 },
    { name: 'Curry Plate',   r: 108, hex: '#E9C46A', score: 1024, coins: 60,  spawn: 0 },
    { name: 'Giant Hotpot',  r: 124, hex: '#D00000', score: 2048, coins: 150, spawn: 0 },
  ];

  // First-time discovery rewards (Tier 5–11)
  N.DISCOVERY_GEMS = { 5: 25, 6: 40, 7: 60, 8: 90, 9: 120, 10: 160, 11: 200 };

  // Night Market Stall meta-upgrades (Lv 0–5, bought with coins)
  N.UPGRADES = [
    { id: 'steamer', name: 'Bamboo Steamer', costs: [300, 700, 1500, 3000, 6000],
      effect: lv => lv ? `+${lv * 10}% coins` : 'No bonus yet', next: lv => `+${(lv + 1) * 10}% coins` },
    { id: 'cat', name: 'Lucky Cat', costs: [400, 900, 1800, 3600, 7000],
      effect: lv => lv ? `Wok Fever window +${lv * 200}ms` : 'No bonus yet', next: lv => `Wok Fever window +${(lv + 1) * 200}ms` },
    { id: 'ladle', name: 'Golden Ladle', costs: [500, 1100, 2200, 4400, 8500],
      effect: lv => ladleText(lv) || 'No bonus yet', next: lv => ladleText(lv + 1) },
    { id: 'spice', name: 'Spice Jar', costs: [500, 1200, 2500, 5000, 9000],
      effect: lv => `Golden Spice every ${15 - lv} drops`, next: lv => `Golden Spice every ${14 - lv} drops` },
    { id: 'lanterns', name: 'Neon Lanterns', costs: [400, 1000, 2200, 4500, 8500],
      effect: lv => lv ? `+${lv * 5}% score` : 'No bonus yet', next: lv => `+${(lv + 1) * 5}% score` },
  ];
  function ladleText(lv) {
    const parts = [];
    if (lv >= 1) parts.push(`+${lv * 25} coins per run`);
    if (lv >= 3) parts.push('+1 free Toss');
    if (lv >= 5) parts.push('+1 free Swap');
    return parts.join(' · ');
  }
  N.effects = function (up) {
    const lv = id => (up && up[id]) || 0;
    return {
      coinMult: 1 + 0.10 * lv('steamer'),
      comboWindow: N.CFG.COMBO_WINDOW + 200 * lv('cat'),
      runBonusCoins: 25 * lv('ladle'),
      freeToss: 1 + (lv('ladle') >= 3 ? 1 : 0),
      freeSwap: lv('ladle') >= 5 ? 1 : 0,
      spiceEvery: 15 - lv('spice'),
      scoreMult: 1 + 0.05 * lv('lanterns'),
    };
  };

  // Visual themes
  N.THEMES = {
    wood: { name: 'Night Market Wood', blurb: 'Warm lantern light over old market planks.', coins: 0, gems: 0,
      bg: '#2C1A1D', pattern: 'planks', glow: '255,140,60', glow2: '255,140,60', vignette: 0.45,
      innerTop: '#1F110D', innerBot: '#3E2619', slat: '217,160,91', floor: '255,190,110',
      rim: '#D9A05B', rimA: '#E2AE6A', rimB: '#C98F4A', rimLine: 'rgba(90,52,32,.45)', rimEdge: '#5A3420', cap: '#F0C27E', rimGlow: null, danger: 0xE63946 },
    neon: { name: 'Tokyo Neon Ramen', blurb: 'Rain-soaked alley, cyan and pink neon.', coins: 2500, gems: 150,
      bg: '#120E2B', pattern: 'grid', glow: '255,79,216', glow2: '62,242,255', vignette: 0.55,
      innerTop: '#090818', innerBot: '#1B1442', slat: '62,242,255', floor: '255,79,216',
      rim: '#1B1F4A', rimA: '#262B66', rimB: '#161A3D', rimLine: 'rgba(62,242,255,.55)', rimEdge: '#3EF2FF', cap: '#FF4FD8', rimGlow: '#3EF2FF', danger: 0xFF4FD8 },
    gold: { name: 'Imperial Gold Banquet', blurb: 'Crimson lacquer trimmed in palace gold.', coins: 5000, gems: 300,
      bg: '#4A0E14', pattern: 'clouds', glow: '255,200,90', glow2: '255,120,80', vignette: 0.5,
      innerTop: '#24060A', innerBot: '#5A1218', slat: '232,184,74', floor: '255,210,120',
      rim: '#E8B84A', rimA: '#F4CF6E', rimB: '#C9952F', rimLine: 'rgba(107,26,16,.45)', rimEdge: '#6B1A10', cap: '#FFE08A', rimGlow: null, danger: 0xFFD166 },
  };
  N.THEME_ORDER = ['wood', 'neon', 'gold'];

  // Daily missions pool (3 per day, distinct types)
  N.MISSION_POOL = [
    { id: 'merge20',  type: 'merge',   goal: 20,   text: 'Merge 20 dishes',                 gems: 10, coins: 150 },
    { id: 'merge60',  type: 'merge',   goal: 60,   text: 'Merge 60 dishes',                 gems: 20, coins: 300 },
    { id: 'fever1',   type: 'fever3',  goal: 1,    text: 'Trigger ×3 Wok Fever',            gems: 15, coins: 150 },
    { id: 'fever3',   type: 'fever3',  goal: 3,    text: 'Trigger ×3 Wok Fever 3 times',    gems: 25, coins: 300 },
    { id: 'score1k',  type: 'score',   goal: 1000, text: 'Reach 1,000 score in one run',    gems: 10, coins: 150 },
    { id: 'score4k',  type: 'score',   goal: 4000, text: 'Reach 4,000 score in one run',    gems: 25, coins: 350 },
    { id: 'boost1',   type: 'booster', goal: 1,    text: 'Use a booster',                   gems: 10, coins: 100 },
    { id: 'boost3',   type: 'booster', goal: 3,    text: 'Use 3 boosters',                  gems: 20, coins: 250 },
    { id: 'tier6',    type: 'tier',    goal: 6,    text: 'Cook an Onigiri',                 gems: 15, coins: 200 },
    { id: 'tier8',    type: 'tier',    goal: 8,    text: 'Cook a Matcha Donut',             gems: 30, coins: 400 },
    { id: 'drop80',   type: 'drop',    goal: 80,   text: 'Drop 80 dishes',                  gems: 10, coins: 150 },
    { id: 'thaw2',    type: 'thaw',    goal: 2,    text: 'Thaw 2 Frozen Dumplings',         gems: 20, coins: 250 },
    { id: 'spice2',   type: 'wild',    goal: 2,    text: 'Merge with 2 Golden Spice orbs',  gems: 15, coins: 200 },
  ];

  // 7-day login streak
  N.STREAK = [
    { coins: 100 }, { gems: 20 }, { wild: 1 }, { coins: 300 }, { gems: 40 }, { wild: 2 }, { gems: 100, coins: 500, wild: 1 },
  ];

  N.PRODUCTS = {
    remove_ads_pack: { name: 'Remove Ads + 2x Coins', desc: 'No ad breaks between runs, and every coin you earn counts double.', fallbackPrice: '$2.99' },
    starter_gems:    { name: 'Starter Gems', desc: '500 gems and 3 Golden Spice wildcards.', fallbackPrice: '$1.99' },
    starter_bundle:  { name: 'Starter Bundle', desc: '500 gems, 3 Golden Spice wildcards, and 3 days with no ad breaks.', fallbackPrice: '$0.99' },
  };
})(window.NMM);
