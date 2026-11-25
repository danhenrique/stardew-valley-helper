import { DEFAULT_LOCALE, type Locale } from './locale';
import { DEFAULT_MESSAGES, loadMessages, type Messages } from './messages';

const loaded = new Map<Locale, Messages>();
const pending = new Map<Locale, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;

/** `useSyncExternalStore` source: lets the provider re-render when a locale finishes loading. */
export const subscribeMessages = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const messagesVersion = () => version;

/** Test-only: forgets every loaded locale except the default one. */
export const resetMessageCache = () => {
  loaded.clear();
  pending.clear();
  loaded.set(DEFAULT_LOCALE, DEFAULT_MESSAGES);
};
resetMessageCache();

/**
 * Loads the messages of `locale` once. Never rejects: a failed load is forgotten (the next call
 * retries) and `messagesFor` keeps falling back to the default locale meanwhile.
 */
export const preloadMessages = (locale: Locale): Promise<void> => {
  if (loaded.has(locale)) return Promise.resolve();
  let promise = pending.get(locale);
  if (!promise) {
    promise = loadMessages(locale)
      .then((messages) => {
        loaded.set(locale, messages);
        version += 1;
        for (const listener of listeners) listener();
      })
      .catch(() => undefined)
      .finally(() => pending.delete(locale));
    pending.set(locale, promise);
  }
  return promise;
};

/**
 * The locale and messages to render for `locale`: its own when loaded, otherwise the default
 * locale's (so a failed chunk still shows a working page instead of a blank one).
 */
export const messagesFor = (
  locale: Locale,
): { locale: Locale; messages: Messages } => {
  const messages = loaded.get(locale);
  return messages
    ? { locale, messages }
    : { locale: DEFAULT_LOCALE, messages: DEFAULT_MESSAGES };
};
