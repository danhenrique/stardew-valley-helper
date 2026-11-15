import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { LocalizedTextOut } from '../generated/stardew-valley-api/types.gen';
import { humanizeId } from '../lib/i18n';
import { useStardewValleyApi } from './useStardewValleyApi';

/** pt-BR name of a game id, else the English one, else the humanized id. */
export const pickName = (
  names: Record<string, LocalizedTextOut> | undefined,
  id: string,
): string => {
  const name = names?.[id];
  return name?.ptBr || name?.en || humanizeId(id);
};

/** Localized names of every item, category and building; loading or failing falls back to `humanizeId`. */
export const useGameNames = () => {
  const api = useStardewValleyApi();
  const { data } = useQuery({
    ...api.listGameNames.queryOptions(),
    staleTime: Infinity,
  });
  const nameOf = useCallback((id: string) => pickName(data, id), [data]);
  return { nameOf };
};
