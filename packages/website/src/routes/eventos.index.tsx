import { createFileRoute } from '@tanstack/react-router';
import { EventList } from '../components/EventList';
import { SkeletonList } from '../components/Skeleton';
import { useFixedEvents } from '../hooks/useGameData';

export const Route = createFileRoute('/eventos/')({
  component: EventsPage,
});

function EventsPage() {
  const events = useFixedEvents();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Eventos
      </h1>
      {events.isPending ? (
        <SkeletonList label="Carregando eventos..." rows={6} />
      ) : events.isError || !events.data ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          Não foi possível carregar os eventos. Recarregue a página.
        </p>
      ) : (
        <EventList events={events.data} />
      )}
    </div>
  );
}
