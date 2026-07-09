export const environment = {
  production: false,
  /** Catalogue pharmacies MINSANTE / DPML (JSON local ou API back-end) */
  pharmaciesApi: 'assets/data/pharmacies.json',
  overpassApi: '/api/overpass',
  overpassApiFallback: 'https://overpass.kumi.systems/api/interpreter',
  nominatimApi: '/api/nominatim',
  osrmApi: 'https://router.project-osrm.org',
  useDemoData: false,
  app: {
    version: '1.0.0',
    privacyPolicyUrl: 'https://Lokapharm.cm/privacy',
    termsUrl: 'https://Lokapharm.cm/terms',
    supportEmail: 'contact@Lokapharm.cm',
    websiteUrl: 'https://Lokapharm.cm',
  },
};
