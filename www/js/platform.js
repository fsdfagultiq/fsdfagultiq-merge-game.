/* =============================================================================
 *  platform.js - thin native bridge for Dim Sum Drop: Night Market.
 *
 *  Plain script (no modules, no bundler). Load AFTER store-config.js and BEFORE
 *  the game code. Exposes window.Platform. Works in a normal desktop browser
 *  (window.Capacitor undefined) and inside the Capacitor Android/iOS shells,
 *  where native plugins are reached through window.Capacitor.Plugins.<Name>:
 *
 *    App              @capacitor/app            (back button, pause/resume, exit)
 *    Haptics          @capacitor/haptics
 *    StatusBar        @capacitor/status-bar
 *    AdMobPlus        @capgo/capacitor-admob    (AdMob + Google UMP consent)
 *    NativePurchases  @capgo/native-purchases   (Play Billing / StoreKit 2)
 *
 *  Nothing here ever throws or rejects into game code: every public method
 *  catches, logs with a "[Platform]" prefix, and resolves a safe default.
 * ============================================================================= */
(function (w) {
  'use strict';

  var TAG = '[Platform]';
  function log() { try { console.log.apply(console, [TAG].concat([].slice.call(arguments))); } catch (e) {} }
  function warn() { try { console.warn.apply(console, [TAG].concat([].slice.call(arguments))); } catch (e) {} }

  /* ---------------------------------------------------------------- env --- */
  var Cap = w.Capacitor;
  var isNative = false;
  var os = 'web';
  try {
    isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
    if (isNative && typeof Cap.getPlatform === 'function') {
      var p = Cap.getPlatform();
      os = (p === 'android' || p === 'ios') ? p : 'web';
      if (os === 'web') isNative = false;
    }
  } catch (e) { isNative = false; os = 'web'; }

  function cfg() { return w.STORE_CONFIG || {}; }
  function plugin(name) {
    try { return (isNative && w.Capacitor && w.Capacitor.Plugins && w.Capacitor.Plugins[name]) || null; }
    catch (e) { return null; }
  }
  function has(pl, method) { try { return !!pl && typeof pl[method] === 'function'; } catch (e) { return false; } }

  /** Resolve with `fallback` if `promise` takes longer than `ms` or rejects. Never rejects. */
  function withTimeout(promise, ms, fallback) {
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve(fallback); } }, ms);
      Promise.resolve(promise).then(function (v) {
        if (!done) { done = true; clearTimeout(t); resolve(v); }
      }, function (err) {
        if (!done) { done = true; clearTimeout(t); warn('call failed:', errMsg(err)); resolve(fallback); }
      });
    });
  }
  function safe(fn) { // run fn() -> Promise, never rejects
    try { return Promise.resolve(fn()).catch(function (e) { warn(errMsg(e)); return undefined; }); }
    catch (e) { warn(errMsg(e)); return Promise.resolve(undefined); }
  }
  function errMsg(e) { try { return (e && (e.code ? e.code + ': ' : '') + (e.message || e.errorMessage || e)) + ''; } catch (x) { return 'error'; } }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /** addListener on a raw native plugin object. Returns Promise<{remove()}>, never rejects. */
  function listen(pl, eventName, cb) {
    try {
      if (!has(pl, 'addListener')) return Promise.resolve({ remove: function () {} });
      var h = pl.addListener(eventName, cb);
      return Promise.resolve(h).then(function (handle) {
        return handle && typeof handle.remove === 'function' ? handle : { remove: function () {} };
      }, function (e) { warn('addListener', eventName, errMsg(e)); return { remove: function () {} }; });
    } catch (e) { warn('addListener', eventName, errMsg(e)); return Promise.resolve({ remove: function () {} }); }
  }
  function removeAll(handles) { handles.forEach(function (h) { try { Promise.resolve(h).then(function (x) { try { x.remove(); } catch (e) {} }); } catch (e) {} }); }

  /* ------------------------------------------------------- mock handlers --- */
  var mock = { ad: null, purchase: null };
  function mockAd(kind, placement) {
    try {
      if (typeof mock.ad !== 'function') { warn('no mock ad handler registered'); return Promise.resolve(false); }
      return Promise.resolve(mock.ad(kind, placement)).then(function (v) { return !!v; }, function (e) { warn('mock ad', errMsg(e)); return false; });
    } catch (e) { warn('mock ad', errMsg(e)); return Promise.resolve(false); }
  }
  function mockPurchase(productId) {
    try {
      if (typeof mock.purchase !== 'function') { warn('no mock purchase handler registered'); return Promise.resolve(false); }
      return Promise.resolve(mock.purchase(productId)).then(function (v) { return !!v; }, function (e) { warn('mock purchase', errMsg(e)); return false; });
    } catch (e) { warn('mock purchase', errMsg(e)); return Promise.resolve(false); }
  }

  /* ---------------------------------------------------------------- ads --- */
  var REWARDED_ID = 7101, INTERSTITIAL_ID = 7102; // our own ad instance ids for AdMobPlus
  var ads = {
    started: false,          // AdMob SDK initialised
    canRequest: true,        // UMP says ads may be requested
    privacyRequired: false,  // UMP privacy-options entry point required
    created: {},             // adId -> true once adCreate succeeded
    loading: {},             // adId -> Promise<boolean>
    showing: false,
    ready: null,             // Promise that settles when the ads setup finished (or failed)
  };

  function adUnits() {
    var c = cfg();
    var test = (c.TEST_IDS && c.TEST_IDS[os]) || {};
    if (c.USE_MOCK_ADS !== false) return test;
    var live = (c.ADMOB && c.ADMOB[os]) || {};
    var out = { rewarded: live.rewarded, interstitial: live.interstitial };
    ['rewarded', 'interstitial'].forEach(function (k) {
      if (!out[k] || /X{4,}|N{4,}/.test(out[k])) {
        warn('LIVE ' + os + ' ' + k + ' ad unit id is still a placeholder in store-config.js - using Google TEST id instead.');
        out[k] = test[k];
      }
    });
    return out;
  }
  function admob() { return plugin('AdMobPlus'); }

  function ensureCreated(id, cls, adUnitId) {
    var A = admob();
    if (!A || !adUnitId) return Promise.resolve(false);
    if (ads.created[id]) return Promise.resolve(true);
    return withTimeout(A.adCreate({ id: id, cls: cls, adUnitId: adUnitId }).then(function () {
      ads.created[id] = true; return true;
    }), 5000, false);
  }
  function isLoaded(id) {
    var A = admob();
    if (!A || !ads.created[id]) return Promise.resolve(false);
    return withTimeout(A.adIsLoaded({ id: id }), 2000, false).then(function (r) {
      return typeof r === 'boolean' ? r : !!(r && r.value === true);
    });
  }
  /** Load (or reload) an ad. Resolves true when loaded, false on failure/no fill. Never rejects. */
  function loadAd(kind) {
    var id = kind === 'rewarded' ? REWARDED_ID : INTERSTITIAL_ID;
    var cls = kind === 'rewarded' ? 'RewardedAd' : 'InterstitialAd';
    var A = admob();
    if (!A || !ads.started || !ads.canRequest) return Promise.resolve(false);
    if (ads.loading[id]) return ads.loading[id];
    var unit = adUnits()[kind];
    var p = ensureCreated(id, cls, unit).then(function (ok) {
      if (!ok) return false;
      return withTimeout(A.adLoad({ id: id, adUnitId: unit }).then(function () { return true; }), 30000, false);
    }).then(function (ok) {
      ads.loading[id] = null;
      if (!ok) log(kind + ' ad not loaded (no fill / error)');
      return !!ok;
    }, function () { ads.loading[id] = null; return false; });
    ads.loading[id] = p;
    return p;
  }

  /** Show a loaded full-screen ad; resolves {shown, rewarded} after it is dismissed. */
  function presentAd(kind) {
    var A = admob();
    var id = kind === 'rewarded' ? REWARDED_ID : INTERSTITIAL_ID;
    var prefix = kind === 'rewarded' ? 'rewarded' : 'interstitial';
    return new Promise(function (resolve) {
      var rewarded = false, finished = false, handles = [], safety = null;
      function mine(ev) { try { return !ev || ev.adId == null && ev.id == null || ev.adId === id || ev.id === id; } catch (e) { return true; } }
      function finish(shown) {
        if (finished) return; finished = true;
        clearTimeout(safety);
        // Give a late reward callback a moment to arrive (SDK ordering differs per platform).
        delay(kind === 'rewarded' ? 400 : 0).then(function () {
          removeAll(handles);
          resolve({ shown: shown, rewarded: rewarded });
        });
      }
      if (kind === 'rewarded') handles.push(listen(A, 'rewarded.reward', function (ev) { if (mine(ev)) rewarded = true; }));
      handles.push(listen(A, prefix + '.dismiss', function (ev) { if (mine(ev)) finish(true); }));
      handles.push(listen(A, prefix + '.showfail', function (ev) { if (mine(ev)) { warn(kind + ' show failed', ev && ev.message); finish(false); } }));
      // Safety net: never lock the game if a dismiss event is lost.
      safety = setTimeout(function () { warn(kind + ' ad: no dismiss event, continuing'); finish(true); }, 150000);
      Promise.all(handles).then(function () {
        return A.adShow({ id: id });
      }).catch(function (e) { warn(kind + ' adShow failed', errMsg(e)); finish(false); });
    });
  }

  function showRewarded(placement) {
    try {
      if (!isNative) return mockAd('rewarded', placement);
      var useMock = cfg().USE_MOCK_ADS !== false;
      var fallback = function (why) {
        log('rewarded unavailable (' + why + ')' + (useMock ? ' -> mock overlay' : ''));
        return useMock ? mockAd('rewarded', placement) : false;
      };
      if (ads.showing) return Promise.resolve(false);
      if (!admob()) return Promise.resolve(fallback('plugin missing'));
      ads.showing = true;
      return withTimeout(ads.ready || Promise.resolve(), 4000, undefined).then(function () {
        if (!ads.started || !ads.canRequest) return { skip: 'ads not started / no consent' };
        return isLoaded(REWARDED_ID).then(function (ok) {
          return ok ? true : withTimeout(loadAd('rewarded'), 6000, false);
        }).then(function (ok) { return ok ? presentAd('rewarded') : { skip: 'no fill' }; });
      }).then(function (res) {
        ads.showing = false;
        if (ads.started && ads.canRequest) loadAd('rewarded'); // preload the next one
        if (res && res.skip) return fallback(res.skip);
        if (res && !res.shown) return fallback('show failed');
        return !!(res && res.rewarded);
      }).catch(function (e) { ads.showing = false; warn('showRewarded', errMsg(e)); return false; });
    } catch (e) { ads.showing = false; warn('showRewarded', errMsg(e)); return Promise.resolve(false); }
  }

  function showInterstitial(placement) {
    try {
      if (!isNative) return mockAd('interstitial', placement).then(function () {});
      if (ads.showing || !admob() || !ads.started || !ads.canRequest) return Promise.resolve();
      ads.showing = true;
      return isLoaded(INTERSTITIAL_ID).then(function (ok) {
        if (!ok) { loadAd('interstitial'); return null; } // no fill: just skip, never block the player
        return presentAd('interstitial');
      }).then(function (res) {
        ads.showing = false;
        if (res) loadAd('interstitial');
      }).catch(function (e) { ads.showing = false; warn('showInterstitial', errMsg(e)); });
    } catch (e) { ads.showing = false; warn('showInterstitial', errMsg(e)); return Promise.resolve(); }
  }

  /** UMP consent -> (iOS ATT) -> AdMob start -> preload. Never rejects. */
  function setupAds() {
    var A = admob();
    if (!A) { warn('AdMobPlus plugin not available'); return Promise.resolve(); }
    var c = cfg();
    var underAge = !!c.TAG_FOR_UNDER_AGE_OF_CONSENT;
    var consentInfo = null;
    return withTimeout(A.requestConsentInfo({ tagForUnderAgeOfConsent: underAge }), 10000, null).then(function (info) {
      consentInfo = info;
      if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') {
        log('showing UMP consent form');
        // No timeout here: the user may take a while to read it (Platform.init itself is capped).
        return Promise.resolve(A.showConsentForm()).then(function (i2) { consentInfo = i2 || consentInfo; },
          function (e) { warn('consent form', errMsg(e)); });
      }
    }).then(function () {
      if (consentInfo) {
        ads.canRequest = consentInfo.canRequestAds !== false;
        ads.privacyRequired = consentInfo.privacyOptionsRequirementStatus === 'REQUIRED';
      } // if UMP failed entirely we still try: AdMob itself respects stored consent
      if (os === 'ios' && c.REQUEST_IOS_TRACKING !== false && has(A, 'trackingAuthorizationStatus')) {
        return withTimeout(A.trackingAuthorizationStatus(), 3000, null).then(function (r) {
          if (r && r.status === 0) return withTimeout(A.requestTrackingAuthorization(), 60000, null);
        });
      }
    }).then(function () {
      return withTimeout(A.configRequest({
        tagForChildDirectedTreatment: !!c.TAG_FOR_CHILD_DIRECTED,
        tagForUnderAgeOfConsent: underAge,
      }), 3000, null);
    }).then(function () {
      return withTimeout(A.start().then(function () { return true; }), 10000, false);
    }).then(function (ok) {
      ads.started = !!ok;
      log('AdMob ' + (ok ? 'started' : 'failed to start') + '; canRequestAds=' + ads.canRequest +
        '; units=' + (cfg().USE_MOCK_ADS !== false ? 'TEST' : 'LIVE'));
      if (ok && ads.canRequest) { loadAd('rewarded'); loadAd('interstitial'); }
    }).catch(function (e) { warn('ads setup', errMsg(e)); });
  }

  function privacyOptionsRequired() { return !!(isNative && ads.privacyRequired); }
  function showPrivacyOptions() {
    try {
      var A = admob();
      if (!isNative || !has(A, 'showPrivacyOptionsForm')) return Promise.resolve();
      return Promise.resolve(A.showPrivacyOptionsForm()).catch(function (e) { warn('privacy form', errMsg(e)); })
        .then(function () { return withTimeout(A.requestConsentInfo({ tagForUnderAgeOfConsent: !!cfg().TAG_FOR_UNDER_AGE_OF_CONSENT }), 8000, null); })
        .then(function (info) {
          if (info) {
            ads.canRequest = info.canRequestAds !== false;
            ads.privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
          }
        }).catch(function (e) { warn('showPrivacyOptions', errMsg(e)); });
    } catch (e) { warn('showPrivacyOptions', errMsg(e)); return Promise.resolve(); }
  }

  /* ---------------------------------------------------------------- IAP --- */
  var MOCK_RECEIPTS_KEY = 'nmm_mock_store_receipts';
  var iap = { ready: false, prices: {} };
  function products() { return cfg().PRODUCTS || {}; }
  function productType(id) { var p = products()[id]; return p && p.type; }
  function realIAP() { return isNative && cfg().USE_MOCK_IAP === false && !!plugin('NativePurchases'); }

  function setupBilling() {
    var NP = plugin('NativePurchases');
    if (!NP) { warn('NativePurchases plugin not available'); return Promise.resolve(); }
    var ids = Object.keys(products());
    return withTimeout(has(NP, 'isBillingSupported') ? NP.isBillingSupported() : { isBillingSupported: true }, 4000, null).then(function (r) {
      if (r && r.isBillingSupported === false) { warn('billing not supported on this device'); return null; }
      return withTimeout(NP.getProducts({ productIdentifiers: ids, productType: 'inapp' }), 8000, null);
    }).then(function (res) {
      var list = (res && res.products) || [];
      list.forEach(function (p) {
        if (p && p.identifier && p.priceString && !iap.prices[p.identifier]) iap.prices[p.identifier] = p.priceString;
      });
      iap.ready = true;
      log('billing ready; store prices for: ' + (Object.keys(iap.prices).join(', ') || 'none'));
    }).catch(function (e) { warn('billing setup', errMsg(e)); });
  }

  function isValidTx(tx) {
    if (!tx) return false;
    if (tx.revocationDate) return false;
    if (os === 'android' && tx.purchaseState != null && String(tx.purchaseState) !== '1') return false; // "0" = pending
    return true;
  }

  /** Android: a consumable stuck "owned" (app died before consume). Consume it and grant. */
  function recoverOwnedConsumable(NP, productId) {
    return withTimeout(NP.getPurchases({ productType: 'inapp' }), 8000, null).then(function (r) {
      var tx = ((r && r.purchases) || []).filter(function (t) { return t.productIdentifier === productId && isValidTx(t); })[0];
      if (!tx || !tx.purchaseToken) return false;
      return withTimeout(NP.consumePurchase({ purchaseToken: tx.purchaseToken }).then(function () { return true; }), 8000, false);
    });
  }

  function purchase(productId) {
    try {
      if (!realIAP()) return mockPurchase(productId);
      var NP = plugin('NativePurchases');
      var consumable = productType(productId) === 'consumable';
      return Promise.resolve(NP.purchaseProduct({
        productIdentifier: productId,
        productType: 'inapp',
        quantity: 1,
        isConsumable: consumable,        // Android: plugin consumes it after purchase so it can be bought again
        autoAcknowledgePurchases: true,  // acknowledge (Android) / finish (iOS) automatically
      })).then(function (tx) {
        var ok = isValidTx(tx) && (!tx.productIdentifier || tx.productIdentifier === productId);
        if (!ok) log('purchase not completed (pending or invalid)', productId);
        return ok;
      }, function (e) {
        var code = (e && (e.code || e.errorCode)) || '';
        var msg = errMsg(e);
        if (os === 'android' && consumable && (/ITEM_ALREADY_OWNED/i.test(code) || /already owned/i.test(msg))) {
          return recoverOwnedConsumable(NP, productId);
        }
        if (/USER_CANCELED|cancel/i.test(code + ' ' + msg)) log('purchase cancelled', productId);
        else warn('purchase failed', productId, msg);
        return false;
      }).catch(function () { return false; });
    } catch (e) { warn('purchase', errMsg(e)); return Promise.resolve(false); }
  }

  function readMockReceipts() {
    try {
      var raw = w.localStorage && w.localStorage.getItem(MOCK_RECEIPTS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(function (x) { return typeof x === 'string'; }) : [];
    } catch (e) { return []; }
  }

  function restore() {
    try {
      var nonConsumable = function (id) { return productType(id) !== 'consumable'; };
      var uniq = function (arr) { return arr.filter(function (x, i) { return arr.indexOf(x) === i; }); };
      if (!realIAP()) return Promise.resolve(uniq(readMockReceipts().filter(nonConsumable)));
      var NP = plugin('NativePurchases');
      return withTimeout(has(NP, 'restorePurchases') ? NP.restorePurchases() : null, 15000, null).then(function () {
        return withTimeout(NP.getPurchases(os === 'ios' ? { onlyCurrentEntitlements: true } : { productType: 'inapp' }), 10000, null);
      }).then(function (r) {
        var ids = ((r && r.purchases) || []).filter(isValidTx).map(function (t) { return t.productIdentifier; })
          .filter(function (id) { return !!id && !!products()[id] && nonConsumable(id); });
        return uniq(ids);
      }).catch(function (e) { warn('restore', errMsg(e)); return []; });
    } catch (e) { warn('restore', errMsg(e)); return Promise.resolve([]); }
  }

  function getPrice(productId) {
    try {
      if (realIAP() && iap.prices[productId]) return iap.prices[productId];
      var p = products()[productId];
      return (p && p.displayPrice) || '';
    } catch (e) { return ''; }
  }

  /* ------------------------------------------------- app lifecycle / UI --- */
  var backHandlers = [], pauseHandlers = [], resumeHandlers = [];
  var appListening = false, webVisListening = false;
  function call(list, arg) { list.slice().forEach(function (h) { try { h(arg); } catch (e) { warn('handler error', errMsg(e)); } }); }

  function ensureAppListeners() {
    if (appListening) return;
    var App = plugin('App');
    if (!App) return;
    appListening = true;
    // Registering a backButton listener disables Capacitor's default "go back / exit app" behaviour.
    listen(App, 'backButton', function (ev) {
      var h = backHandlers[backHandlers.length - 1];
      if (h) { try { h(ev); } catch (e) { warn('back handler', errMsg(e)); } }
    });
    listen(App, 'pause', function () { call(pauseHandlers); });
    listen(App, 'resume', function () { call(resumeHandlers); });
  }
  function ensureWebVisibility() {
    if (webVisListening || isNative) return;
    webVisListening = true;
    try {
      document.addEventListener('visibilitychange', function () {
        call(document.hidden ? pauseHandlers : resumeHandlers);
      });
    } catch (e) {}
  }
  function unsub(list, h) { return function () { var i = list.indexOf(h); if (i >= 0) list.splice(i, 1); }; }

  function onBack(handler) {
    try {
      if (typeof handler !== 'function') return function () {};
      backHandlers.push(handler);
      if (isNative) ensureAppListeners();
      return unsub(backHandlers, handler);
    } catch (e) { warn('onBack', errMsg(e)); return function () {}; }
  }
  function onPause(handler) {
    try {
      if (typeof handler !== 'function') return function () {};
      pauseHandlers.push(handler);
      if (isNative) ensureAppListeners(); else ensureWebVisibility();
      return unsub(pauseHandlers, handler);
    } catch (e) { return function () {}; }
  }
  function onResume(handler) {
    try {
      if (typeof handler !== 'function') return function () {};
      resumeHandlers.push(handler);
      if (isNative) ensureAppListeners(); else ensureWebVisibility();
      return unsub(resumeHandlers, handler);
    } catch (e) { return function () {}; }
  }
  function exitApp() {
    try { var App = plugin('App'); if (App) safe(function () { return App.exitApp(); }); } catch (e) {}
  }

  var WEB_VIBES = { light: 10, medium: 20, heavy: 35, warning: [30, 40, 30], success: [15, 30, 15] };
  function haptic(kind) {
    try {
      kind = WEB_VIBES[kind] != null ? kind : 'light';
      var H = plugin('Haptics');
      if (H) {
        if (kind === 'warning' || kind === 'success') safe(function () { return H.notification({ type: kind.toUpperCase() }); });
        else safe(function () { return H.impact({ style: kind.toUpperCase() }); });
        return;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(WEB_VIBES[kind]);
    } catch (e) {}
  }

  function setupStatusBar() {
    var SB = plugin('StatusBar');
    if (!SB) return Promise.resolve();
    return withTimeout(Promise.resolve(SB.setStyle({ style: 'DARK' })).catch(function () {}).then(function () {
      if (cfg().HIDE_STATUS_BAR !== false) return SB.hide();
    }), 2000, null);
  }

  /* ---------------------------------------------------------------- init --- */
  var initPromise = null;
  function init() {
    if (initPromise) return initPromise;
    if (!isNative) { initPromise = Promise.resolve(); return initPromise; }
    var work = safe(setupStatusBar).then(function () {
      ensureAppListeners();
      ads.ready = safe(setupAds);
      var billing = cfg().USE_MOCK_IAP === false ? safe(setupBilling) : Promise.resolve();
      return Promise.all([ads.ready, billing]);
    });
    // Never hold the game for more than ~6s: slow plugins keep finishing in the background.
    initPromise = withTimeout(work, 6000, undefined).then(function () { log('init done (' + os + ')'); });
    return initPromise;
  }

  function setMockHandlers(h) {
    try {
      if (!h) return;
      if (typeof h.ad === 'function') mock.ad = h.ad;
      if (typeof h.purchase === 'function') mock.purchase = h.purchase;
    } catch (e) {}
  }

  w.Platform = {
    isNative: isNative,
    os: os,
    setMockHandlers: setMockHandlers,
    init: init,
    showRewarded: showRewarded,
    showInterstitial: showInterstitial,
    purchase: purchase,
    restore: restore,
    getPrice: getPrice,
    privacyOptionsRequired: privacyOptionsRequired,
    showPrivacyOptions: showPrivacyOptions,
    onBack: onBack,
    exitApp: exitApp,
    onPause: onPause,
    onResume: onResume,
    haptic: haptic,
  };
})(window);
