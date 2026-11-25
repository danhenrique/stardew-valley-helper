import { useParams } from '@tanstack/react-router';

/** Supported locales as BCP 47 codes. Adding one: an entry here, its segment and a message file. */
export const LOCALES = ['pt-BR', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'pt-BR';

/** URL segment of each locale; the default locale has none. */
const SEGMENTS: Record<Locale, string | undefined> = {
  'pt-BR': undefined,
  en: 'en',
};

/** The `{-$locale}` path param for a locale (`undefined` = no prefix). */
export const localeToSegment = (locale: Locale): string | undefined =>
  SEGMENTS[locale];

/** Maps the optional `{-$locale}` path param to a locale; `null` means unknown (not found). */
export const parseLocaleParam = (param: string | undefined): Locale | null =>
  LOCALES.find((locale) => SEGMENTS[locale] === param) ?? null;

/**
 * Locale of a pathname from its first segment, falling back to the default locale. For code
 * rendered outside the `{-$locale}` layout (e.g. the root not-found page for `/xx`).
 */
export const localeFromPathname = (pathname: string): Locale =>
  parseLocaleParam(pathname.split('/')[1] || undefined) ?? DEFAULT_LOCALE;

/** A game text as the API and the data files carry it: one entry per language. */
export type LocalizedText =
  | { en?: string | null; ptBr?: string | null }
  | null
  | undefined;

/** The text in the locale, else the English one; empty text counts as missing. */
export const localizedText = (
  value: LocalizedText,
  locale: Locale,
): string | undefined => {
  const preferred = locale === 'pt-BR' ? value?.ptBr : value?.en;
  return preferred || value?.en || undefined;
};

/**
 * The locale in the URL. Use it only for routing: links, `LocaleLink`/`useLocaleNavigate` and
 * the language switcher. Text, number/date formatting and game texts must use `use-intl`'s
 * `useLocale()` instead: the locale actually rendered, which differs when the URL locale's
 * messages failed to load and the UI fell back to the default locale.
 */
export const useRouteLocale = (): Locale => {
  const { locale } = useParams({ strict: false });
  return parseLocaleParam(locale) ?? DEFAULT_LOCALE;
};

const STORAGE_KEY = 'stardew.locale';

// Used when storage is unreadable or unwritable (private mode), so a choice still lasts for
// the session instead of being undone by the next redirect.
let memoryLocale: Locale | null = null;

/** The locale the user chose or opened explicitly; `null` when none was remembered. */
export const readSavedLocale = (): Locale | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const stored = LOCALES.find((locale) => locale === value) ?? null;
    return memoryLocale ?? stored;
  } catch {
    return memoryLocale;
  }
};

/** Remembers the locale (in storage, and in memory when storage fails). */
export const saveLocale = (locale: Locale): void => {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
    memoryLocale = null;
  } catch {
    memoryLocale = locale;
  }
};

/** Test helper: forgets the in-memory fallback. */
export const resetMemoryLocale = (): void => {
  memoryLocale = null;
};

/**
 * Saved choice wins; otherwise the first browser language that is supported (`pt*` is
 * Portuguese, `en*` English); none supported means English, no languages means Portuguese.
 */
export const detectLocale = (
  saved: Locale | null,
  languages: readonly string[],
): Locale => {
  if (saved) return saved;
  if (languages.length === 0) return DEFAULT_LOCALE;
  for (const language of languages) {
    if (/^pt(-|$)/i.test(language)) return 'pt-BR';
    if (/^en(-|$)/i.test(language)) return 'en';
  }
  return 'en';
};

/**
 * Redirect for a path without a locale prefix when the detected locale is not the default;
 * `null` otherwise. Keeps the path and search.
 */
export const localeRedirect = (
  pathname: string,
  search: Record<string, unknown>,
  detected: Locale,
): { to: string; search: Record<string, unknown> } | null => {
  const segment = localeToSegment(detected);
  if (!segment) return null;
  const first = pathname.split('/')[1];
  if (LOCALES.some((l) => localeToSegment(l) === first && first)) return null;
  return {
    to: pathname === '/' ? `/${segment}` : `/${segment}${pathname}`,
    search,
  };
};
