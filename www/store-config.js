/* =============================================================================
 *  STORE CONFIG  -  the ONE file you edit before publishing to Google Play /
 *  the App Store. Plain script (not a module): it just sets window.STORE_CONFIG.
 *  Load it BEFORE js/platform.js in index.html.
 *
 *  Quick checklist before going live:
 *   1. Create the app in AdMob (one Android app + one iOS app) and create a
 *      "Rewarded" and an "Interstitial" ad unit for each. Paste the ids into
 *      ADMOB below.
 *   2. Put the AdMob APP id (the one with "~") into the native projects too:
 *        Android: android/app/src/main/AndroidManifest.xml  (APPLICATION_ID meta-data)
 *        iOS:     ios/App/App/Info.plist                    (GADApplicationIdentifier)
 *   3. Create the in-app products in Play Console / App Store Connect with
 *      EXACTLY the ids listed in PRODUCTS (remove_ads_pack, starter_gems, starter_bundle).
 *   4. Set USE_MOCK_ADS: false and USE_MOCK_IAP: false.
 *   5. Fill in PRIVACY_POLICY_URL and SUPPORT_EMAIL.
 * ============================================================================= */
window.STORE_CONFIG = {

  /* ---------------------------------------------------------------------------
   * USE_MOCK_ADS
   *   true  (testing):
   *     - In a normal web browser: the game shows its own pretend "ad" overlay.
   *     - On a real Android/iOS device: REAL AdMob is used, but with Google's
   *       official TEST ad unit ids (TEST_IDS below). These show "Test Ad"
   *       banners, pay nothing, and are always safe to tap. If no test ad is
   *       available, the pretend overlay is used so testers can keep playing.
   *   false (release):
   *     - On Android/iOS: REAL AdMob with YOUR live ids from ADMOB below.
   *       NEVER tap your own live ads - Google can suspend your account.
   *     - In a web browser the pretend overlay is still used (AdMob has no web SDK).
   * ------------------------------------------------------------------------- */
  USE_MOCK_ADS: true,

  /* ---------------------------------------------------------------------------
   * USE_MOCK_IAP
   *   true  = purchases are simulated everywhere (nobody is charged). Good for
   *           testing, and REQUIRED until the products exist in the stores.
   *   false = real Google Play Billing (Android) / StoreKit 2 (iOS) through the
   *           @capgo/native-purchases plugin. In a web browser purchases are
   *           always simulated.
   * ------------------------------------------------------------------------- */
  USE_MOCK_IAP: true,

  /* ---------------------------------------------------------------------------
   * ADMOB - your LIVE ids (used only when USE_MOCK_ADS is false).
   *   appId     looks like ca-app-pub-1234567890123456~1234567890   (with "~")
   *   ad units  look like ca-app-pub-1234567890123456/1234567890    (with "/")
   *   Android and iOS have DIFFERENT ids - do not mix them up.
   * ------------------------------------------------------------------------- */
  ADMOB: {
    android: {
      appId:        'ca-app-pub-XXXXXXXXXXXXXXXX~NNNNNNNNNN', // also put in AndroidManifest.xml
      rewarded:     'ca-app-pub-XXXXXXXXXXXXXXXX/NNNNNNNNNN',
      interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/NNNNNNNNNN',
    },
    ios: {
      appId:        'ca-app-pub-XXXXXXXXXXXXXXXX~NNNNNNNNNN', // also put in Info.plist
      rewarded:     'ca-app-pub-XXXXXXXXXXXXXXXX/NNNNNNNNNN',
      interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/NNNNNNNNNN',
    },
  },

  /* ---------------------------------------------------------------------------
   * TEST_IDS - Google's official, public test ad units. Do NOT change these.
   *   https://developers.google.com/admob/android/test-ads
   *   https://developers.google.com/admob/ios/test-ads
   * ------------------------------------------------------------------------- */
  TEST_IDS: {
    android: {
      appId:        'ca-app-pub-3940256099942544~3347511713',
      rewarded:     'ca-app-pub-3940256099942544/5224354917',
      interstitial: 'ca-app-pub-3940256099942544/1033173712',
    },
    ios: {
      appId:        'ca-app-pub-3940256099942544~1458002511',
      rewarded:     'ca-app-pub-3940256099942544/1712485313',
      interstitial: 'ca-app-pub-3940256099942544/4411468910',
    },
  },

  /* ---------------------------------------------------------------------------
   * PRODUCTS - in-app purchases. The keys are the product ids and must match
   *   Play Console (Monetize > Products > In-app products) and App Store Connect
   *   (In-App Purchases) EXACTLY.
   *   type:          'nonConsumable' = bought once, kept forever, restorable
   *                  'consumable'    = can be bought again and again
   *   displayPrice:  shown in the mock store and as a fallback when the real
   *                  store price can't be loaded. The real store shows the
   *                  user's local price automatically.
   * ------------------------------------------------------------------------- */
  PRODUCTS: {
    remove_ads_pack: { type: 'nonConsumable', displayPrice: '$2.99' },
    starter_gems:    { type: 'consumable',    displayPrice: '$1.99' },
    starter_bundle:  { type: 'nonConsumable', displayPrice: '$0.99' },
  },

  /* ---------------------------------------------------------------------------
   * Legal / support. Both stores REQUIRE a public privacy policy URL that
   * mentions AdMob / advertising ID usage. Use an address you control.
   * ------------------------------------------------------------------------- */
  PRIVACY_POLICY_URL: 'https://example.com/privacy-policy',   // TODO: replace
  SUPPORT_EMAIL: 'support@example.com',                         // TODO: replace

  /* ---------------------------------------------------------------------------
   * Audience flags for AdMob (COPPA / GDPR age rules).
   *   Leave both false if your game is NOT directed at children and you
   *   answered "Not designed for children" / 13+ in the Play Console target
   *   audience questions. If children under 13 are a target audience, set
   *   TAG_FOR_CHILD_DIRECTED to true (and follow Google's Families policy).
   * ------------------------------------------------------------------------- */
  TAG_FOR_CHILD_DIRECTED: false,
  TAG_FOR_UNDER_AGE_OF_CONSENT: false,

  /* ---------------------------------------------------------------------------
   * iOS only: show Apple's "Allow tracking?" prompt (App Tracking Transparency)
   * after the consent form. Apple expects this prompt because Info.plist
   * declares NSUserTrackingUsageDescription. Saying "no" still shows ads.
   * ------------------------------------------------------------------------- */
  REQUEST_IOS_TRACKING: true,

  /* Hide the phone's status bar (clock/battery) during play for a full-screen game. */
  HIDE_STATUS_BAR: true,
};
