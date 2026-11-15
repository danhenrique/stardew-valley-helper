import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import {
  type EventKind,
  eventIconId,
  eventsInSeason,
  type FixedEvent,
  filterEvents,
} from '../lib/events';
import {
  EVENT_KIND_LABELS,
  formatEventDays,
  localizedName,
  SEASON_LABELS,
  SEASONS,
} from '../lib/i18n';
import { KIND_ICONS } from './EventCalendar';
import { GameIconOr } from './GameIcon';

// Adapted from Tailwind Plus lists/stacked-lists/03-with-links.jsx (list rows with a link per row),
// forms/input-groups (search field with leading icon) and the select used by SeasonTabs.
const KINDS = Object.keys(EVENT_KIND_LABELS) as EventKind[];

const FIELD_CLASSES =
  'block w-full rounded-md bg-white py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-green-500';

type EventListProps = { events: FixedEvent[] };

export const EventList = ({ events }: EventListProps) => {
  const [kind, setKind] = useState<EventKind | ''>('');
  const [query, setQuery] = useState('');
  const shown = filterEvents(events, { kind: kind || undefined, query });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-2 left-3 size-5 text-gray-400 dark:text-gray-500"
          />
          <input
            type="search"
            aria-label="Buscar evento"
            placeholder="Buscar evento"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${FIELD_CLASSES} pr-3 pl-10`}
          />
        </div>
        <select
          aria-label="Tipo de evento"
          value={kind}
          onChange={(event) => setKind(event.target.value as EventKind | '')}
          className={`${FIELD_CLASSES} px-3 sm:w-56 dark:*:bg-gray-800`}
        >
          <option value="">Todos os tipos</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {EVENT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nenhum evento encontrado.
        </p>
      )}

      {SEASONS.map((season) => {
        const inSeason = eventsInSeason(shown, season);
        if (inSeason.length === 0) return null;
        const headingId = `events-${season}`;
        return (
          <section key={season} aria-labelledby={headingId}>
            <h2
              id={headingId}
              className="text-base/7 font-semibold text-gray-900 dark:text-white"
            >
              {SEASON_LABELS[season]}
            </h2>
            <ul
              role="list"
              className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-md bg-white shadow-xs outline outline-black/5 dark:divide-white/5 dark:bg-gray-800/50 dark:shadow-none dark:outline-white/10"
            >
              {inSeason.map((event) => (
                <li key={event.id}>
                  <Link
                    to="/eventos/$id"
                    params={{ id: event.id }}
                    className="flex items-center justify-between gap-x-6 px-4 py-3 hover:bg-gray-50 sm:px-6 dark:hover:bg-white/5"
                  >
                    <div className="flex min-w-0 items-center gap-x-3">
                      <GameIconOr
                        id={eventIconId(event)}
                        label={localizedName(event.name)}
                        fallback={KIND_ICONS[event.kind]}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm/6 font-semibold text-gray-900 dark:text-white">
                          {localizedName(event.name)}
                        </p>
                        <p className="mt-0.5 text-xs/5 text-gray-500 dark:text-gray-400">
                          {formatEventDays(event)}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 inset-ring inset-ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:inset-ring-gray-400/20">
                      {EVENT_KIND_LABELS[event.kind]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};
