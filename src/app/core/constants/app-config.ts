export interface AppConfig {
  version: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  supportEmail: string;
  websiteUrl: string;
}

export const APP_CONFIG: AppConfig = {
  version: '1.0.0',
  privacyPolicyUrl: 'https://lokapharm.cm/privacy',
  termsUrl: 'https://lokapharm.cm/terms',
  supportEmail: 'contact@Lokapharm.cm',
  websiteUrl: 'https://lokapharm.cm',
};

export const APP_USER_AGENT = `Lokapharm/${APP_CONFIG.version} (cm.Lokapharm.app; ${APP_CONFIG.supportEmail})`;
