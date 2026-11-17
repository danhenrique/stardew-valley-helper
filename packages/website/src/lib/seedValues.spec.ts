import type {
  PlantableOut,
  SeedValueOut,
} from '../generated/stardew-valley-api/types.gen';
import {
  bestDestination,
  buildSeedRows,
  DEFAULT_SEED_PREFS,
  formatGoldPerDay,
  formatGoldTotal,
  loadSeedPrefs,
  saveSeedPrefs,
} from './seedValues';

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
    expect(ids(buildSeedRows(PLANTABLES, VALUES, 'goldPerDay'))).toEqual([
      'kale',
      'melon',
      'wheat',
      'corn',
      'apple',
      'tulip',
    ]);
  });

  it('should order valued seeds by gold total when sorting by gold total', () => {
    expect(
      ids(buildSeedRows(PLANTABLES, VALUES, 'goldTotal')).slice(0, 3),
    ).toEqual(['melon', 'kale', 'wheat']);
  });

  it('should order every row by name when sorting by name', () => {
    expect(ids(buildSeedRows(PLANTABLES, VALUES, 'name'))).toEqual([
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
    expect(ids(buildSeedRows(PLANTABLES, tied, 'goldPerDay'))).toEqual([
      'kale',
      'wheat',
      'melon',
      'corn',
      'apple',
      'tulip',
    ]);
  });

  it('should order by name only when values are undefined', () => {
    expect(ids(buildSeedRows(PLANTABLES, undefined, 'goldPerDay'))).toEqual(
      ids(buildSeedRows(PLANTABLES, VALUES, 'name')),
    );
  });

  it('should attach the value and the localized name to each row', () => {
    const kale = buildSeedRows(PLANTABLES, VALUES, 'goldPerDay')[0];
    expect(kale.name).toBe('Couve');
    expect(kale.value?.goldTotal).toBe(440);
  });
});

describe('formatters', () => {
  it('should format gold in pt-BR when showing a value', () => {
    expect(formatGoldPerDay(157)).toBe('15,7 g/dia');
    expect(formatGoldPerDay(80)).toBe('8,0 g/dia');
    expect(formatGoldTotal(1234, 6)).toBe('1.234 g · 6 colheitas');
    expect(formatGoldTotal(80, 1)).toBe('80 g · 1 colheita');
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
      JSON.stringify({ fertilizer: 'tree', farmingLevel: 99, sort: 'name' }),
    );
    expect(loadSeedPrefs()).toEqual({ ...DEFAULT_SEED_PREFS, sort: 'name' });
  });

  it('should return saved prefs when they were saved', () => {
    const prefs = {
      fertilizer: 'quality',
      farmingLevel: 7,
      sort: 'goldTotal',
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
