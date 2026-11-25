import { useRouterState } from '@tanstack/react-router';
import { type ReactNode, useEffect, useSyncExternalStore } from 'react';
import { localeFromPathname } from '../lib/locale';
import {
  messagesFor,
  messagesVersion,
  subscribeMessages,
} from '../lib/messageCache';
import { AppIntlProvider } from './AppIntlProvider';

/**
 * The app's single provider, at the root layout so the shell, every page and the not-found page
 * share it. The locale comes from the URL; the root `beforeLoad` preloads its messages and this
 * re-renders when they arrive (default locale meanwhile, or if the load failed). Also keeps
 * `<html lang>` in sync with the rendered language.
 */
export const RouteIntlProvider = ({ children }: { children: ReactNode }) => {
  // The resolved location changes once the navigation (and its messages) finished loading.
  const pathname = useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).pathname,
  });
  useSyncExternalStore(subscribeMessages, messagesVersion, messagesVersion);
  const { locale, messages } = messagesFor(localeFromPathname(pathname));
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <AppIntlProvider locale={locale} messages={messages}>
      {children}
    </AppIntlProvider>
  );
};
