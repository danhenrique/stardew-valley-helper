import type { GameEntityOut } from '../generated/stardew-valley-api/types.gen';
import type { FixedEvent } from './events';
import { buildReminders, remindersToday } from './reminders';

const entity = (
  id: string,
  attributes: Record<string, unknown>,
): GameEntityOut => ({
  type: 'lembretes',
  id,
  name: { en: id, ptBr: id },
  attributes: { detail: { en: 'd', ptBr: 'd' }, order: 1, ...attributes },
});

const cart = entity('test-cart', {
  trigger: { kind: 'weekly', weekdays: ['fri', 'sun'] },
  nightMarketDaily: true,
  suppressOnFestival: true,
});
const start = entity('test-start', { trigger: { kind: 'seasonStart' } });

const day = (season: 'spring' | 'winter', d: number) => ({
  year: 1,
  season,
  day: d,
});
const ids = (list: { id: string }[]) => list.map((r) => r.id);

describe('reminders', () => {
  it('should drop reminders without a valid trigger and sort by order', () => {
    const reminders = buildReminders([
      entity('b', { order: 2, trigger: { kind: 'seasonStart' } }),
      entity('bad', { trigger: { kind: 'weekly', weekdays: ['xyz'] } }),
      entity('none', {}),
      entity('a', { order: 1, trigger: { kind: 'seasonStart' } }),
    ]);
    expect(ids(reminders)).toEqual(['a', 'b']);
    expect(reminders[0]).toMatchObject({
      nightMarketDaily: false,
      suppressOnFestival: false,
      detail: { en: 'd', ptBr: 'd' },
    });
  });

  it('should list weekly reminders on their weekdays', () => {
    const reminders = buildReminders([cart]);
    const on = (d: number) =>
      ids(remindersToday(reminders, [], day('spring', d)));
    expect([on(5), on(6), on(7)]).toEqual([['test-cart'], [], ['test-cart']]);
  });

  it('should list the cart every day of the Night Market', () => {
    const reminders = buildReminders([cart]);
    expect(ids(remindersToday(reminders, [], day('winter', 16)))).toEqual([
      'test-cart',
    ]);
  });

  it('should list season-start reminders on day 1 only', () => {
    const reminders = buildReminders([start]);
    expect(ids(remindersToday(reminders, [], day('spring', 1)))).toEqual([
      'test-start',
    ]);
    expect(ids(remindersToday(reminders, [], day('spring', 8)))).toEqual([]);
  });

  it('should drop suppressOnFestival reminders while a shopsClosed festival covers today', () => {
    const festival: FixedEvent = {
      id: 'festival:f',
      kind: 'festival',
      refId: 'f',
      season: 'spring',
      day: 5,
      shopsClosed: true,
      name: { en: 'F', ptBr: 'F' },
    };
    const reminders = buildReminders([cart]);
    expect(remindersToday(reminders, [festival], day('spring', 5))).toEqual([]);
  });

  it('should drop suppressOnFestival reminders on the second day of a multi-day shopsClosed festival', () => {
    const festival: FixedEvent = {
      id: 'festival:multi',
      kind: 'festival',
      refId: 'multi',
      season: 'spring',
      day: 4,
      endDay: 5,
      shopsClosed: true,
      name: { en: 'F', ptBr: 'F' },
    };
    const reminders = buildReminders([cart]);
    expect(remindersToday(reminders, [festival], day('spring', 5))).toEqual([]);
    expect(ids(remindersToday(reminders, [], day('spring', 5)))).toEqual([
      'test-cart',
    ]);
  });
});
