import {
  createFileRoute,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { CalendarTab } from '../components/CalendarTab';
import { EventsTab } from '../components/EventsTab';
import { type UnderlineTab, UnderlineTabs } from '../components/UnderlineTabs';

export type CalendarTabId = 'calendario' | 'eventos';

const TABS: readonly UnderlineTab<CalendarTabId>[] = [
  { id: 'calendario', label: 'Calendário' },
  { id: 'eventos', label: 'Eventos' },
];

/** The `aba` search param; a missing or unknown tab opens the calendar. */
export const parseCalendarSearch = (
  search: Record<string, unknown>,
): { aba: CalendarTabId } => ({
  aba: search['aba'] === 'eventos' ? 'eventos' : 'calendario',
});

export const Route = createFileRoute('/calendario')({
  validateSearch: parseCalendarSearch,
  component: CalendarPage,
});

function CalendarPage() {
  const { aba } = parseCalendarSearch(useSearch({ strict: false }));
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Calendário
      </h1>
      <UnderlineTabs
        tabs={TABS}
        value={aba}
        onChange={(tab) =>
          navigate({ to: '/calendario', search: { aba: tab }, replace: true })
        }
        navLabel="Seções do calendário"
        selectLabel="Escolha uma seção do calendário"
      />
      {aba === 'eventos' ? <EventsTab /> : <CalendarTab />}
    </div>
  );
}
