export const environment = {
  production: false,
  /** API backend LokaPharm (agrégation temps réel) */
  apiBaseUrl: 'http://localhost:3100',
  /** Catalogue pharmacies MINSANTE / DPML (fallback local) */
  pharmaciesApi: 'assets/data/pharmacies.json',
  overpassApi: '/api/overpass',
  overpassApiFallback: 'https://overpass.kumi.systems/api/interpreter',
  nominatimApi: '/api/nominatim',
  osrmApi: 'https://router.project-osrm.org',
  /** Utiliser le backend au lieu d'appeler Overpass depuis le client */
  useBackendApi: true,
  useDemoData: false,
  app: {
    version: '1.0.0',
    privacyPolicyUrl: 'https://lokapharm.cm/privacy',
    termsUrl: 'https://lokapharm.cm/terms',
    supportEmail: 'contact@Lokapharm.cm',
    websiteUrl: 'https://lokapharm.cm',
  },
};
