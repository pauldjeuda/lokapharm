export const environment = {
  production: true,
  apiBaseUrl: 'https://api.lokapharm.cm',
  pharmaciesApi: 'assets/data/pharmacies.json',
  /** En prod, le catalogue passe par apiBaseUrl ; Overpass/Nominatim restent en secours client */
  overpassApi: 'https://overpass-api.de/api/interpreter',
  overpassApiFallback: 'https://overpass.kumi.systems/api/interpreter',
  nominatimApi: 'https://nominatim.openstreetmap.org',
  osrmApi: 'https://router.project-osrm.org',
  useBackendApi: true,
  useDemoData: false,
  app: {
    version: '1.0.0',
    /** Doivent répondre HTTP 200 avant soumission Play */
    privacyPolicyUrl: 'https://lokapharm.cm/privacy',
    termsUrl: 'https://lokapharm.cm/terms',
    supportEmail: 'contact@Lokapharm.cm',
    websiteUrl: 'https://lokapharm.cm',
  },
};
