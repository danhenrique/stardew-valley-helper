import {
  type RenderOptions,
  type RenderResult,
  render,
} from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from '../lib/locale';
import type { Messages } from '../lib/messages';
import en from '../messages/en.json';
import ptBR from '../messages/pt-BR.json';
import { AppIntlProvider } from './AppIntlProvider';

// Test-only: imports every message file synchronously, so it is never used by app code.
const MESSAGES: Record<Locale, Messages> = { 'pt-BR': ptBR, en };

/** Synchronous `use-intl` provider for tests (`pt-BR` by default). */
export const IntlTestProvider = ({
  locale = DEFAULT_LOCALE,
  children,
}: {
  locale?: Locale;
  children: ReactNode;
}) => (
  <AppIntlProvider locale={locale} messages={MESSAGES[locale]}>
    {children}
  </AppIntlProvider>
);

/** `render` wrapped in `IntlTestProvider`; a caller's `wrapper` is rendered inside it. */
export const renderWithIntl = (
  ui: ReactElement,
  {
    locale,
    wrapper: Inner,
    ...options
  }: { locale?: Locale } & RenderOptions = {},
): RenderResult =>
  render(ui, {
    ...options,
    wrapper: ({ children }: { children: ReactNode }) => (
      <IntlTestProvider locale={locale}>
        {Inner ? <Inner>{children}</Inner> : children}
      </IntlTestProvider>
    ),
  });
