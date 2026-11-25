import type {
  GameDateIn,
  Location,
  MachineScheduleOut,
  Quality,
  ScheduleOut,
  Season,
} from '../generated/stardew-valley-api/types.gen';
import { type Locale, type LocalizedText, localizedText } from './locale';
import { type MessageRef, message } from './message';

// The generator names the planting and machine status unions `Status1` and `Status`
// (unstable under collisions), so derive them from the schedules instead.
export type PlantingStatus = ScheduleOut['status'];
export type MachineStatus = MachineScheduleOut['status'];

export const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];

export const LOCATIONS: Location[] = ['farm', 'greenhouse', 'ginger-island'];

export const seasonMessage = (season: Season): MessageRef =>
  message(`labels.season.${season}`);

export const locationMessage = (location: Location): MessageRef =>
  message(`labels.location.${location}`);

export const qualityMessage = (quality: Quality): MessageRef =>
  message(`labels.quality.${quality}`);

export const localizedName = (name: LocalizedText, locale: Locale): string =>
  localizedText(name, locale) ?? '';

/** "Spring 9" or "Spring 9–10" for multi-day events. */
export const eventDaysMessage = (event: {
  season: Season;
  day: number;
  endDay?: number;
}): MessageRef =>
  event.endDay === undefined
    ? message('labels.eventDay', {
        season: seasonMessage(event.season),
        day: event.day,
      })
    : message('labels.eventDayRange', {
        season: seasonMessage(event.season),
        day: event.day,
        endDay: event.endDay,
      });

/** Placeholder for item names until real names are available: "golden-pumpkin" -> "Golden Pumpkin". */
export const humanizeId = (id: string): string =>
  id
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** "Spring 9, Year 1" in the active language. */
export const gameDateMessage = (date: GameDateIn): MessageRef =>
  message('labels.gameDate', {
    season: seasonMessage(date.season),
    day: date.day,
    year: date.year,
  });

export const formatAmount = (value: number, locale: Locale): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);

/** "≈ 40.8 total (20.4 per harvest)" or "≈ 20.4 per harvest" for open-ended schedules. */
export const expectedYieldMessage = (
  perHarvest: number,
  total: number | null | undefined,
  locale: Locale,
): MessageRef =>
  total == null
    ? message('labels.expectedYield.perHarvest', {
        perHarvest: formatAmount(perHarvest, locale),
      })
    : message('labels.expectedYield.total', {
        total: formatAmount(total, locale),
        perHarvest: formatAmount(perHarvest, locale),
      });
