import type {
  PlantableOut,
  SeedValueOut,
} from '../generated/stardew-valley-api/types.gen';
import {
  bestDestination,
  buildSeedRows,
  DEFAULT_SEED_PREFS,
  formatGoldPerDay,
  formatGoldPerHarvest,
  formatGoldTotal,
  loadSeedPrefs,
  saveSeedPrefs,
} from './seedValues';
import { textOf } from './messageText.spec-helpers';

const crop = (id: string, ptBr: string): PlantableOut => ({
  id,
  name: { en: id, ptBr },
  kind: 'crop',
  seasons: ['spring'],
  growthDays: 4,
});

const value = (
  id: string,
  goldTotal: number | null,
  goldPerDayTenths: number | null,
  willNotMature = false,
): SeedValueOut => ({
  id,
  harvests: willNotMature ? 0 : 4,
  days: 28,
  goldTotal,
  goldPerDayTenths,
  willNotMature,
  approximate: false,
});

const PLANTABLES = [
  crop('wheat', 'Trigo'),
  crop('kale', 'Couve'),
  crop('melon', 'Melão'),
  crop('corn', 'Milho'),
  crop('tulip', 'Tulipa'),
  { ...crop('apple', 'Muda de Maçã'), kind: 'fruit_tree' as const },
];

const VALUES = [
  value('wheat', 300, 107),
  value('kale', 440, 157),
  value('melon', 500, 120),
  value('corn', 0, 0, true),
  value('tulip', null, null),
];

const ids = (rows: { plantable: PlantableOut }[]) =>
  rows.map((row) => row.plantable.id);

describe('buildSeedRows', () => {
  it('should put valued seeds first by gold per day, then not mature, then without value when sorting by gold per day', () => {
    expect(
      ids(buildSeedRows(PLANTABLES, VALUES, 'goldPerDay', 'pt-BR')),
    ).toEqual(['kale', 'melon', 'wheat', 'corn', 'apple', 'tulip']);
  });

  it('should order valued seeds by gold total when sorting by gold total', () => {
    expect(
      ids(buildSeedRows(PLANTABLES, VALUES, 'goldTotal', 'pt-BR')).slice(0, 3),
    ).toEqual(['melon', 'kale', 'wheat']);
  });

  it('should order every row by name when sorting by name', () => {
    expect(ids(buildSeedRows(PLANTABLES, VALUES, 'name', 'pt-BR'))).toEqual([
      'kale',
      'melon',
      'corn',
      'apple',
      'wheat',
      'tulip',
    ]);
  });

  it('should break ties and order the other groups by localized name when gold is equal', () => {
    const tied = [value('wheat', 300, 157), ...VALUES.slice(1)];
    expect(ids(buildSeedRows(PLANTABLES, tied, 'goldPerDay', 'pt-BR'))).toEqual(
      ['kale', 'wheat', 'melon', 'corn', 'apple', 'tulip'],
    );
  });

  it('should order by name only when values are undefined', () => {
    expect(
      ids(buildSeedRows(PLANTABLES, undefined, 'goldPerDay', 'pt-BR')),
    ).toEqual(ids(buildSeedRows(PLANTABLES, VALUES, 'name', 'pt-BR')));
  });

  it('should attach the value and the localized name to each row', () => {
    const kale = buildSeedRows(PLANTABLES, VALUES, 'goldPerDay', 'pt-BR')[0];
    expect(kale.name).toBe('Couve');
    expect(kale.value?.goldTotal).toBe(440);
  });
});

describe('formatters', () => {
  it('should format gold in pt-BR when showing a value', () => {
    expect(textOf(formatGoldPerDay(157, 'pt-BR'))).toBe('15,7 g/dia');
    expect(textOf(formatGoldPerDay(80, 'pt-BR'))).toBe('8,0 g/dia');
    expect(textOf(formatGoldTotal(1234, 6, 'pt-BR'))).toBe(
      '1.234 g · 6 colheitas',
    );
    expect(textOf(formatGoldTotal(80, 1, 'pt-BR'))).toBe('80 g · 1 colheita');
    expect(textOf(formatGoldPerHarvest(1234, 4, 'pt-BR'))).toBe(
      '1.234 g por colheita · a cada 4 dias',
    );
    expect(textOf(formatGoldPerHarvest(80, 1, 'pt-BR'))).toBe(
      '80 g por colheita · todo dia',
    );
  });
});

describe('seed prefs', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('should return the defaults when storage is empty', () => {
    expect(loadSeedPrefs()).toEqual(DEFAULT_SEED_PREFS);
  });

  it('should return the defaults when storage holds invalid JSON', () => {
    localStorage.setItem('stardew.seedPrefs', '{nope');
    expect(loadSeedPrefs()).toEqual(DEFAULT_SEED_PREFS);
  });

  it('should replace each invalid field with its default when storage holds unknown values', () => {
    localStorage.setItem(
      'stardew.seedPrefs',
      JSON.stringify({
        fertilizer: 'tree',
        farmingLevel: 99,
        sort: 'name',
        location: 'mine',
        mode: 'forever',
      }),
    );
    expect(loadSeedPrefs()).toEqual({ ...DEFAULT_SEED_PREFS, sort: 'name' });
  });

  it('should return saved prefs when they were saved', () => {
    const prefs = {
      fertilizer: 'quality',
      farmingLevel: 7,
      sort: 'goldTotal',
      location: 'greenhouse',
      mode: 'window',
    } as const;
    saveSeedPrefs(prefs);
    expect(loadSeedPrefs()).toEqual(prefs);
  });

  it('should fall back to the defaults when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveSeedPrefs(DEFAULT_SEED_PREFS)).not.toThrow();
    expect(loadSeedPrefs()).toEqual(DEFAULT_SEED_PREFS);
  });
});

const compared = (
  id: string,
  raw: number,
  jar: number | null,
  keg: number | null,
): SeedValueOut => ({
  ...value(id, raw * 10, raw),
  jarGoldPerDayTenths: jar,
  kegGoldPerDayTenths: keg,
});

describe('bestPerDay sort', () => {
  it('should order by the best of raw, jar and keg gold per day', () => {
    const rows = buildSeedRows(
      PLANTABLES.slice(0, 3),
      [
        compared('wheat', 100, 120, 900),
        compared('kale', 300, 200, null),
        compared('melon', 50, 500, 400),
      ],
      'bestPerDay',
      'pt-BR',
    );
    expect(ids(rows)).toEqual(['wheat', 'melon', 'kale']);
  });
});

describe('bestDestination', () => {
  it('should pick the destination with the most gold per day, raw first on ties', () => {
    expect(bestDestination(compared('a', 100, 300, 300))).toBe('jar');
    expect(bestDestination(compared('a', 300, 300, 100))).toBe('raw');
    expect(bestDestination(compared('a', 100, null, 200))).toBe('keg');
  });

  it('should be null when no destination has a value', () => {
    expect(bestDestination(value('a', null, null))).toBeNull();
  });
});

describe('seed values in the active locale', () => {
  it('should format gold with the locale separators', () => {
    expect(formatGoldTotal(1234, 6, 'en').values?.gold).toBe('1,234');
    expect(formatGoldTotal(1234, 6, 'pt-BR').values?.gold).toBe('1.234');
    expect(formatGoldPerDay(157, 'en')).toEqual({
      key: 'seeds.goldPerDay',
      values: { gold: '15.7' },
    });
    expect(formatGoldPerHarvest(1234, 4, 'en').values?.gold).toBe('1,234');
    expect(textOf(formatGoldPerDay(157, 'en'), 'en')).toBe('15.7g/day');
    expect(textOf(formatGoldTotal(1234, 6, 'en'), 'en')).toBe(
      '1,234g · 6 harvests',
    );
    expect(textOf(formatGoldPerHarvest(80, 1, 'en'), 'en')).toBe(
      '80g per harvest · every day',
    );
    expect(textOf(formatGoldPerHarvest(1234, 4, 'en'), 'en')).toBe(
      '1,234g per harvest · every 4 days',
    );
  });

  it('should name and sort the rows in the given locale', () => {
    const en = buildSeedRows(PLANTABLES, VALUES, 'name', 'en');
    expect(en.map((r) => r.name)).toEqual(
      [...en.map((r) => r.name)].sort((a, b) => a.localeCompare(b, 'en')),
    );
    expect(en.some((r) => r.name === 'melon')).toBe(true);
  });
});
