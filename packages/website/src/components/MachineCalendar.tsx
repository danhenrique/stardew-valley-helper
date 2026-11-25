import { useLocale } from 'use-intl';
import type {
  GameDateIn,
  MachineBatchOut,
  MachineOut,
} from '../generated/stardew-valley-api/types.gen';
import { machineMarkerText } from '../lib/calendarMarkers';
import { machineBatchNames, machineDates } from '../lib/machines';
import { SeasonCalendar } from './SeasonCalendar';
import { useLabels } from './useLabels';

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
}: MachineCalendarProps) => {
  const locale = useLocale();
  const labels = useLabels();
  return (
    <SeasonCalendar
      today={today}
      markers={batches.flatMap((batch) => {
        const name =
          batch.label || machineBatchNames(batch, machines, locale).output;
        return machineDates(batch).map(({ date, label }) => ({
          id: `${batch.id}-${label.key}`,
          date,
          text: labels.text(machineMarkerText({ name, label })),
          iconId: batch.machineId,
        }));
      })}
    />
  );
};
