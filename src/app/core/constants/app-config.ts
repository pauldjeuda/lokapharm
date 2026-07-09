export interface AppConfig {
  version: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  supportEmail: string;
  websiteUrl: string;
}

export const APP_CONFIG: AppConfig = {
  version: '1.0.0',
  privacyPolicyUrl: 'https://Lokapharm.cm/privacy',
  termsUrl: 'https://Lokapharm.cm/terms',
  supportEmail: 'contact@Lokapharm.cm',
  websiteUrl: 'https://Lokapharm.cm',
};

export const APP_USER_AGENT = `Lokapharm/${APP_CONFIG.version} (cm.Lokapharm.app; ${APP_CONFIG.supportEmail})`;
