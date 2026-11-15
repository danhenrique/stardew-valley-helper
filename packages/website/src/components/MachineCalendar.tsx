import type {
  GameDateIn,
  MachineBatchOut,
  MachineOut,
} from '../generated/stardew-valley-api/types.gen';
import { machineBatchNames, machineDates } from '../lib/machines';
import { SeasonCalendar } from './SeasonCalendar';

// Adapted from Tailwind Plus data-display/calendars/02-month-view.jsx (via SeasonCalendar)

type MachineCalendarProps = {
  batches: readonly MachineBatchOut[];
  machines: readonly MachineOut[];
  today: GameDateIn;
};

/** Season calendar marking when each machine is ready, collected or reaches a quality. */
export const MachineCalendar = ({
  batches,
  machines,
  today,
}: MachineCalendarProps) => (
  <SeasonCalendar
    today={today}
    markers={batches.flatMap((batch) => {
      const name = batch.label || machineBatchNames(batch, machines).output;
      return machineDates(batch).map(({ date, label }) => ({
        id: `${batch.id}-${label}`,
        date,
        text: `${name} · ${label}`,
        iconId: batch.machineId,
      }));
    })}
  />
);
