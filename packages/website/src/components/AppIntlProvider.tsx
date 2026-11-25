import type { ReactNode } from 'react';
import { IntlProvider } from 'use-intl';
import type { Locale } from '../lib/locale';
import type { Messages } from '../lib/messages';

/**
 * `use-intl` provider with the app-wide settings. UTC keeps dates as today (the API sends
 * date-only ISO strings that are formatted with `timeZone: 'UTC'`).
 */
export const AppIntlProvider = ({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) => (
  <IntlProvider locale={locale} messages={messages} timeZone="UTC">
    {children}
  </IntlProvider>
);
