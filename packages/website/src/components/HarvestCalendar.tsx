import type {
  GameDateIn,
  PlantingOut,
} from '../generated/stardew-valley-api/types.gen';
import { SeasonCalendar } from './SeasonCalendar';

type HarvestCalendarProps = {
  plantings: readonly PlantingOut[];
  names: Record<string, string>;
  today: GameDateIn;
};

/** Season calendar marking every harvest day of each planting. */
export const HarvestCalendar = ({
  plantings,
  names,
  today,
}: HarvestCalendarProps) => (
  <SeasonCalendar
    today={today}
    markers={plantings.flatMap((planting) => {
      const text = planting.label || names[planting.seedId] || planting.seedId;
      return (planting.schedule?.harvests ?? []).map((date) => ({
        id: planting.id,
        date,
        text,
        iconId: planting.seedId,
      }));
    })}
  />
);
