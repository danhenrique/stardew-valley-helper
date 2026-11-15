import type {
  GameDateIn,
  GameEntityOut,
} from '../generated/stardew-valley-api/types.gen';
import {
  type FixedEvent,
  isNightMarket,
  type LocalizedName,
  shopsClosedBy,
} from './events';
import { type Weekday, weekdayOf } from './gameDate';

export type Reminder = {
  id: string;
  name: LocalizedName;
  detail: LocalizedName;
  trigger: { kind: 'weekly'; weekdays: Weekday[] } | { kind: 'seasonStart' };
  nightMarketDaily: boolean;
  suppressOnFestival: boolean;
  order: number;
};

const WEEKDAY_IDS: readonly Weekday[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asWeekday = (value: unknown): Weekday | undefined =>
  WEEKDAY_IDS.find((w) => w === value);

const asTrigger = (value: unknown): Reminder['trigger'] | undefined => {
  if (!isRecord(value)) return undefined;
  if (value['kind'] === 'seasonStart') return { kind: 'seasonStart' };
  if (value['kind'] !== 'weekly' || !Array.isArray(value['weekdays']))
    return undefined;
  const weekdays = value['weekdays'].map(asWeekday);
  if (weekdays.length === 0 || weekdays.some((w) => w === undefined))
    return undefined;
  return { kind: 'weekly', weekdays: weekdays as Weekday[] };
};

const asText = (value: unknown): LocalizedName =>
  isRecord(value) ? (value as LocalizedName) : undefined;

const toReminder = (entity: GameEntityOut): Reminder[] => {
  const attrs = entity.attributes ?? {};
  const trigger = asTrigger(attrs['trigger']);
  if (!trigger) return [];
  const order = attrs['order'];
  return [
    {
      id: entity.id,
      name: entity.name,
      detail: asText(attrs['detail']),
      trigger,
      nightMarketDaily: attrs['nightMarketDaily'] === true,
      suppressOnFestival: attrs['suppressOnFestival'] === true,
      order: typeof order === 'number' ? order : Number.MAX_SAFE_INTEGER,
    },
  ];
};

export const buildReminders = (entities: GameEntityOut[]): Reminder[] =>
  entities.flatMap(toReminder).sort((a, b) => a.order - b.order);

const appliesOn = (reminder: Reminder, today: GameDateIn): boolean => {
  if (reminder.trigger.kind === 'seasonStart') return today.day === 1;
  return (
    reminder.trigger.weekdays.includes(weekdayOf(today.day)) ||
    (reminder.nightMarketDaily && isNightMarket(today))
  );
};

export const remindersToday = (
  reminders: Reminder[],
  events: FixedEvent[],
  today: GameDateIn,
): Reminder[] => {
  const closed = shopsClosedBy(events, today);
  return reminders.filter(
    (r) => appliesOn(r, today) && !(r.suppressOnFestival && closed),
  );
};
