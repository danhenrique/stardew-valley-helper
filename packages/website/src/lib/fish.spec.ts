import { FISH } from '../components/testData';
import {
  type FishFilters,
  filterFish,
  formatWindow,
  groupFish,
  loadFishPrefs,
  rainFishSections,
  saveFishPrefs,
  windowBar,
} from './fish';

const ALL: FishFilters = {
  season: 'spring',
  weather: 'all',
  kind: 'all',
  query: '',
};
const ids = (list: { id: string }[]) => list.map((f) => f.id);

describe('filterFish', () => {
  it('should keep only fish of the season when filtering', () => {
    expect(ids(filterFish(FISH, ALL))).toEqual([
      'test-crab',
      'test-legend-rain',
      'test-rod-fish',
      'test-rain-only',
    ]);
  });

  it('should keep any and sun fish when weather is sun', () => {
    const winter = filterFish(FISH, {
      ...ALL,
      season: 'winter',
      weather: 'sun',
    });
    expect(ids(winter)).toEqual(['test-crab', 'test-two-windows']);
    expect(ids(filterFish(FISH, { ...ALL, weather: 'sun' }))).toEqual([
      'test-crab',
      'test-rod-fish',
    ]);
  });

  it('should keep any and rain fish when weather is rain', () => {
    expect(ids(filterFish(FISH, { ...ALL, weather: 'rain' }))).toEqual([
      'test-crab',
      'test-legend-rain',
      'test-rod-fish',
      'test-rain-only',
    ]);
  });

  it('should keep night market and legendary fish when kind is special', () => {
    const special = filterFish(FISH, {
      ...ALL,
      season: 'winter',
      kind: 'special',
    });
    expect(ids(special)).toEqual(['test-two-windows']);
    expect(ids(filterFish(FISH, { ...ALL, kind: 'special' }))).toEqual([
      'test-legend-rain',
    ]);
  });

  it('should keep only crab pot fish when kind is crab-pot', () => {
    expect(ids(filterFish(FISH, { ...ALL, kind: 'crab-pot' }))).toEqual([
      'test-crab',
    ]);
  });

  it('should match the name without accents when searching', () => {
    expect(ids(filterFish(FISH, { ...ALL, query: 'picao' }))).toEqual([
      'test-rain-only',
    ]);
    expect(ids(filterFish(FISH, { ...ALL, query: '  LENDA ' }))).toEqual([
      'test-legend-rain',
    ]);
  });
});

describe('groupFish', () => {
  it('should group in Vara, Mercado Noturno, Lendários, Lendários II, Covo order and drop empty groups when grouping', () => {
    const sections = groupFish(FISH);
    expect(sections.map((s) => s.title)).toEqual([
      'Vara',
      'Mercado Noturno',
      'Lendários',
      'Covo',
    ]);
    expect(ids(sections[0].fish)).toEqual([
      'test-fall-fish',
      'test-rod-fish',
      'test-rain-only',
    ]);
  });
});

describe('rainFishSections', () => {
  it('should put rain-only fish first when building rain sections', () => {
    const sections = rainFishSections(FISH, 'spring');
    expect(sections.map((s) => s.title)).toEqual([
      'Só na chuva',
      'Vara',
      'Covo',
    ]);
    expect(ids(sections[0].fish)).toEqual([
      'test-legend-rain',
      'test-rain-only',
    ]);
    expect(ids(sections[1].fish)).toEqual(['test-rod-fish']);
  });
});

describe('formatWindow and windowBar', () => {
  it('should format a window when it crosses midnight', () => {
    expect(formatWindow({ fromMinute: 1080, toMinute: 1560 })).toBe(
      '18:00–02:00',
    );
    expect(formatWindow({ fromMinute: 360, toMinute: 1140 })).toBe(
      '06:00–19:00',
    );
  });

  it('should place the window at the end of the bar when it crosses midnight', () => {
    expect(windowBar({ fromMinute: 1080, toMinute: 1560 })).toEqual({
      left: 60,
      width: 40,
    });
    expect(windowBar({ fromMinute: 360, toMinute: 1560 })).toEqual({
      left: 0,
      width: 100,
    });
  });
});

describe('fish prefs', () => {
  const fallback = { season: 'summer', weather: 'all', kind: 'all' } as const;

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('should restore only the kind when prefs were saved', () => {
    saveFishPrefs({ season: 'fall', weather: 'rain', kind: 'crab-pot' });
    expect(loadFishPrefs(fallback)).toEqual({
      season: 'summer',
      weather: 'all',
      kind: 'crab-pot',
    });
    expect(
      JSON.parse(localStorage.getItem('stardew.fishPrefs') ?? '{}'),
    ).toEqual({
      kind: 'crab-pot',
    });
  });

  it('should fall back to defaults when saved prefs are invalid', () => {
    localStorage.setItem(
      'stardew.fishPrefs',
      '{"kind":"legendary","season":"x"}',
    );
    expect(loadFishPrefs(fallback)).toEqual(fallback);
    localStorage.setItem('stardew.fishPrefs', '{nope');
    expect(loadFishPrefs(fallback)).toEqual(fallback);
  });

  it('should fall back to defaults when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadFishPrefs(fallback)).toEqual(fallback);
    expect(() => saveFishPrefs(fallback)).not.toThrow();
  });
});
