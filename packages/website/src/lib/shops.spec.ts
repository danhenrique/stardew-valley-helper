import type { GameEntityOut } from '../generated/stardew-valley-api/types.gen';
import type { FixedEvent } from './events';
import {
  buildShops,
  closedToday,
  fixedClosedDays,
  formatHours,
  type ShopProgress,
  shopStatusToday,
} from './shops';

const text = (s: string) => ({ en: s, ptBr: s });
const entity = (
  id: string,
  schedule?: Record<string, unknown>,
  scheduleText: Record<string, unknown> = {},
): GameEntityOut => ({
  type: 'lojas',
  id,
  name: text(id),
  attributes: schedule ? { schedule, scheduleText } : {},
});

const shopOf = (e: GameEntityOut) => buildShops([e])[0];
const pierre = shopOf(
  entity(
    'test-pierre',
    {
      hours: { open: '09:00', close: '17:00' },
      hoursWithKeyToTown: [
        { open: '06:00', close: '07:00' },
        { open: '08:30', close: '17:00' },
      ],
      closedDaysBeforeCC: ['wed'],
      closedDaysAfterCC: [],
      festivalClosure: 'all',
    },
    { festival: text('Fechado (exceto festivais de exceção)') },
  ),
);
const clinic = shopOf(
  entity('test-clinic', {
    hours: { open: '09:00', close: '12:00' },
    closedDays: ['sat'],
    festivalClosure: 'all',
    weekdayHours: {
      tue: { open: '09:00', close: '14:00' },
      thu: { open: '09:00', close: '14:00' },
    },
  }),
);
const fish = shopOf(
  entity('test-fish', {
    hours: { open: '09:00', close: '17:00' },
    hoursAfterBoatRepair: { open: '08:00', close: '17:00' },
    closedDays: ['sat'],
    openIfRainOnly: ['sat'],
    festivalClosure: 'all',
    dateHours: [
      {
        date: { season: 'spring', day: 9 },
        hours: { open: '09:00', close: '10:00' },
      },
    ],
  }),
);
const ranch = shopOf(
  entity('test-ranch', {
    hours: { open: '09:00', close: '16:00' },
    closedDays: ['mon', 'tue'],
    festivalClosure: 'all',
    closedDates: [
      { season: 'fall', day: 18 },
      { season: 'winter', day: 18 },
    ],
  }),
);
const iceCream = shopOf(
  entity('test-ice', {
    hours: { open: '13:00', close: '17:00' },
    closedDays: ['wed'],
    openSeasons: ['summer'],
    festivalClosure: 'none',
    closedIfRain: true,
  }),
);
const joja = shopOf(
  entity('test-joja', {
    hours: { open: '09:00', close: '23:00' },
    hoursWithKeyToTown: [{ open: '06:00', close: '02:00 (+1d)' }],
    closedDays: [],
    festivalClosure: 'all',
    closesPermanentlyAfterCommunityCenter: true,
  }),
);
const cart = shopOf(
  entity('test-cart', {
    hours: { open: '06:00', close: '20:00' },
    closedDays: ['mon', 'tue', 'wed', 'thu', 'sat'],
    festivalClosure: 'none',
    dateHours: [
      {
        date: { season: 'winter', day: 16 },
        hours: { open: '17:00', close: '02:00 (+1d)' },
      },
    ],
  }),
);

const date = (season: 'spring' | 'summer' | 'fall' | 'winter', d: number) => ({
  year: 1,
  season,
  day: d,
});
const festival = (
  season: 'spring' | 'winter',
  day: number,
  shopsClosed: boolean,
): FixedEvent => ({
  id: 'festival:test-fest',
  kind: 'festival',
  refId: 'test-fest',
  season,
  day,
  shopsClosed,
  name: text('test-fest'),
});
const none: ShopProgress = {};

describe('shops', () => {
  it('should keep shops without schedule and keep data order', () => {
    const shops = buildShops([
      entity('test-b', { hours: { open: '09:00', close: '17:00' } }),
      entity('test-casino'),
      entity('test-a', { hours: { open: '09:00', close: '17:00' } }),
    ]);
    expect(shops.map((s) => s.id)).toEqual(['test-b', 'test-casino', 'test-a']);
  });

  it('should read the access requirement of a shop', () => {
    const krobus = shopOf({
      type: 'lojas',
      id: 'test-krobus',
      name: text('test-krobus'),
      attributes: {
        access: { en: 'Requires the Rusty Key', ptBr: 'Requer Chave Enferrujada' },
      },
    });
    expect(krobus.schedule).toBeUndefined();
    expect(krobus.access).toBe('Requer Chave Enferrujada');
  });

  it('should mark a shop without schedule as always available', () => {
    const casino = shopOf(entity('test-casino'));
    expect(shopStatusToday(casino, date('spring', 3), [], none)).toEqual({
      status: 'always',
      hours: [],
      notes: [],
    });
    expect(fixedClosedDays(casino.schedule, none)).toEqual([]);
    expect(closedToday([casino], date('spring', 3), [], none)).toEqual([]);
  });

  it('should close Pierre on Wednesdays until the Community Center is restored', () => {
    expect(shopStatusToday(pierre, date('spring', 3), [], none)).toMatchObject({
      status: 'closed',
      reason: 'Fecha às quartas',
    });
    expect(
      shopStatusToday(pierre, date('spring', 3), [], {
        communityCenterRestored: true,
      }),
    ).toMatchObject({ status: 'open', hours: ['9:00–17:00'] });
  });

  it('should use the Key to the Town hours', () => {
    expect(
      shopStatusToday(pierre, date('spring', 4), [], { keyToTown: true }).hours,
    ).toEqual(['6:00–7:00', '8:30–17:00']);
  });

  it('should open the fish shop at 8:00 after the boat is repaired', () => {
    expect(
      shopStatusToday(fish, date('spring', 4), [], { boatRepaired: true })
        .hours,
    ).toEqual(['8:00–17:00']);
  });

  it('should prefer weekday hours', () => {
    expect(shopStatusToday(clinic, date('spring', 2), [], none).hours).toEqual([
      '9:00–14:00',
    ]);
    expect(shopStatusToday(clinic, date('spring', 1), [], none).hours).toEqual([
      '9:00–12:00',
    ]);
  });

  it('should close shops on a shopsClosed festival only when festivalClosure is all', () => {
    const events = [festival('spring', 13, true)];
    expect(
      shopStatusToday(clinic, date('spring', 13), events, none),
    ).toMatchObject({ status: 'closed', reason: 'Festival' });
    expect(
      shopStatusToday(iceCream, date('spring', 13), events, none).reason,
    ).toBe('Fora de temporada');
    const summerEvents = [
      { ...festival('spring', 13, true), season: 'summer' as const },
    ];
    expect(
      shopStatusToday(iceCream, date('summer', 13), summerEvents, none).status,
    ).toBe('open');
    const some = shopOf(
      entity(
        'test-some',
        { hours: { open: '09:00', close: '17:00' }, festivalClosure: 'some' },
        { festival: text('Fecha em alguns festivais') },
      ),
    );
    expect(
      shopStatusToday(some, date('spring', 13), events, none),
    ).toMatchObject({ status: 'open', notes: ['Fecha em alguns festivais'] });
  });

  it('should close on closedDates', () => {
    expect(shopStatusToday(ranch, date('fall', 18), [], none)).toMatchObject({
      status: 'closed',
      reason: 'Fechada hoje',
    });
  });

  it('should be out of season outside openSeasons and closed on rain notes', () => {
    expect(
      shopStatusToday(iceCream, date('spring', 4), [], none),
    ).toMatchObject({ status: 'closed', reason: 'Fora de temporada' });
    expect(
      shopStatusToday(iceCream, date('summer', 4), [], none),
    ).toMatchObject({ status: 'open', notes: ['Fecha se chover'] });
  });

  it('should close the fish shop on Saturdays with the rain note', () => {
    expect(shopStatusToday(fish, date('spring', 6), [], none)).toMatchObject({
      status: 'closed',
      reason: 'Fecha aos sábados',
      notes: ['Abre se chover'],
    });
  });

  it('should close a closedIfRain shop when it rains', () => {
    expect(
      shopStatusToday(iceCream, date('summer', 4), [], { rainToday: true }),
    ).toEqual({ status: 'closed', hours: [], reason: 'Chuva', notes: [] });
  });

  it('should open an openIfRainOnly shop on that weekday when it rains', () => {
    expect(
      shopStatusToday(fish, date('spring', 6), [], { rainToday: true }),
    ).toMatchObject({ status: 'open', notes: [] });
  });

  it('should keep the openIfRainOnly weekday in the fixed closed days when it rains', () => {
    expect(fixedClosedDays(fish.schedule, { rainToday: true })).toContain(
      'sat',
    );
  });

  it('should say aos for Sundays', () => {
    const sunday = shopOf(
      entity('test-sun', {
        hours: { open: '09:00', close: '17:00' },
        closedDays: ['sun'],
      }),
    );
    expect(shopStatusToday(sunday, date('spring', 7), [], none).reason).toBe(
      'Fecha aos domingos',
    );
  });

  it('should close Joja permanently after the Community Center', () => {
    expect(
      shopStatusToday(joja, date('spring', 4), [], {
        communityCenterRestored: true,
      }),
    ).toMatchObject({ status: 'closed', reason: 'Fechada definitivamente' });
    expect(shopStatusToday(joja, date('spring', 4), [], none).status).toBe(
      'open',
    );
  });

  it('should apply the priority order', () => {
    expect(
      shopStatusToday(
        joja,
        date('spring', 13),
        [festival('spring', 13, true)],
        {
          communityCenterRestored: true,
        },
      ).reason,
    ).toBe('Fechada definitivamente');
  });

  it('should open the Traveling Cart at the Night Market on a weekday', () => {
    expect(shopStatusToday(cart, date('winter', 16), [], none)).toMatchObject({
      status: 'open',
      hours: ['17:00–2:00'],
    });
    expect(shopStatusToday(cart, date('winter', 15), [], none).status).toBe(
      'closed',
    );
  });

  it('should open at the dateHours override even on a closed date', () => {
    expect(shopStatusToday(fish, date('spring', 9), [], none).hours).toEqual([
      '9:00–10:00',
    ]);
  });

  it('should format hours past midnight', () => {
    expect(formatHours({ open: '12:00', close: '00:00 (+1d)' })).toBe(
      '12:00–0:00',
    );
  });

  it('should leave out-of-season and permanently closed shops from closedToday', () => {
    const shops = [pierre, iceCream, joja, ranch];
    const result = closedToday(shops, date('fall', 18), [], {
      communityCenterRestored: true,
    });
    expect(result.map((s) => s.id)).toEqual(['test-ranch']);
  });

  it('should list the fixed closed weekdays with the Community Center progress', () => {
    const smith = shopOf(
      entity('test-smith', { closedDaysAfterCC: ['fri'], closedDays: ['mon'] }),
    );
    expect(
      fixedClosedDays(smith.schedule, { communityCenterRestored: true }),
    ).toEqual(['mon', 'fri']);
    expect(fixedClosedDays(smith.schedule, {})).toEqual(['mon']);
    const fishShop = shopOf(
      entity('test-fish-shop', {
        closedDays: ['sat'],
        openIfRainOnly: ['sat'],
      }),
    );
    expect(fixedClosedDays(fishShop.schedule, {})).toEqual(['sat']);
  });
});
