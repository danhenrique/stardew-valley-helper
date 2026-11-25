import type {
  GameDateIn,
  GameEntityOut,
  PlantableOut,
  Season,
} from '../generated/stardew-valley-api/types.gen';
import { localizedName, SEASONS } from './i18n';
import { LOCALES } from './locale';

export type EventKind = 'festival' | 'birthday' | 'cropDeadline' | 'foraging';

export const EVENT_KINDS: readonly EventKind[] = [
  'festival',
  'birthday',
  'cropDeadline',
  'foraging',
];

export type LocalizedName = GameEntityOut['name'];

export type FixedEvent = {
  id: string;
  kind: EventKind;
  refId: string;
  season: Season;
  day: number;
  endDay?: number;
  /** Festivals only: shops close while it runs; omitted when the data does not say. */
  shopsClosed?: boolean;
  /** Birthdays only; omitted when the data does not say. */
  marriageable?: boolean;
  /** Foraging only: id of the forageable item; omitted when the data does not say. */
  item?: string;
  name: LocalizedName;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asSeason = (value: unknown): Season | undefined =>
  SEASONS.find((s) => s === value);

const asDay = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1
    ? value
    : undefined;

const rangeEvent = (
  kind: 'festival' | 'foraging',
  entity: GameEntityOut,
): FixedEvent[] => {
  const attrs = entity.attributes ?? {};
  const season = asSeason(attrs['season']);
  const day = asDay(attrs['startDay']);
  if (!season || day === undefined) return [];
  const endDay = asDay(attrs['endDay']);
  const item = attrs['item'];
  const shopsClosed = attrs['shopsClosed'];
  return [
    {
      id: `${kind}:${entity.id}`,
      kind,
      refId: entity.id,
      season,
      day,
      ...(endDay !== undefined && endDay > day ? { endDay } : {}),
      ...(kind === 'festival' && typeof shopsClosed === 'boolean'
        ? { shopsClosed }
        : {}),
      ...(kind === 'foraging' && typeof item === 'string' && item
        ? { item }
        : {}),
      name: entity.name,
    },
  ];
};

const birthdayEvent = (entity: GameEntityOut): FixedEvent[] => {
  const birthday = entity.attributes?.['birthday'];
  if (!isRecord(birthday)) return [];
  const season = asSeason(birthday['season']);
  const day = asDay(birthday['day']);
  if (!season || day === undefined) return [];
  const marriageable = entity.attributes?.['marriageable'];
  return [
    {
      id: `birthday:${entity.id}`,
      kind: 'birthday',
      refId: entity.id,
      season,
      day,
      ...(typeof marriageable === 'boolean' ? { marriageable } : {}),
      name: entity.name,
    },
  ];
};

const deadlineEvents = (plantable: PlantableOut): FixedEvent[] => {
  const day = plantable.lastPlantingDay;
  if (plantable.kind !== 'crop' || day == null) return [];
  return plantable.seasons.map((season) => ({
    id: `cropDeadline:${plantable.id}:${season}`,
    kind: 'cropDeadline' as const,
    refId: plantable.id,
    season,
    day,
    name: plantable.name,
  }));
};

export const buildEvents = (input: {
  festivals: GameEntityOut[];
  villagers: GameEntityOut[];
  foraging: GameEntityOut[];
  plantables: PlantableOut[];
}): FixedEvent[] => [
  ...input.festivals.flatMap((e) => rangeEvent('festival', e)),
  ...input.villagers.flatMap(birthdayEvent),
  ...input.foraging.flatMap((e) => rangeEvent('foraging', e)),
  ...input.plantables.flatMap(deadlineEvents),
];

export const eventsOn = (
  events: FixedEvent[],
  season: Season,
  day: number,
): FixedEvent[] =>
  events.filter(
    (e) => e.season === season && e.day <= day && day <= (e.endDay ?? e.day),
  );

/** True when a festival that closes the shops covers the date. */
export const shopsClosedBy = (
  events: FixedEvent[],
  date: GameDateIn,
): boolean =>
  eventsOn(events, date.season, date.day).some(
    (e) => e.kind === 'festival' && e.shopsClosed === true,
  );

/** The Night Market runs on winter 15 to 17. */
export const isNightMarket = (date: GameDateIn): boolean =>
  date.season === 'winter' && date.day >= 15 && date.day <= 17;

export const eventsInSeason = (
  events: FixedEvent[],
  season: Season,
): FixedEvent[] =>
  events.filter((e) => e.season === season).sort((a, b) => a.day - b.day);

/** Kinds shown on the home page ("Today" and "Upcoming events"); crop deadlines stay in the calendar. */
export const DAY_EVENT_KINDS: readonly EventKind[] = [
  'festival',
  'birthday',
  'foraging',
];

/** Order of events on the same day: festivals first, then foraging, then birthdays. */
export const EVENT_KIND_ORDER: Record<EventKind, number> = {
  festival: 0,
  foraging: 1,
  birthday: 2,
  cropDeadline: 3,
};

const byDayThenKind = (a: FixedEvent, b: FixedEvent) =>
  a.day - b.day || EVENT_KIND_ORDER[a.kind] - EVENT_KIND_ORDER[b.kind];

const dayEvents = (events: FixedEvent[]) =>
  events.filter((e) => DAY_EVENT_KINDS.includes(e.kind));

/** Home-page events happening today, including multi-day events that started earlier. */
export const eventsToday = (
  events: FixedEvent[],
  today: GameDateIn,
): FixedEvent[] =>
  eventsOn(dayEvents(events), today.season, today.day).sort(
    (a, b) => EVENT_KIND_ORDER[a.kind] - EVENT_KIND_ORDER[b.kind],
  );

/** Home-page events that start after today, until the end of the season. */
export const eventsAfterToday = (
  events: FixedEvent[],
  today: GameDateIn,
): FixedEvent[] =>
  dayEvents(events)
    .filter((e) => e.season === today.season && e.day > today.day)
    .sort(byDayThenKind);

/** Data id whose sprite stands for the event: the villager, festival, seed or foraged item. */
export const eventIconId = (event: FixedEvent): string =>
  event.kind === 'foraging' ? (event.item ?? event.refId) : event.refId;

export const findEvent = (
  events: FixedEvent[],
  id: string,
): FixedEvent | undefined => events.find((e) => e.id === id);

/** Lowercase text without accents, for case- and accent-insensitive matching. */
export const normalizeText = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Events of the given kind (any when undefined) whose name contains the query. */
export const filterEvents = (
  events: FixedEvent[],
  filters: { kind?: EventKind; query?: string },
): FixedEvent[] => {
  const query = normalizeText(filters.query?.trim() ?? '');
  return events.filter(
    (e) =>
      (!filters.kind || e.kind === filters.kind) &&
      (!query ||
        LOCALES.some((locale) =>
          normalizeText(localizedName(e.name, locale)).includes(query),
        )),
  );
};
