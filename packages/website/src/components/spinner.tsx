import type React from 'react';
import { localeFromPathname, type Locale } from '../lib/locale';
import { SkeletonPage } from './Skeleton';

/**
 * The only UI text kept outside the message files: the spinner renders before any
 * IntlProvider (RuntimeConfig/CognitoAuth), so it cannot use use-intl.
 */
const LOADING_TEXT: Record<Locale, string> = {
  'pt-BR': 'Carregando...',
  en: 'Loading...',
};

/** Shown while the app starts (auth and runtime config): a generic page skeleton. */
export const Spinner: React.FC = () => (
  <div className="p-4 sm:p-6">
    <SkeletonPage
      label={LOADING_TEXT[localeFromPathname(window.location.pathname)]}
    />
  </div>
);
