# Dim Sum Drop: Night Market

A cozy physics merge game: drop kawaii street-food dishes into a bamboo steamer, merge identical
dishes up 11 tiers to the Giant Hotpot, and keep the steamer below the red line.
Built with Phaser 3.87 + Matter.js and packaged for Android and iOS with Capacitor 8.

## Project layout

| Path | What it is |
|---|---|
| `www/` | The whole game, zero build step, works offline. `index.html` loads `store-config.js`, the local `phaser.min.js`, then `js/*.js`. |
| `www/store-config.js` | **The one file to edit before release**: AdMob IDs, mock/live switches, product IDs. |
| `www/js/platform.js` | Native bridge: AdMob + UMP consent, Play Billing / StoreKit, back button, haptics, pause/resume. Falls back to in-game mock overlays on the web. |
| `www/js/game.js` | Phaser scene: physics, merge debounce lock, 3-second red-line grace timer, juice. |
| `www/js/ui.js`, `meta.js`, `save.js` | HUD and modals; missions, streak, album, upgrades, themes; validated save data with backup. |
| `android/`, `ios/` | Capacitor native projects (Android compile/target SDK 36). |
| `codemagic.yaml` | Cloud builds: `android-release` (signed `.aab`) and `ios-release` (`.ipa`). |
| `store-assets/` | Play Store graphics + `privacy-policy.html`. |
| `PLAY_STORE_LAUNCH_GUIDE.md` | Store listing (EN + ID), Data safety and content-rating answers, launch checklist. |

## Commands

```bash
npm install
npm run serve        # play in a browser at http://localhost:5173
npm test             # headless end-to-end suite (needs Playwright + Chromium)
npm run assets       # re-render store graphics, launcher icons and splash screens
npx cap sync android # copy www/ into the Android project
npm run build:android  # signed release bundle (needs Android SDK + signing env vars)
```

To run the tests or the asset generator on your own machine, install Playwright once:
`npm i -D playwright && npx playwright install chromium`.

## Releasing

Follow `PLAY_STORE_LAUNCH_GUIDE.md`. In short: put your AdMob IDs in `www/store-config.js` and
`android/app/src/main/AndroidManifest.xml`, set `USE_MOCK_ADS` / `USE_MOCK_IAP` to `false`, and build
the signed `.aab` with Codemagic (`android-release`) or locally.
