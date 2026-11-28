# Audit Package: Dim Sum Drop: Night Market

Prepared 28 Nov 2026 for independent quality review.

| | |
|---|---|
| Repository | `github.com/fsdfagultiq/fsdfagultiq-merge-game.` (private; the name ends with a dot) |
| Branch / commit audited | `main` @ `39ffd0f` |
| Playable web preview | https://claude.ai/artifact/T2qZwSSeCBMRXTm6DSq2Hy (single-file bundle of the same code; Phaser from CDN; ads and purchases simulated) |
| Automated test log | `audit/test-results.txt` (fresh run for this package) |
| Test screenshots | `audit/test-screenshots/` |
| Store graphics | `store-assets/` |

**Read this first.** Everything below was built and verified in a Linux cloud container with headless Chromium. **No native Android or iOS binary has been compiled or run** (no Android SDK, no macOS/Xcode). Native items were checked by reading config and plugin source, not by running them. They are marked **Not run** in the matrix.

---

## 1. How to reproduce

```bash
git clone https://github.com/fsdfagultiq/fsdfagultiq-merge-game. dimsum && cd dimsum
npm install
npm i -D playwright && npx playwright install chromium   # only for tests / asset generation
npm run serve            # play at http://localhost:5173
npm test                 # 70-check headless end-to-end suite, offline (blocks all non-localhost requests)
npm run assets           # regenerates store-assets/ PNGs, Android launcher icons/splash, iOS icon/splash
npm run typecheck        # capacitor.config.ts
npx cap sync             # copies www/ into android/ and ios/ (succeeded in the build container)
```

A native build needs the Android SDK + JDK 21 (`cd android && ./gradlew bundleRelease`) or the Codemagic `android-release` workflow. Release builds fail on purpose when no upload keystore is configured. Set `ALLOW_UNSIGNED_RELEASE=true` to build an unsigned bundle for inspection.

## 2. Environment and versions

| Component | Version |
|---|---|
| Phaser (bundled at `www/phaser.min.js`) | 3.87.0, from the npm tarball |
| Physics | Matter.js (built into Phaser) |
| Capacitor core/cli/android/ios | 8.6.3 |
| @capacitor/app, haptics, status-bar | 8.1.2, 8.0.2, 8.0.4 |
| @capgo/capacitor-admob (AdMob + UMP) | 8.2.13. Pins Google Next-Gen Ads SDK `0.25.0-beta01` |
| @capgo/native-purchases (Play Billing / StoreKit 2) | 8.11.0 |
| Android | minSdk 24, compileSdk 36, targetSdk 36 (`android/variables.gradle:2-4`) |
| Build container | Node 22.23.5, npm 10.9.9, Playwright 1.63.0 |
| Codemagic | Node 22, Java 21, `linux_x2` (Android); `mac_mini_m2`, Xcode latest (iOS) |
| Fonts (bundled, SIL OFL) | Fredoka 500/600/700, Nunito 600/700/800 |

## 3. Requirements traceability

Status key: **Pass** = implemented and covered by an automated test or a captured artifact. **Impl** = implemented and code-reviewed, no automated test. **Not run** = configured, but can only be proven on a device or with real store/AdMob accounts. **Deviation** = implemented differently from the brief (see §6).

### Core game (Phases 1–3)

| Requirement | Location | Evidence | Status |
|---|---|---|---|
| 540×960 portrait, FIT + CENTER_BOTH | `www/js/main.js` (Phaser config) | screenshots, layout tests | Pass |
| 11-tier table (radius, colour, score, coins, spawn %) | `www/js/data.js:16` | album screenshot `09-album.png` | Pass |
| Procedural kawaii art for all tiers | `www/js/art.js` | `store-assets/`, screenshots | Pass |
| Matter physics values (gravity 1.4, restitution 0.25, friction 0.06, air 0.005, density 0.002, 450 ms cooldown, 460×620 box) | `www/js/data.js` `CFG`/`PHYS`/`BOX` | code | Impl |
| **Merge debounce lock** (`isMerging`, early return, set both, destroy, spawn tier+1 at midpoint) | `www/js/game.js:180-190` | tests "merge lock: 3× Tier4", "4× Tier2" | Pass |
| **3-second red-line grace timer** (age > 1500 ms, line = top+40, alpha pulse 0.3–1.0, never instant) | `www/js/game.js:350-375` | test "red-line timer leads to game over (not instant)" | Pass |
| Wok Fever combo (1500 ms window, max 5, multiplies score and coins) | `www/js/game.js:205` | tests "fever combo reaches ×3", "fever multiplies score" | Pass (×1–×5, see §6) |
| Golden Spice wildcard every 15th drop; upgrades tiers 1–10 | `www/js/game.js:87`, `tryMerge` | tests "wildcard upgrades Tier7 → Tier8", "cadence every 15th" | Pass |
| Frozen Dumpling (score ≥ 1500, 10%), thawed by a merge within radius × 2.5 | `www/js/game.js:241` | tests "frozen piece refuses to merge", "adjacent merge thaws ice" | Pass (see §6) |
| 4 procedural Web Audio SFX, unlocked on first input | `www/js/audio.js:48-70` | code | Impl (audio can't be asserted headless) |
| Particles, squash/stretch 0.55→1.22→1.0, floating text, shake | `www/js/game.js:254+` | screenshots `03-fever.png` | Pass |

### Milestone 1: retention and monetization

| Requirement | Location | Evidence | Status |
|---|---|---|---|
| Evolution strip T1–T11 with `?` silhouettes | `www/index.html` `#strip`, `ui.js` `buildStrip/refresh` | screenshots | Pass |
| "NEW DISH DISCOVERED!" non-blocking card, +25…+200 gems, Watch Ad ×2 | `data.js:31`, `ui.js:74`, `meta.js:76` | tests "discovery card shown", "+120 gems", "non-blocking", "×2 doubles" | Pass |
| Discovery Album | `ui.js` `album()` | test "album shows discovered count", `09-album.png` | Pass |
| STALL tab, 5 upgrades Lv 1–5, saved | `data.js:34-64`, `meta.js:85` | tests "stall upgrade spends coins", "upgrades persist across reload", "Spice Jar Lv2 → every 13", "Bamboo Steamer Lv1 → 1.1" | Pass |
| Golden Ladle: +1 Toss at Lv3, +1 Swap at Lv5 | `data.js` `effects()` | code | Impl (see §6 for Lv 1/2/4) |
| 3 themes, bought with coins or gems | `data.js:67`, `art.js` themed canvases | tests "theme bought with gems & applied", "theme persists" | Pass |
| 3 rotating daily missions + claim | `data.js:84`, `meta.js:20` | tests "mission claim grants", "cannot be claimed twice" | Pass |
| 7-day login streak, auto-prompt once per day | `data.js:101`, `meta.js:59` | tests "auto-prompts", "Day 1 grants 100 coins", "next day Day 2", "missed days reset" | Pass |
| Offline clock-safe | `save.js:77` | test "clock rewind: nothing re-claimable", plus a reviewer probe | Pass (trade-off, §6) |
| End-of-run 2x Coins rewarded button | `ui.js:350` | test "2x Coins rewarded ad doubles run coins" | Pass |
| One-time $0.99 Starter offer after run 3 | `ui.js:371` | tests "run #3: starter bundle offer pops once", "never repeats" | Pass |
| Ad pacing: none on run 1, every 2nd declined game over, never if adsRemoved | `ui.js:365` | tests "run #1: NO interstitial", "run #2", "run #4", "adsRemoved: never" | Pass |

### Milestone 2: feel and polish

| Requirement | Location | Evidence | Status |
|---|---|---|---|
| Dotted trajectory + ghost ring at landing radius | `game.js:297` `landingY` + `update` | screenshots | Pass |
| First-run "Drag & Release to Drop" hint, gone after first drop | `index.html #hint`, `ui.js:67` | tests "hint visible", "removed permanently" | Pass |
| HapticManager (Capacitor Haptics, vibrate fallback); light/medium/warning | `audio.js:136`, `platform.js` `haptic` | code | Impl / Not run on device |
| Pentatonic lo-fi BGM, separate SFX / Music / Haptics toggles | `audio.js:82`, `ui.js:301` | test "settings toggle persists", `08-settings.png` | Pass (music quality is subjective; listen in the preview) |
| Surprised faces (fast fall / above line) and blinking | `game.js:315`, `art.js` face modes | screenshots | Impl |

### Milestone 3: architecture and native

| Requirement | Location | Evidence | Status |
|---|---|---|---|
| Vite placeholder removed, clean `www/` | repo tree | `git ls-files` | Pass |
| Phaser 3.87.0 local, no CDN, 100% offline | `www/phaser.min.js`, `www/fonts/` | tests "offline: no external requests", "canvas rendered" | Pass |
| Mobile viewport, safe areas, no long-press / pull-to-refresh | `index.html` meta, `css/style.css`, `main.js` | code | Impl |
| Capacitor 8 packages + @capgo AdMob (UMP) | `package.json` | `npx cap sync` succeeded | Pass (config) / Not run |
| `www/store-config.js` with USE_MOCK_ADS / USE_MOCK_IAP, test IDs, product IDs | `store-config.js:33,43` | code | Pass |
| Android Back → Pause / close modal, never kills mid-run | `platform.js:453`, `ui.js:338` | tests "back button opens Pause", "back again closes" (called directly; no hardware) | Pass (web) / Not run on device |
| `capacitor.config.ts` appId / appName / webDir | `capacitor.config.ts:9` | typecheck | Pass |
| targetSdk 36 | `android/variables.gradle:4` | file | Pass (config) |
| `codemagic.yaml` for .aab + .ipa | repo root | YAML parses | Not run |

### Milestone 4: store kit

| Requirement | Location | Evidence | Status |
|---|---|---|---|
| Privacy policy (AdMob + Billing) | `store-assets/privacy-policy.html` | file. Placeholders highlighted (`class="ph"`) | Pass (needs owner's name/email) |
| Asset generator script | `scripts/generate-store-assets.mjs` | ran successfully | Pass |
| `app-icon-512.png` 512×512 | `store-assets/` | 32-bit PNG | Pass |
| `feature-graphic-1024x500.png` | `store-assets/` | 24-bit RGB, no alpha (Play requirement) | Pass |
| 4 screenshots 1080×1920 with captions | `store-assets/screenshot-1..4-*.png` | RGB | Pass |
| Launch guide: ASO EN + ID, Data safety, content rating, checklist | `PLAY_STORE_LAUNCH_GUIDE.md` | lengths: titles 26/25, short descriptions 78/77 chars | Pass (policy facts marked "verify") |

### Milestone 5: verification and merge

| Requirement | Evidence | Status |
|---|---|---|
| Automated headless suite covering the listed flows | `tests/e2e.cjs`, `audit/test-results.txt` | Pass (see §4) |
| 390×844 screenshots, no overlaps or clipped buttons | layout tests at 390×844, 360×640, 412×915 | Pass |
| Second review agent each milestone | §5 | Done (3 rounds) |
| Merged to `main`, temp branches deleted | `main` @ 39ffd0f | Merged. **Branch deletion was refused by the session's Git proxy.** `production-upgrade` and `phases-1-3-single-file` are fully contained in `main`; delete them manually |

## 4. Automated test results

**Fresh run for this package (28 Nov 2026, `main` @ 39ffd0f): 70 / 70 checks passed, 0 failed.** Each check is one line in `audit/test-results.txt`. The run's 14 screenshots are in `audit/test-screenshots/`.

The run was fully offline: every request to a host other than localhost was blocked, and the suite asserts that zero were attempted.

What the suite does not cover:
- audio output and haptics;
- real AdMob, UMP or Billing (only the mock paths and a stubbed native bridge);
- native WebView quirks: edge-to-edge insets, hardware back, app pause and resume;
- performance on low-end devices;
- iOS.

## 5. Independent review history

| Round | Scope | Findings → resolution |
|---|---|---|
| 1 (Phases 1–3) | Single-file build | Hidden modal blocked input; refresh crash at boot; shop purchase/restore soft-lock; stuck timer text after Toss; Space double-fire; `roundRect` polyfill; toast timer; double-tap drop; Swap discarding a wildcard. **All fixed.** |
| 2 (Milestones 1–3) | Full repo + native config + plugin APIs | **HIGH:** game-over soft-lock through HUD buttons behind the modal (keyboard / TalkBack) → HUD made `inert` + guarded, game-over card can't be replaced. **HIGH:** pending Play purchases never delivered (auto-refunded after 3 days) → `transactionUpdated` listener with grant-once de-duplication. **MED:** already-owned non-consumable shown as a failure → delivered. **MED:** a clock set ahead froze dailies → see round 3. **MED:** "store unreachable" message impossible → `restore()` returns null. **LOW:** silent unsigned release → Gradle fails fast; Space on focused buttons; missing `ResizeObserver`; iOS `interrupted` audio. **All fixed, with regression tests.** |
| 3 (fix verification) | Diff of round-2 fixes | Clock-correction change re-enabled a streak farm (6 claims in 5 clock cycles) → reverted to strict high-water mark (probe now: 2 claims, the legitimate one + one forward jump). A recovered consumable could be granted twice → grant-once guard. **Both fixed.** Everything else verified correct, including plugin API shapes. |

## 6. Deviations and judgement calls

1. **Combo multiplier ×1–×5** (comboCount 1..5 = multiplier). The owner approved this.
2. **Thaw distance** uses `max(frozen radius, merged-piece radius) × 2.5`. Using only the frozen piece's radius made small frozen pieces nearly impossible to thaw. The owner approved this.
3. **Spice Jar Lv5 = every 10 drops.** The brief listed 15→11 across five levels; Lv1–4 map to 14–11.
4. **Golden Ladle Lv 1/2/4** each also add +25 coins per run, so every level does something.
5. **Starter Bundle "Remove Forced Ads preview"** is implemented as 3 days without interstitials.
6. **Clock safety** uses a strict forward-only day counter. Trade-off: a device whose clock was once set far ahead and then corrected gets no new dailies until real time catches up. Fully preventing both freeze and abuse needs server time.
7. The **store name** "Dim Sum Drop: Night Market" is used in-app and on the store. The web preview tab still says "Night Market Merge".

## 7. Known limitations and items to verify

- **Not compiled:** no `.aab` / `.ipa` was produced. The first Codemagic build is the real compile check (AGP 8.13, Gradle 8.14.3, JDK 21 as configured).
- **Test-mode config is committed** (`USE_MOCK_ADS: true`, `USE_MOCK_IAP: true`, Google test App IDs in `AndroidManifest.xml:21` and the iOS `Info.plist`). With mock IAP on a native build, purchases are free. These must be switched before release (guide §6.1–6.3).
- The AdMob plugin uses Google's **Next-Gen Ads SDK beta** (`0.25.0-beta01`). Check the Play pre-launch report for crashes.
- **Purchases are validated on the client only** (no receipt server). This is acceptable for a single-player game, but it is not fraud-proof.
- **Pending-payment delivery** relies on the plugin's `transactionUpdated` behaviour. Verified against the plugin source, not on a device with a slow payment method.
- **Edge-to-edge** (Android 15+/16, target 36): handled with CSS safe-area insets and a `ResizeObserver`. Not checked on a device.
- **Play policy facts** in the launch guide (Data safety classification, the 12-tester / 14-day rule, IARC outcome) are marked "verify in Play Console".
- **Accessibility:** modals manage focus and the HUD is made inert. The canvas gameplay itself isn't screen-reader playable, which is normal for the genre.
- **Placeholders** to fill: support email, developer name, privacy-policy URL (`store-config.js`, `privacy-policy.html`), and the Codemagic keystore / App Store Connect names.

## 8. File inventory (excluding generated `android/` and `ios/` projects and binary fonts)

```
www/index.html, www/css/style.css, www/store-config.js, www/phaser.min.js
www/js/{platform,data,save,audio,art,meta,ui,game,main}.js
capacitor.config.ts, package.json, package-lock.json, tsconfig.json, codemagic.yaml
scripts/serve.mjs, scripts/generate-store-assets.mjs, tests/e2e.cjs
store-assets/{privacy-policy.html, app-icon-512.png, feature-graphic-1024x500.png, screenshot-1-gameplay.png, screenshot-2-fever.png, screenshot-3-stall.png, screenshot-4-shop.png}
PLAY_STORE_LAUNCH_GUIDE.md, README.md
android/ (Capacitor 8, edited: variables.gradle, app/build.gradle, AndroidManifest.xml, branded icons/splash)
ios/ (Capacitor 8, SPM, edited: Info.plist, AppIcon, splash)
```

Commit history: `fe13f9f` scaffold → `0f2e376` Phases 1–3 → `3d74617` production upgrade → `1fb85ab` store assets → `2556466` round-2 fixes → `39ffd0f` round-3 fixes.
