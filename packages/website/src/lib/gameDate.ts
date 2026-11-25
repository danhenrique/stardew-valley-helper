import type {
  GameDateIn,
  Season,
} from '../generated/stardew-valley-api/types.gen';
import { SEASONS } from './i18n';

export const DAYS: number[] = Array.from(
  { length: 28 },
  (_, index) => index + 1,
);
export const MAX_YEAR = 999;

export const clampDay = (day: number): number =>
  Math.min(DAYS.length, Math.max(1, day));

export const clampYear = (year: number): number =>
  Math.min(MAX_YEAR, Math.max(1, year));

export type SeasonOfYear = { year: number; season: Season };

export const sameDate = (a: GameDateIn, b: GameDateIn): boolean =>
  a.year === b.year && a.season === b.season && a.day === b.day;

export const shiftSeason = (
  current: SeasonOfYear,
  delta: 1 | -1,
): SeasonOfYear => {
  const index =
    (current.year - 1) * SEASONS.length +
    SEASONS.indexOf(current.season) +
    delta;
  if (index < 0) return current;
  return {
    year: Math.floor(index / SEASONS.length) + 1,
    season: SEASONS[index % SEASONS.length],
  };
};

export const shiftDay = (date: GameDateIn, delta: 1 | -1): GameDateIn => {
  const nextDay = date.day + delta;
  if (nextDay >= 1 && nextDay <= DAYS.length) return { ...date, day: nextDay };
  const next = shiftSeason(date, delta);
  if (next === date || next.year > MAX_YEAR) return date;
  return { ...next, day: delta === 1 ? 1 : DAYS.length };
};

export const canShiftDay = (date: GameDateIn, delta: 1 | -1): boolean =>
  shiftDay(date, delta) !== date;

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEKDAYS: Weekday[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

/** Day 1 of every season is a Monday. */
export const weekdayOf = (day: number): Weekday =>
  WEEKDAYS[(((day - 1) % 7) + 7) % 7];

/** `count` consecutive dates from `start` (included), crossing seasons and years. */
export const nextDates = (start: GameDateIn, count: number): GameDateIn[] => {
  const dates = [start];
  while (dates.length < count) {
    const next = shiftDay(dates[dates.length - 1], 1);
    if (next === dates[dates.length - 1]) break;
    dates.push(next);
  }
  return dates;
};
