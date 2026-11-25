import type { Locale } from './lib/locale';
import type { Messages } from './lib/messages';

// Types `useTranslations` keys and the `IntlProvider` locale (https://next-intl.dev/docs/workflows/typescript).
declare module 'use-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
