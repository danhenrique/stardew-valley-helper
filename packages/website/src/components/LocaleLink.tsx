import { Link, type LinkComponent, useNavigate } from '@tanstack/react-router';
import type {
  AnchorHTMLAttributes,
  ComponentProps,
  ComponentType,
} from 'react';
import { type Locale, localeToSegment, useRouteLocale } from '../lib/locale';

type Params = Record<string, unknown> | ((prev: never) => unknown) | undefined;

type LocaleProp = { locale?: Locale };

/** Merges the caller's params with the locale's URL segment (none for the default locale). */
const withLocale = (params: Params | true, locale: Locale) => {
  const localeParam = localeToSegment(locale);
  // `true` keeps the current params (TanStack convention).
  if (params === true) {
    return (prev: never) => ({ ...(prev as object), locale: localeParam });
  }
  if (typeof params === 'function') {
    return (prev: never) => ({
      ...(params(prev) as object),
      locale: localeParam,
    });
  }
  return { ...params, locale: localeParam };
};

/**
 * TanStack `Link` that keeps the current locale prefix, or targets `locale` when given. Use
 * `/{-$locale}/...` paths. Typed exactly like `Link` (route-checked `to`/`params`); the locale
 * is optional for callers.
 */
export const LocaleLink = (({
  locale: target,
  ...props
}: ComponentProps<typeof Link> & LocaleProp) => {
  const current = useRouteLocale();
  const Untyped = Link as unknown as ComponentType<Record<string, unknown>>;
  return (
    <Untyped
      {...props}
      params={withLocale(props.params as Params, target ?? current)}
    />
  );
}) as LinkComponent<
  ComponentType<AnchorHTMLAttributes<HTMLAnchorElement> & LocaleProp>
>;

/** Stay on the current route (same params, search, hash), only changing the locale prefix. */
type SameRouteOptions = {
  locale: Locale;
  params: true;
  search: true;
  hash: true;
};

type LocaleNavigate = ((options: SameRouteOptions) => Promise<void>) &
  ReturnType<typeof useNavigate>;

/**
 * `useNavigate` whose navigations keep the current locale prefix, or target `locale` when
 * given in the options.
 */
export const useLocaleNavigate = (): LocaleNavigate => {
  const navigate = useNavigate();
  const current = useRouteLocale();
  const untyped = navigate as unknown as (o: {
    params?: Params | true;
  }) => Promise<void>;
  return ((options: { params?: Params | true; locale?: Locale }) => {
    const { locale: target, ...rest } = options;
    return untyped({
      ...rest,
      params: withLocale(options.params, target ?? current),
    });
  }) as LocaleNavigate;
};
