import { useTranslations } from 'use-intl';
import { useFixedEvents } from '../hooks/useGameData';
import { EventList } from './EventList';
import { SkeletonList } from './Skeleton';

/** Every fixed event of the year, grouped by season. */
export function EventsTab() {
  const events = useFixedEvents();
  const t = useTranslations('events');

  return (
    <>
      {events.isPending ? (
        <SkeletonList label={t('loading')} rows={6} />
      ) : events.isError || !events.data ? (
        <p className="text-sm text-red-700 dark:text-red-400">{t('error')}</p>
      ) : (
        <EventList events={events.data} />
      )}
    </>
  );
}
