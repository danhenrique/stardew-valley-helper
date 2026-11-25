import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { CalendarTab } from '../../components/CalendarTab';
import { EventsTab } from '../../components/EventsTab';
import { useLocaleNavigate } from '../../components/LocaleLink';
import {
  type UnderlineTab,
  UnderlineTabs,
} from '../../components/UnderlineTabs';

export type CalendarTabId = 'calendar' | 'events';

/** The `tab` search param; a missing or unknown tab opens the calendar. */
export const parseCalendarSearch = (
  search: Record<string, unknown>,
): { tab: CalendarTabId } => ({
  tab: search['tab'] === 'events' ? 'events' : 'calendar',
});

export const Route = createFileRoute('/{-$locale}/calendar')({
  validateSearch: parseCalendarSearch,
  component: CalendarPage,
});

function CalendarPage() {
  const { tab } = parseCalendarSearch(useSearch({ strict: false }));
  const navigate = useLocaleNavigate();
  const t = useTranslations('calendar');
  const tabs: readonly UnderlineTab<CalendarTabId>[] = [
    { id: 'calendar', label: t('tabs.calendar') },
    { id: 'events', label: t('tabs.events') },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        {t('title')}
      </h1>
      <UnderlineTabs
        tabs={tabs}
        value={tab}
        onChange={(next) =>
          navigate({
            to: '/{-$locale}/calendar',
            search: { tab: next },
            replace: true,
          })
        }
        navLabel={t('tabs.nav')}
        selectLabel={t('tabs.choose')}
      />
      {tab === 'events' ? <EventsTab /> : <CalendarTab />}
    </div>
  );
}
