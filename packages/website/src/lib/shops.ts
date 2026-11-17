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
import { WEEKDAY_NAMES } from './i18n';

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
  /** What the player needs to reach the shop, in pt-BR. */
  access?: string;
  notes: { festival?: string; note?: string };
};

export type ShopStatus = {
  status: 'open' | 'closed' | 'always';
  hours: string[];
  reason?: string;
  notes: string[];
};

const REASON_PERMANENT = 'Fechada definitivamente';
const REASON_SEASON = 'Fora de temporada';
const REASON_RAIN = 'Chuva';

const ptBrText = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const text = value['ptBr'] ?? value['en'];
  return typeof text === 'string' && text ? text : undefined;
};

const toShop = (entity: GameEntityOut): Shop[] => {
  const attrs = entity.attributes ?? {};
  const schedule = attrs['schedule'];
  const text = isRecord(attrs['scheduleText']) ? attrs['scheduleText'] : {};
  const festival = ptBrText(text['festival']);
  const note = ptBrText(text['note']);
  const access = ptBrText(attrs['access']);
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

export const buildShops = (entities: GameEntityOut[]): Shop[] =>
  entities.flatMap(toShop);

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
): string | undefined => {
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
    return 'Festival';
  if (onDate(schedule.closedDates, today)) return 'Fechada hoje';
  if (schedule.closedIfRain && progress.rainToday) return REASON_RAIN;
  const closedDays = fixedClosedDays(schedule, progress).filter(
    (day) => !(progress.rainToday && schedule.openIfRainOnly?.includes(day)),
  );
  if (closedDays.includes(weekday))
    return `Fecha ${weekday === 'sat' || weekday === 'sun' ? 'aos' : 'às'} ${WEEKDAY_NAMES[weekday]}`;
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
  const notes: string[] = [];
  if (!progress.rainToday) {
    if (schedule.closedIfRain) notes.push('Fecha se chover');
    if (schedule.openIfRainOnly?.includes(weekday))
      notes.push('Abre se chover');
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
      reason !== REASON_SEASON &&
      reason !== REASON_PERMANENT
    );
  });
