import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import type {
  GameDateIn,
  MachineBatchOut,
  MachineOut,
  PlantingOut,
} from '../generated/stardew-valley-api/types.gen';
import {
  calendarMarkers,
  HARVEST_LABEL,
  harvestLabel,
  KIND_COLORS,
  KIND_ICONS,
  MACHINE_MARKER_ICONS,
  machineMarkerText,
} from '../lib/calendarMarkers';
import { type EventKind, eventsOn, type FixedEvent } from '../lib/events';
import { DAYS, type SeasonOfYear, shiftSeason } from '../lib/gameDate';
import {
  EVENT_KIND_LABELS,
  localizedName,
  MACHINE_MARKER_LABELS,
  SEASON_LABELS,
} from '../lib/i18n';
import { machineMarkers } from '../lib/machines';
import { CalendarDayCell } from './CalendarDayCell';

// Re-exported for the components that already import them from here.
export { KIND_ICONS, MACHINE_MARKER_ICONS };

import {
  MachineCatalogNotice,
  type MachineCatalogStatus,
} from './MachineCatalogNotice';

// Adapted from Tailwind Plus data-display/calendars/02-month-view.jsx (same grid as HarvestCalendar):
// a season has 28 days, day 1 is always a Monday, so it fits 4 weeks of 7 days.
const WEEKDAYS = [
  ['S', 'eg'],
  ['T', 'er'],
  ['Q', 'ua'],
  ['Q', 'ui'],
  ['S', 'ex'],
  ['S', 'áb'],
  ['D', 'om'],
] as const;

const KINDS: EventKind[] = ['festival', 'birthday', 'cropDeadline', 'foraging'];

type EventCalendarProps = {
  events: FixedEvent[];
  plantings: readonly PlantingOut[];
  names: Record<string, string>;
  today: GameDateIn;
  machines?: readonly MachineBatchOut[];
  machineCatalog?: readonly MachineOut[];
  /** Machine markers are drawn only once the catalog is loaded. */
  machineCatalogStatus?: MachineCatalogStatus;
};

const KindIcon = ({ kind }: { kind: EventKind }) => {
  const Icon = KIND_ICONS[kind];
  return <Icon aria-hidden="true" className="size-3.5" />;
};

export const EventCalendar = ({
  events,
  plantings,
  names,
  today,
  machines = [],
  machineCatalog = [],
  machineCatalogStatus = 'success',
}: EventCalendarProps) => {
  const [shown, setShown] = useState<SeasonOfYear>({
    year: today.year,
    season: today.season,
  });
  const [visibleKinds, setVisibleKinds] = useState<ReadonlySet<EventKind>>(
    new Set(KINDS),
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const title = `${SEASON_LABELS[shown.season]}, Ano ${shown.year}`;

  const visibleEvents = events.filter((e) => visibleKinds.has(e.kind));
  const hasSeasonEvents = events.some((e) => e.season === shown.season);

  const eventsForDay = (day: number) =>
    eventsOn(visibleEvents, shown.season, day);

  const harvestsOn = (day: number) =>
    plantings.filter((planting) =>
      (planting.schedule?.harvests ?? []).some(
        (h) =>
          h.year === shown.year && h.season === shown.season && h.day === day,
      ),
    );

  const allMachineMarkers =
    machineCatalogStatus === 'success'
      ? machineMarkers(machines, machineCatalog)
      : [];
  const machinesOn = (day: number) =>
    allMachineMarkers.filter(
      ({ date }) =>
        date.year === shown.year &&
        date.season === shown.season &&
        date.day === day,
    );

  const markersFor = (day: number) =>
    calendarMarkers(
      { ...shown, day },
      {
        events: visibleEvents,
        plantings,
        names,
        machineMarkers: allMachineMarkers,
      },
    );

  const toggleKind = (kind: EventKind) =>
    setVisibleKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const selectedEvents = selectedDay === null ? [] : eventsForDay(selectedDay);
  const selectedHarvests = selectedDay === null ? [] : harvestsOn(selectedDay);
  const selectedMachines = selectedDay === null ? [] : machinesOn(selectedDay);

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="sr-only">Tipos de evento</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {KINDS.map((kind) => (
            <div key={kind} className="flex gap-3">
              <div className="flex h-6 shrink-0 items-center">
                <div className="group grid size-4 grid-cols-1">
                  <input
                    id={`event-kind-${kind}`}
                    type="checkbox"
                    checked={visibleKinds.has(kind)}
                    onChange={() => toggleKind(kind)}
                    className="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-green-600 checked:bg-green-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:border-white/10 dark:bg-white/5 dark:checked:border-green-500 dark:checked:bg-green-500 dark:focus-visible:outline-green-500 forced-colors:appearance-auto"
                  />
                  <svg
                    fill="none"
                    viewBox="0 0 14 14"
                    aria-hidden="true"
                    className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white"
                  >
                    <path
                      d="M3 8L6 11L11 3.5"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="opacity-0 group-has-checked:opacity-100"
                    />
                  </svg>
                </div>
              </div>
              <label
                htmlFor={`event-kind-${kind}`}
                className="inline-flex items-center gap-1.5 text-sm/6 font-medium text-gray-900 dark:text-white"
              >
                <span
                  className={`inline-flex size-5 items-center justify-center rounded-sm ${KIND_COLORS[kind]}`}
                >
                  <KindIcon kind={kind} />
                </span>
                {EVENT_KIND_LABELS[kind]}
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      {machines.length > 0 && machineCatalogStatus !== 'success' && (
        <MachineCatalogNotice status={machineCatalogStatus} />
      )}

      <div>
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-white/10 dark:bg-gray-800/50">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <div className="relative flex items-center rounded-md bg-white shadow-xs outline -outline-offset-1 outline-gray-300 md:items-stretch dark:bg-white/10 dark:shadow-none dark:outline-white/5">
            <button
              type="button"
              aria-label="Estação anterior"
              title="Estação anterior"
              onClick={() => setShown((current) => shiftSeason(current, -1))}
              className="flex h-9 w-12 items-center justify-center rounded-l-md pr-1 text-gray-400 hover:text-gray-500 focus:relative md:w-9 md:pr-0 md:hover:bg-gray-50 dark:hover:text-white dark:md:hover:bg-white/10"
            >
              <ChevronLeftIcon aria-hidden="true" className="size-5" />
            </button>
            <span className="relative -mx-px h-5 w-px bg-gray-300 dark:bg-white/10" />
            <button
              type="button"
              aria-label="Próxima estação"
              title="Próxima estação"
              onClick={() => setShown((current) => shiftSeason(current, 1))}
              className="flex h-9 w-12 items-center justify-center rounded-r-md pl-1 text-gray-400 hover:text-gray-500 focus:relative md:w-9 md:pl-0 md:hover:bg-gray-50 dark:hover:text-white dark:md:hover:bg-white/10"
            >
              <ChevronRightIcon aria-hidden="true" className="size-5" />
            </button>
          </div>
        </header>
        {!hasSeasonEvents && (
          <p className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
            Nenhum evento nesta estação.
          </p>
        )}
        <div className="shadow-sm ring-1 ring-black/5 dark:shadow-none dark:ring-white/5">
          <div className="grid grid-cols-7 gap-px border-b border-gray-300 bg-gray-200 text-center text-xs/6 font-semibold text-gray-700 dark:border-white/5 dark:bg-white/15 dark:text-gray-300">
            {WEEKDAYS.map(([first, rest]) => (
              <div
                key={first + rest}
                className="flex justify-center bg-white py-2 dark:bg-gray-900"
              >
                <span>{first}</span>
                <span className="sr-only sm:not-sr-only">{rest}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 grid-rows-4 gap-px bg-gray-200 text-xs/6 text-gray-700 dark:bg-white/10 dark:text-gray-300">
            {DAYS.map((day) => {
              const isToday =
                shown.year === today.year &&
                shown.season === today.season &&
                day === today.day;
              return (
                <CalendarDayCell
                  key={day}
                  testId={`calendar-day-${day}`}
                  isToday={isToday}
                  markers={markersFor(day)}
                  header={
                    <button
                      type="button"
                      aria-label={`Dia ${day}`}
                      aria-pressed={selectedDay === day}
                      onClick={() =>
                        setSelectedDay((current) =>
                          current === day ? null : day,
                        )
                      }
                      className="relative rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 in-data-is-today:flex in-data-is-today:size-6 in-data-is-today:items-center in-data-is-today:justify-center in-data-is-today:bg-green-600 in-data-is-today:font-semibold in-data-is-today:text-white aria-pressed:font-bold aria-pressed:underline dark:in-data-is-today:bg-green-500"
                    >
                      <time aria-hidden="true">{day}</time>
                    </button>
                  }
                />
              );
            })}
          </div>
        </div>
      </div>

      {selectedDay !== null && (
        <section
          aria-label={`Eventos do dia ${selectedDay}`}
          className="rounded-lg bg-white p-4 shadow-sm outline outline-black/5 dark:bg-gray-800/50 dark:outline-white/10"
        >
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {`${SEASON_LABELS[shown.season]} ${selectedDay}`}
          </h3>
          {selectedEvents.length === 0 &&
          selectedHarvests.length === 0 &&
          selectedMachines.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Nenhum evento neste dia.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100 dark:divide-white/10">
              {selectedHarvests.map((p) => (
                <li key={`harvest:${p.id}`} className="py-2 text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {harvestLabel(p, names)}
                  </span>
                  <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                    {HARVEST_LABEL}
                  </span>
                </li>
              ))}
              {selectedMachines.map((m) => (
                <li key={m.key} className="py-2 text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {machineMarkerText(m)}
                  </span>
                  <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                    {MACHINE_MARKER_LABELS[m.kind]}
                  </span>
                </li>
              ))}
              {selectedEvents.map((event) => (
                <li key={event.id} className="py-2 text-sm">
                  <Link
                    to="/eventos/$id"
                    params={{ id: event.id }}
                    className="font-medium text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
                  >
                    {localizedName(event.name)}
                    <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                      {EVENT_KIND_LABELS[event.kind]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};
