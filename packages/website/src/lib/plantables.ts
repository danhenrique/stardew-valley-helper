import type {
  Anchor,
  Location,
  PlantableOut,
  Season,
} from '../generated/stardew-valley-api/types.gen';
import { SEASON_LABELS } from './i18n';

export const filterPlantables = (
  plantables: PlantableOut[],
  season: Season,
  location: Location,
  anchor: Anchor,
): PlantableOut[] =>
  plantables.filter((plantable) => {
    if (anchor === 'harvested') {
      return (
        plantable.kind === 'crop' &&
        plantable.regrowDays != null &&
        (location !== 'farm' || plantable.seasons.includes(season))
      );
    }
    if (location !== 'farm' || plantable.kind === 'fruit_tree') return true;
    return plantable.seasons.includes(season);
  });

export const describePlantable = (plantable: PlantableOut): string => {
  const seasons = plantable.seasons
    .map((season) => SEASON_LABELS[season])
    .join(', ');
  if (plantable.kind === 'fruit_tree')
    return `${seasons} · árvore: ${plantable.daysToMature} dias`;
  const regrow =
    plantable.regrowDays != null ? ` · rebrota ${plantable.regrowDays}` : '';
  return `${seasons} · ${plantable.growthDays} dias${regrow}`;
};
