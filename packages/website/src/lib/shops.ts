import type {
  GameDateIn,
  GameEntityOut,
  ProfileIn,
} from '../generated/stardew-valley-api/types.gen';
import {
  type FixedEvent,
  isRecord,
  type LocalizedName,
  shopsClosedBy,
} from './events';
import { WEEKDAYS, type Weekday, weekdayOf } from './gameDate';
import { type Locale, localizedText } from './locale';
import { type MessageRef, message, type Translatable } from './message';

export type ShopProgress = Pick<
  ProfileIn,
  'communityCenterRestored' | 'keyToTown' | 'boatRepaired' | 'rainToday'
>;

export type HoursRange = { open: string; close: string };

type ShopDate = { season: string; day: number };

export type ShopSchedule = {
  hours?: HoursRange;
  hoursWithKeyToTown?: HoursRange[];
  hoursAfterBoatRepair?: HoursRange;
  weekdayHours?: Partial<Record<Weekday, HoursRange>>;
  dateHours?: { date: ShopDate; hours: HoursRange }[];
  closedDays?: Weekday[];
  closedDaysBeforeCC?: Weekday[];
  closedDaysAfterCC?: Weekday[];
  openSeasons?: string[];
  openIfRainOnly?: Weekday[];
  closedIfRain?: boolean;
  closesPermanentlyAfterCommunityCenter?: boolean;
  closedDates?: ShopDate[];
  festivalClosure?: 'all' | 'some' | 'none';
};

export type Shop = {
  id: string;
  name: LocalizedName;
  /** Undefined for shops with no fixed opening hours (Krobus, Casino, ...). */
  schedule?: ShopSchedule;
  /** What the player needs to reach the shop, in the locale it was built with. */
  access?: string;
  notes: { festival?: string; note?: string };
};

export type ShopStatus = {
  status: 'open' | 'closed' | 'always';
  hours: string[];
  reason?: MessageRef;
  notes: Translatable[];
};

const REASON_PERMANENT = message('labels.shopReason.permanent');
const REASON_SEASON = message('labels.shopReason.season');
const REASON_RAIN = message('labels.shopReason.rain');

const textIn = (value: unknown, locale: Locale): string | undefined => {
  if (!isRecord(value)) return undefined;
  const text = (key: string) =>
    typeof value[key] === 'string' ? (value[key] as string) : undefined;
  return localizedText({ en: text('en'), ptBr: text('ptBr') }, locale);
};

const toShop = (entity: GameEntityOut, locale: Locale): Shop[] => {
  const attrs = entity.attributes ?? {};
  const schedule = attrs['schedule'];
  const text = isRecord(attrs['scheduleText']) ? attrs['scheduleText'] : {};
  const festival = textIn(text['festival'], locale);
  const note = textIn(text['note'], locale);
  const access = textIn(attrs['access'], locale);
  return [
    {
      id: entity.id,
      name: entity.name,
      ...(isRecord(schedule) ? { schedule: schedule as ShopSchedule } : {}),
      ...(access ? { access } : {}),
      notes: {
        ...(festival ? { festival } : {}),
        ...(note ? { note } : {}),
      },
    },
  ];
};

export const buildShops = (entities: GameEntityOut[], locale: Locale): Shop[] =>
  entities.flatMap((entity) => toShop(entity, locale));

const clock = (time: string): string => {
  const [hour, minute] = time.split(' ')[0].split(':');
  return `${Number(hour)}:${minute}`;
};

export const formatHours = (range: HoursRange): string =>
  `${clock(range.open)}–${clock(range.close)}`;

const onDate = (list: ShopDate[] | undefined, today: GameDateIn): boolean =>
  (list ?? []).some((d) => d.season === today.season && d.day === today.day);

const scheduledHours = (
  schedule: ShopSchedule,
  weekday: Weekday,
  progress: ShopProgress,
): HoursRange[] => {
  const byWeekday = schedule.weekdayHours?.[weekday];
  if (byWeekday) return [byWeekday];
  if (progress.boatRepaired && schedule.hoursAfterBoatRepair)
    return [schedule.hoursAfterBoatRepair];
  if (progress.keyToTown && schedule.hoursWithKeyToTown)
    return schedule.hoursWithKeyToTown;
  return schedule.hours ? [schedule.hours] : [];
};

/** Weekdays on which the shop is closed regardless of rain, in Monday to Sunday order. */
export const fixedClosedDays = (
  schedule: ShopSchedule | undefined,
  progress: ShopProgress,
): Weekday[] => {
  if (!schedule) return [];
  const days = new Set<Weekday>([
    ...(schedule.closedDays ?? []),
    ...((progress.communityCenterRestored === true
      ? schedule.closedDaysAfterCC
      : schedule.closedDaysBeforeCC) ?? []),
    ...(schedule.openIfRainOnly ?? []),
  ]);
  return WEEKDAYS.filter((day) => days.has(day));
};

const closedReason = (
  shop: Shop & { schedule: ShopSchedule },
  today: GameDateIn,
  events: FixedEvent[],
  progress: ShopProgress,
): MessageRef | undefined => {
  const { schedule } = shop;
  const weekday = weekdayOf(today.day);
  if (
    schedule.closesPermanentlyAfterCommunityCenter &&
    progress.communityCenterRestored === true
  )
    return REASON_PERMANENT;
  if (schedule.openSeasons && !schedule.openSeasons.includes(today.season))
    return REASON_SEASON;
  if (schedule.festivalClosure === 'all' && shopsClosedBy(events, today))
    return message('labels.shopReason.festival');
  if (onDate(schedule.closedDates, today))
    return message('labels.shopReason.closedToday');
  if (schedule.closedIfRain && progress.rainToday) return REASON_RAIN;
  const closedDays = fixedClosedDays(schedule, progress).filter(
    (day) => !(progress.rainToday && schedule.openIfRainOnly?.includes(day)),
  );
  if (closedDays.includes(weekday))
    return message(
      weekday === 'sat' || weekday === 'sun'
        ? 'labels.shopReason.closesOnWeekend'
        : 'labels.shopReason.closesOnWeekday',
      { day: message(`labels.weekdayPlural.${weekday}`) },
    );
  return undefined;
};

export const shopStatusToday = (
  shop: Shop,
  today: GameDateIn,
  events: FixedEvent[],
  progress: ShopProgress,
): ShopStatus => {
  const { schedule } = shop;
  if (!schedule) return { status: 'always', hours: [], notes: [] };
  const weekday = weekdayOf(today.day);
  const notes: Translatable[] = [];
  if (!progress.rainToday) {
    if (schedule.closedIfRain)
      notes.push(message('labels.shopNote.closesIfRain'));
    if (schedule.openIfRainOnly?.includes(weekday))
      notes.push(message('labels.shopNote.opensIfRain'));
  }
  if (schedule.festivalClosure === 'some' && shop.notes.festival)
    notes.push(shop.notes.festival);

  const permanent =
    schedule.closesPermanentlyAfterCommunityCenter &&
    progress.communityCenterRestored === true;
  const override = permanent
    ? undefined
    : schedule.dateHours?.find(
        (d) => d.date.season === today.season && d.date.day === today.day,
      );
  const reason = override
    ? undefined
    : closedReason({ ...shop, schedule }, today, events, progress);
  if (reason) return { status: 'closed', hours: [], reason, notes };

  const ranges = override
    ? [override.hours]
    : scheduledHours(schedule, weekday, progress);
  return { status: 'open', hours: ranges.map(formatHours), notes };
};

export const closedToday = (
  shops: Shop[],
  today: GameDateIn,
  events: FixedEvent[],
  progress: ShopProgress,
): Shop[] =>
  shops.filter((shop) => {
    const { status, reason } = shopStatusToday(shop, today, events, progress);
    return (
      status === 'closed' &&
      reason?.key !== REASON_SEASON.key &&
      reason?.key !== REASON_PERMANENT.key
    );
  });
