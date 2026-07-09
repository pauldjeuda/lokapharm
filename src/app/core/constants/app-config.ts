export interface AppConfig {
  version: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  supportEmail: string;
  websiteUrl: string;
}

export const APP_CONFIG: AppConfig = {
  version: '1.0.0',
  privacyPolicyUrl: 'https://lokaphar.cm/privacy',
  termsUrl: 'https://lokaphar.cm/terms',
  supportEmail: 'contact@lokaphar.cm',
  websiteUrl: 'https://lokaphar.cm',
};

export const APP_USER_AGENT = `Lokaphar/${APP_CONFIG.version} (cm.lokaphar.app; ${APP_CONFIG.supportEmail})`;
