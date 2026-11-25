import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useLocale } from 'use-intl';
import type { LocalizedTextOut } from '../generated/stardew-valley-api/types.gen';
import { humanizeId } from '../lib/i18n';
import { type Locale, localizedText } from '../lib/locale';
import { useStardewValleyApi } from './useStardewValleyApi';

/** Name of a game id in the locale (English when missing), else the humanized id. */
export const pickName = (
  names: Record<string, LocalizedTextOut> | undefined,
  id: string,
  locale: Locale,
): string => localizedText(names?.[id], locale) ?? humanizeId(id);

/** Localized names of every item, category and building; loading or failing falls back to `humanizeId`. */
export const useGameNames = () => {
  const api = useStardewValleyApi();
  const locale = useLocale();
  const { data } = useQuery({
    ...api.listGameNames.queryOptions(),
    staleTime: Infinity,
  });
  const nameOf = useCallback(
    (id: string) => pickName(data, id, locale),
    [data, locale],
  );
  return { nameOf };
};
