import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import type { GameDateIn } from '../generated/stardew-valley-api/types.gen';
import {
  DAYS,
  type SeasonOfYear,
  shiftSeason,
  WEEKDAYS,
} from '../lib/gameDate';
import { GameIcon } from './GameIcon';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus data-display/calendars/02-month-view.jsx: a season has 28 days,
// day 1 is always a Monday, so it fits 4 weeks of 7 days.
/** One entry shown on its day; `id` is unique among the markers of that day. */
export type CalendarMarker = {
  id: string;
  date: GameDateIn;
  text: string;
  /** Data id whose sprite is shown before the text. */
  iconId?: string;
};

type SeasonCalendarProps = {
  markers: readonly CalendarMarker[];
  today: GameDateIn;
};

export const SeasonCalendar = ({ markers, today }: SeasonCalendarProps) => {
  const labels = useLabels();
  const t = useTranslations('common.seasonCalendar');
  const [shown, setShown] = useState<SeasonOfYear>({
    year: today.year,
    season: today.season,
  });
  const title = t('title', {
    season: labels.season(shown.season),
    year: shown.year,
  });

  const markersOn = (day: number) =>
    markers.filter(
      ({ date }) =>
        date.year === shown.year &&
        date.season === shown.season &&
        date.day === day,
    );

  return (
    <div>
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-white/10 dark:bg-gray-800/50">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        <div className="relative flex items-center rounded-md bg-white shadow-xs outline -outline-offset-1 outline-gray-300 md:items-stretch dark:bg-white/10 dark:shadow-none dark:outline-white/5">
          <button
            type="button"
            aria-label={t('previous')}
            title={t('previous')}
            onClick={() => setShown((current) => shiftSeason(current, -1))}
            className="flex h-9 w-12 items-center justify-center rounded-l-md pr-1 text-gray-400 hover:text-gray-500 focus:relative md:w-9 md:pr-0 md:hover:bg-gray-50 dark:hover:text-white dark:md:hover:bg-white/10"
          >
            <ChevronLeftIcon aria-hidden="true" className="size-5" />
          </button>
          <span className="relative -mx-px h-5 w-px bg-gray-300 dark:bg-white/10" />
          <button
            type="button"
            aria-label={t('next')}
            title={t('next')}
            onClick={() => setShown((current) => shiftSeason(current, 1))}
            className="flex h-9 w-12 items-center justify-center rounded-r-md pl-1 text-gray-400 hover:text-gray-500 focus:relative md:w-9 md:pl-0 md:hover:bg-gray-50 dark:hover:text-white dark:md:hover:bg-white/10"
          >
            <ChevronRightIcon aria-hidden="true" className="size-5" />
          </button>
        </div>
      </header>
      <div className="shadow-sm ring-1 ring-black/5 dark:shadow-none dark:ring-white/5">
        <div className="grid grid-cols-7 gap-px border-b border-gray-300 bg-gray-200 text-center text-xs/6 font-semibold text-gray-700 dark:border-white/5 dark:bg-white/15 dark:text-gray-300">
          {WEEKDAYS.map((weekday) => {
            const [first, ...rest] = Array.from(labels.weekday(weekday));
            return (
              <div
                key={weekday}
                className="flex justify-center bg-white py-2 dark:bg-gray-900"
              >
                <span>{first.toLocaleUpperCase()}</span>
                <span className="sr-only sm:not-sr-only">{rest.join('')}</span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 grid-rows-4 gap-px bg-gray-200 text-xs/6 text-gray-700 dark:bg-white/10 dark:text-gray-300">
          {DAYS.map((day) => {
            const isToday =
              shown.year === today.year &&
              shown.season === today.season &&
              day === today.day;
            const entries = markersOn(day);
            return (
              <div
                key={day}
                data-testid={`calendar-day-${day}`}
                data-is-today={isToday ? '' : undefined}
                className="group relative min-h-20 bg-white px-2 py-2 dark:bg-gray-900"
              >
                <time className="relative in-data-is-today:flex in-data-is-today:size-6 in-data-is-today:items-center in-data-is-today:justify-center in-data-is-today:rounded-full in-data-is-today:bg-green-600 in-data-is-today:font-semibold in-data-is-today:text-white dark:in-data-is-today:bg-green-500">
                  {day}
                </time>
                {entries.length > 0 && (
                  <ol className="mt-1">
                    {entries.slice(0, 2).map((marker) => (
                      <li key={marker.id}>
                        <p
                          title={marker.text}
                          className="flex items-center gap-1 font-medium text-gray-900 dark:text-white"
                        >
                          {marker.iconId && (
                            <GameIcon
                              id={marker.iconId}
                              label={marker.text}
                              size="sm"
                            />
                          )}
                          <span className="truncate">{marker.text}</span>
                        </p>
                      </li>
                    ))}
                    {entries.length > 2 && (
                      <li className="text-gray-500 dark:text-gray-400">
                        + {entries.length - 2}
                      </li>
                    )}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
