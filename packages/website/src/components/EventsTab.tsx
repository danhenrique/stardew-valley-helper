import { useFixedEvents } from '../hooks/useGameData';
import { EventList } from './EventList';
import { SkeletonList } from './Skeleton';

/** Every fixed event of the year, grouped by season. */
export function EventsTab() {
  const events = useFixedEvents();

  return (
    <>
      {events.isPending ? (
        <SkeletonList label="Carregando eventos..." rows={6} />
      ) : events.isError || !events.data ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          Não foi possível carregar os eventos. Recarregue a página.
        </p>
      ) : (
        <EventList events={events.data} />
      )}
    </>
  );
}
