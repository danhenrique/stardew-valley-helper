import {
  useFixedEvents,
  useMachines,
  useMe,
  usePlantables,
} from '../hooks/useGameData';
import { localizedName } from '../lib/i18n';
import { EventCalendar } from './EventCalendar';
import { machineCatalogStatus } from './MachineCatalogNotice';
import { SkeletonCalendar } from './Skeleton';

/** Month view of the current season: events, harvests and machines. */
export function CalendarTab() {
  const events = useFixedEvents();
  const me = useMe();
  const plantables = usePlantables();
  const machines = useMachines();

  const names = Object.fromEntries(
    (plantables.data ?? []).map((p) => [p.id, localizedName(p.name)]),
  );

  return (
    <>
      {events.isPending || me.isPending ? (
        <SkeletonCalendar label="Carregando calendário..." days={28} />
      ) : events.isError || me.isError || !events.data || !me.data ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          Não foi possível carregar o calendário. Recarregue a página.
        </p>
      ) : (
        <EventCalendar
          events={events.data}
          plantings={me.data.plantings}
          names={names}
          today={me.data.profile.currentDate}
          machines={me.data.machines ?? []}
          machineCatalog={machines.data ?? []}
          machineCatalogStatus={machineCatalogStatus(machines)}
        />
      )}
    </>
  );
}
