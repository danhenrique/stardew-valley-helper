import type {
  GameEntityOut,
  PlantableOut,
} from '../generated/stardew-valley-api/types.gen';
import {
  buildEvents,
  eventIconId,
  eventsAfterToday,
  eventsInSeason,
  eventsOn,
  eventsToday,
  type FixedEvent,
  findEvent,
  isNightMarket,
  shopsClosedBy,
} from './events';

const festival: GameEntityOut = {
  type: 'festivais',
  id: 'test-festival',
  name: { en: 'Test Festival', ptBr: 'Festival Teste' },
  attributes: { season: 'spring', startDay: 9, endDay: 10 },
};
const villager: GameEntityOut = {
  type: 'personagens',
  id: 'test-villager',
  name: { en: 'Test Villager' },
  attributes: { birthday: { season: 'fall', day: 13 }, marriageable: true },
};
const foraging: GameEntityOut = {
  type: 'eventos-coleta',
  id: 'test-foraging',
  name: { en: 'Test Foraging' },
  attributes: { season: 'fall', startDay: 8, endDay: 11 },
};
const crop: PlantableOut = {
  id: 'test-berry-seeds',
  name: { en: 'Test Berry Seeds' },
  kind: 'crop',
  seasons: ['spring', 'summer'],
  lastPlantingDay: 20,
};
const sapling: PlantableOut = {
  id: 'test-sapling',
  kind: 'fruit_tree',
  seasons: ['spring'],
  lastPlantingDay: 20,
};

const build = (over: Partial<Parameters<typeof buildEvents>[0]> = {}) =>
  buildEvents({
    festivals: [festival],
    villagers: [villager],
    foraging: [foraging],
    plantables: [crop, sapling],
    ...over,
  });

describe('events', () => {
  it('should build events with unique ids in the documented format', () => {
    const ids = build().map((e) => e.id);
    expect(ids.sort()).toEqual(
      [
        'festival:test-festival',
        'birthday:test-villager',
        'foraging:test-foraging',
        'cropDeadline:test-berry-seeds:spring',
        'cropDeadline:test-berry-seeds:summer',
      ].sort(),
    );
  });

  it('should carry marriageable only when the villager data has it', () => {
    expect(findEvent(build(), 'birthday:test-villager')?.marriageable).toBe(
      true,
    );
    const without = {
      ...villager,
      id: 'test-no-flag',
      attributes: { birthday: { season: 'fall', day: 2 } },
    };
    expect(
      findEvent(build({ villagers: [without] }), 'birthday:test-no-flag'),
    ).not.toHaveProperty('marriageable');
  });

  it('should carry the foraging item only when the data has it', () => {
    const withItem = {
      ...foraging,
      attributes: { ...foraging.attributes, item: 'test-wild-herb' },
    };
    expect(
      findEvent(build({ foraging: [withItem] }), 'foraging:test-foraging')
        ?.item,
    ).toBe('test-wild-herb');
    expect(findEvent(build(), 'foraging:test-foraging')).not.toHaveProperty(
      'item',
    );
  });

  it('should place the villager on the birthday date', () => {
    const e = findEvent(build(), 'birthday:test-villager');
    expect(e).toMatchObject({ kind: 'birthday', season: 'fall', day: 13 });
  });

  it('should yield one crop deadline per season using the seed name', () => {
    const list = build().filter((e) => e.kind === 'cropDeadline');
    expect(list.map((e) => e.season)).toEqual(['spring', 'summer']);
    expect(list[0]).toMatchObject({ day: 20, refId: 'test-berry-seeds' });
    expect(list[0].name).toEqual({ en: 'Test Berry Seeds' });
  });

  it('should return a multi-day festival on its last day only', () => {
    const events = build();
    expect(eventsOn(events, 'spring', 10).map((e) => e.id)).toContain(
      'festival:test-festival',
    );
    expect(eventsOn(events, 'spring', 11).map((e) => e.id)).not.toContain(
      'festival:test-festival',
    );
  });

  it('should ignore a villager without birthday', () => {
    const none = { ...villager, attributes: { marriageable: true } };
    expect(
      build({ villagers: [none] }).some((e) => e.kind === 'birthday'),
    ).toBe(false);
  });

  it('should ignore entities with missing season or day', () => {
    const bad = { ...festival, attributes: { season: 'spring' } };
    expect(build({ festivals: [bad] }).some((e) => e.kind === 'festival')).toBe(
      false,
    );
  });

  it('should skip crop deadline for null, undefined and fruit trees', () => {
    const events = build({
      plantables: [
        { ...crop, lastPlantingDay: null },
        { ...crop, id: 'test-other', lastPlantingDay: undefined },
        sapling,
      ],
    });
    expect(events.some((e) => e.kind === 'cropDeadline')).toBe(false);
  });

  it('should sort events in a season by day', () => {
    const days = eventsInSeason(build(), 'fall').map((e) => e.day);
    expect(days).toEqual([8, 13]);
  });

  it('should keep a day-28 event and drop other seasons when listing after today', () => {
    const late: GameEntityOut = {
      ...festival,
      id: 'test-late',
      attributes: { season: 'spring', startDay: 28 },
    };
    const events = build({ festivals: [festival, late] });
    const ids = eventsAfterToday(events, {
      year: 1,
      season: 'spring',
      day: 27,
    }).map((e) => e.id);
    expect(ids).toEqual(['festival:test-late']);
  });

  it('should leave out events of today, ongoing ones and crop deadlines when listing after today', () => {
    const today = { year: 1, season: 'spring', day: 9 } as const;
    expect(eventsAfterToday(build(), today)).toEqual([]);
    expect(
      eventsAfterToday(build(), { ...today, day: 8 }).map((e) => e.id),
    ).toEqual(['festival:test-festival']);
  });

  it('should list today a multi-day event on its first, middle and last day only', () => {
    const on = (day: number) =>
      eventsToday(build(), { year: 1, season: 'fall', day }).map((e) => e.id);
    expect(on(7)).toEqual([]);
    expect(on(8)).toEqual(['foraging:test-foraging']);
    expect(on(10)).toEqual(['foraging:test-foraging']);
    expect(on(11)).toEqual(['foraging:test-foraging']);
    expect(on(12)).toEqual([]);
  });

  it('should list today only festivals, foraging and birthdays of the same season', () => {
    const ids = eventsToday(build(), {
      year: 1,
      season: 'spring',
      day: 20,
    }).map((e) => e.id);
    expect(ids).not.toContain('cropDeadline:test-berry-seeds:spring');
    expect(eventsToday(build(), { year: 1, season: 'summer', day: 9 })).toEqual(
      [],
    );
  });

  it('should order events of the same day as festival, foraging, birthday', () => {
    const event = (kind: FixedEvent['kind']): FixedEvent => ({
      id: `${kind}:x`,
      kind,
      refId: 'x',
      season: 'spring',
      day: 3,
      name: { en: kind },
    });
    const events = [event('birthday'), event('foraging'), event('festival')];
    const today = { year: 1, season: 'spring', day: 3 } as const;
    expect(eventsToday(events, today).map((e) => e.kind)).toEqual([
      'festival',
      'foraging',
      'birthday',
    ]);
    expect(
      eventsAfterToday(events, { ...today, day: 2 }).map((e) => e.kind),
    ).toEqual(['festival', 'foraging', 'birthday']);
  });

  it('should return undefined for an unknown id', () => {
    expect(findEvent(build(), 'festival:unknown')).toBeUndefined();
  });
});

describe('shopsClosed', () => {
  const closed: GameEntityOut = {
    ...festival,
    attributes: { ...festival.attributes, shopsClosed: true },
  };
  const build = (festivals: GameEntityOut[]) =>
    buildEvents({ festivals, villagers: [], foraging: [], plantables: [] });

  it('should carry shopsClosed only for festivals whose data has it', () => {
    expect(build([closed])[0].shopsClosed).toBe(true);
    expect(build([festival])[0].shopsClosed).toBeUndefined();
  });

  it('should close shops on every day a shopsClosed festival covers', () => {
    const events = build([closed]);
    const on = (day: number) =>
      shopsClosedBy(events, { year: 1, season: 'spring', day });
    expect([on(9), on(10), on(11)]).toEqual([true, true, false]);
  });

  it('should flag the Night Market on winter 15 to 17 only', () => {
    const on = (season: 'spring' | 'winter', day: number) =>
      isNightMarket({ year: 1, season, day });
    expect([
      on('winter', 14),
      on('winter', 15),
      on('winter', 17),
      on('winter', 18),
      on('spring', 15),
    ]).toEqual([false, true, true, false, false]);
  });
});

describe('eventIconId', () => {
  const base: FixedEvent = {
    id: 'birthday:abigail',
    kind: 'birthday',
    refId: 'abigail',
    season: 'fall',
    day: 13,
    name: { en: 'Abigail', ptBr: 'Abigail' },
  };

  it.each([
    ['birthday', {}, 'abigail'],
    ['festival', { refId: 'egg-festival' }, 'egg-festival'],
    ['cropDeadline', { refId: 'parsnip-seeds' }, 'parsnip-seeds'],
    [
      'foraging',
      { refId: 'salmonberry-season', item: 'salmonberry' },
      'salmonberry',
    ],
    ['foraging', { refId: 'salmonberry-season' }, 'salmonberry-season'],
  ] as const)(
    'should return the icon id when the event is a %s',
    (kind, extra, expected) => {
      expect(eventIconId({ ...base, kind, ...extra })).toBe(expected);
    },
  );
});
