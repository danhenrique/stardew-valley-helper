import type {
  Anchor,
  Location,
  PlantableOut,
  Season,
} from '../generated/stardew-valley-api/types.gen';
import { seasonMessage } from './i18n';
import { type MessageRef, message } from './message';

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

export const describePlantable = (plantable: PlantableOut): MessageRef => {
  const seasons = plantable.seasons.map(seasonMessage);
  if (plantable.kind === 'fruit_tree')
    return message('labels.plantable.tree', {
      seasons,
      days: plantable.daysToMature ?? 0,
    });
  return plantable.regrowDays != null
    ? message('labels.plantable.cropRegrow', {
        seasons,
        days: plantable.growthDays ?? 0,
        regrow: plantable.regrowDays,
      })
    : message('labels.plantable.crop', {
        seasons,
        days: plantable.growthDays ?? 0,
      });
};
