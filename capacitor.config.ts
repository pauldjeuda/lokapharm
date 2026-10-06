import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cm.Lokapharm.app',
  appName: 'Lokapharm',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'Lokapharm',
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
};

export default config;
