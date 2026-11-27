import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for Dim Sum Drop: Night Market.
 * The game is a zero-build static site in ./www, copied verbatim into the native projects by `npx cap sync`.
 * There is deliberately NO server.url: the store build must load the bundled files, not a dev server.
 */
const config: CapacitorConfig = {
  appId: 'com.nightmarket.dimsummerge',
  appName: 'Dim Sum Drop: Night Market',
  webDir: 'www',
  backgroundColor: '#2C1A1D',
  android: {
    backgroundColor: '#2C1A1D',
    // Release builds must never allow mixed content or WebView debugging.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: '#2C1A1D',
    contentInset: 'never',
  },
  plugins: {
    // Capacitor 8 core plugin: edge-to-edge handling on Android 15+.
    // www/index.html uses viewport-fit=cover + env(safe-area-inset-*), so 'css' keeps those values correct.
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
    // @capacitor/status-bar. DARK = light icons/text, for our dark lacquer background.
    // overlaysWebView/backgroundColor are ignored on Android 15+ (edge-to-edge is forced there).
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#2C1A1D',
    },
    // @capgo/native-purchases: let the plugin finish/acknowledge transactions automatically.
    NativePurchases: {
      autoFinishTransactions: true,
    },
  },
};

export default config;
