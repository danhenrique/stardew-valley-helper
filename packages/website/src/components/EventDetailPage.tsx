import {
  useFestivalShopsClosed,
  useFixedEvents,
  usePlantables,
  useVillagerGifts,
} from '../hooks/useGameData';
import { type FixedEvent, findEvent } from '../lib/events';
import { BackToEvents, EventDetail } from './EventDetail';
import { SkeletonPage } from './Skeleton';

const Container = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-6">{children}</div>
);

const FestivalDetail = ({ event }: { event: FixedEvent }) => (
  <EventDetail
    event={event}
    details={{ shopsClosed: useFestivalShopsClosed(event.refId) }}
  />
);

const BirthdayDetail = ({ event }: { event: FixedEvent }) => (
  <EventDetail
    event={event}
    details={{ gifts: useVillagerGifts(event.refId) }}
  />
);

const CropDeadlineDetail = ({ event }: { event: FixedEvent }) => {
  const plantables = usePlantables();
  const plantable = plantables.data?.find((p) => p.id === event.refId);
  return <EventDetail event={event} details={{ plantable }} />;
};

const KindDetail = ({ event }: { event: FixedEvent }) => {
  switch (event.kind) {
    case 'festival':
      return <FestivalDetail event={event} />;
    case 'birthday':
      return <BirthdayDetail event={event} />;
    case 'cropDeadline':
      return <CropDeadlineDetail event={event} />;
    case 'foraging':
      return <EventDetail event={event} details={{}} />;
  }
};

export const EventDetailPage = ({ id }: { id: string }) => {
  const events = useFixedEvents();

  if (events.isPending) return <SkeletonPage label="Carregando..." rows={4} />;
  if (events.isError || !events.data)
    return (
      <p className="text-sm text-red-700 dark:text-red-400">
        Não foi possível carregar o evento. Recarregue a página.
      </p>
    );

  const event = findEvent(events.data, id);
  if (!event)
    return (
      <Container>
        <BackToEvents />
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Evento não encontrado
        </h1>
      </Container>
    );
  return <KindDetail event={event} />;
};
