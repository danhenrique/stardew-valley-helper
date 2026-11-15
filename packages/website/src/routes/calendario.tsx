import { createFileRoute } from '@tanstack/react-router';
import { EventCalendar } from '../components/EventCalendar';
import { machineCatalogStatus } from '../components/MachineCatalogNotice';
import { SkeletonCalendar } from '../components/Skeleton';
import {
  useFixedEvents,
  useMachines,
  useMe,
  usePlantables,
} from '../hooks/useGameData';
import { localizedName } from '../lib/i18n';

export const Route = createFileRoute('/calendario')({
  component: CalendarPage,
});

function CalendarPage() {
  const events = useFixedEvents();
  const me = useMe();
  const plantables = usePlantables();
  const machines = useMachines();

  const names = Object.fromEntries(
    (plantables.data ?? []).map((p) => [p.id, localizedName(p.name)]),
  );

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Calendário
      </h1>
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
    </div>
  );
}
