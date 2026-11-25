import { useMemo } from 'react';
import { useLocale } from 'use-intl';
import type { PlantableOut } from '../generated/stardew-valley-api/types.gen';
import { localizedName } from '../lib/i18n';

/** Display name per plantable id (in the rendered locale). */
export const usePlantableNames = (
  plantables: readonly PlantableOut[] | undefined,
): Record<string, string> => {
  const locale = useLocale();
  return useMemo(
    () =>
      Object.fromEntries(
        (plantables ?? []).map((plantable) => [
          plantable.id,
          localizedName(plantable.name, locale),
        ]),
      ),
    [plantables, locale],
  );
};
