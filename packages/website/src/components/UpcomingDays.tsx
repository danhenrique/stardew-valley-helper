import { type ReactNode, useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';
import type {
  GameDateIn,
  MachineBatchOut,
  MachineOut,
  PlantingOut,
} from '../generated/stardew-valley-api/types.gen';
import { type CalendarMarker, calendarMarkers } from '../lib/calendarMarkers';
import type { FixedEvent } from '../lib/events';
import { nextDates, sameDate, weekdayOf } from '../lib/gameDate';
import { machineMarkers } from '../lib/machines';
import { BirthdayGiftsModal } from './BirthdayGiftsModal';
import { CalendarDayCell } from './CalendarDayCell';
import { LocaleLink } from './LocaleLink';
import {
  MachineCatalogNotice,
  type MachineCatalogStatus,
} from './MachineCatalogNotice';
import { CARD } from './styles';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus data-display/calendars/02-month-view.jsx: one week row, stacked on phones.

/** How many days the strip shows, today included. */
export const UPCOMING_DAYS = 7;

const MARKER_ACTION =
  'flex w-full min-w-0 items-center gap-1 text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-600';

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

const DayHeader = ({ date }: { date: GameDateIn }) => {
  const labels = useLabels();
  return (
    <div className="flex items-baseline gap-x-1.5">
      <span className="font-semibold in-data-is-today:text-green-700 dark:in-data-is-today:text-green-400">
        {`${capitalize(labels.weekday(weekdayOf(date.day)))} ${date.day}`}
      </span>
      {date.day === 1 && (
        <span className="text-gray-500 dark:text-gray-400">
          {labels.season(date.season)}
        </span>
      )}
    </div>
  );
};

type UpcomingDaysProps = {
  events: FixedEvent[];
  today: GameDateIn;
  plantings: readonly PlantingOut[];
  names: Record<string, string>;
  machines?: readonly MachineBatchOut[];
  machineCatalog?: readonly MachineOut[];
  machineCatalogStatus?: MachineCatalogStatus;
};

/** Every event, harvest and machine date from today to six days ahead. */
export const UpcomingDays = ({
  events,
  today,
  plantings,
  names,
  machines = [],
  machineCatalog = [],
  machineCatalogStatus = 'success',
}: UpcomingDaysProps) => {
  const locale = useLocale();
  const t = useTranslations('today');
  const [birthday, setBirthday] = useState<FixedEvent | null>(null);
  const allMachineMarkers =
    machineCatalogStatus === 'success'
      ? machineMarkers(machines, machineCatalog, locale)
      : [];

  const renderMarker = (marker: CalendarMarker, content: ReactNode) => {
    const { target } = marker;
    if (target.kind === 'event' && target.event.kind === 'birthday') {
      const { event } = target;
      return (
        <button
          type="button"
          onClick={() => setBirthday(event)}
          className={MARKER_ACTION}
        >
          {content}
        </button>
      );
    }
    if (target.kind === 'event') {
      return (
        <LocaleLink
          to="/{-$locale}/events/$id"
          params={{ id: target.event.id }}
          className={MARKER_ACTION}
        >
          {content}
        </LocaleLink>
      );
    }
    return (
      <LocaleLink
        to="/{-$locale}/farming"
        search={{ tab: target.kind === 'harvest' ? 'plantings' : 'machines' }}
        className={MARKER_ACTION}
      >
        {content}
      </LocaleLink>
    );
  };

  return (
    <section className={CARD}>
      <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">
        {t('upcoming')}
      </h2>
      {machines.length > 0 && machineCatalogStatus !== 'success' && (
        <div className="mt-2">
          <MachineCatalogNotice status={machineCatalogStatus} />
        </div>
      )}
      <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md bg-gray-200 text-xs/6 text-gray-700 ring-1 ring-black/5 sm:grid-cols-7 dark:bg-white/10 dark:text-gray-300 dark:ring-white/5">
        {nextDates(today, UPCOMING_DAYS).map((date) => (
          <CalendarDayCell
            key={`${date.year}-${date.season}-${date.day}`}
            testId={`upcoming-day-${date.season}-${date.day}`}
            isToday={sameDate(date, today)}
            header={<DayHeader date={date} />}
            markers={calendarMarkers(date, {
              events,
              plantings,
              names,
              locale,
              machineMarkers: allMachineMarkers,
            })}
            renderMarker={renderMarker}
          />
        ))}
      </div>
      <BirthdayGiftsModal
        event={birthday}
        open={birthday !== null}
        onClose={() => setBirthday(null)}
      />
    </section>
  );
};
