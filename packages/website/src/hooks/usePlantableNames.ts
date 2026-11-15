import { useMemo } from 'react';
import type { PlantableOut } from '../generated/stardew-valley-api/types.gen';
import { localizedName } from '../lib/i18n';

/** Display name per plantable id (pt-BR when available). */
export const usePlantableNames = (
  plantables: readonly PlantableOut[] | undefined,
): Record<string, string> =>
  useMemo(
    () =>
      Object.fromEntries(
        (plantables ?? []).map((plantable) => [
          plantable.id,
          localizedName(plantable.name),
        ]),
      ),
    [plantables],
  );
