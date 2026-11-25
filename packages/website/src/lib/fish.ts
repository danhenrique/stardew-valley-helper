import type {
  FishOut,
  FishWindowOut,
  Season,
} from '../generated/stardew-valley-api/types.gen';
import { LOCALES, localizedText } from './locale';
import { type MessageRef, message } from './message';

export type FishWeatherFilter = 'all' | 'sun' | 'rain';
export type FishKindFilter = 'all' | 'rod' | 'crab-pot' | 'special';

export type FishFilters = {
  season: Season;
  weather: FishWeatherFilter;
  kind: FishKindFilter;
  query: string;
};

export type FishSection = {
  id:
    | 'rod'
    | 'night-market'
    | 'legendary'
    | 'legendary-ii'
    | 'crab-pot'
    | 'rain-only';
  title: MessageRef;
  fish: FishOut[];
};

export type FishPrefs = Pick<FishFilters, 'season' | 'weather' | 'kind'>;

export const WEATHER_OPTIONS: {
  value: FishWeatherFilter;
  label: MessageRef;
}[] = [
  { value: 'all', label: message('labels.fishWeather.all') },
  { value: 'sun', label: message('labels.fishWeather.sun') },
  { value: 'rain', label: message('labels.fishWeather.rain') },
];

export const KIND_OPTIONS: { value: FishKindFilter; label: MessageRef }[] = [
  { value: 'all', label: message('labels.fishKind.all') },
  { value: 'rod', label: message('labels.fishKind.rod') },
  { value: 'crab-pot', label: message('labels.fishKind.crabPot') },
  { value: 'special', label: message('labels.fishKind.special') },
];

const MINUTES_PER_DAY = 1440;
/** The hour bar spans the fishing day: 06:00 to 02:00 of the next day. */
const BAR_START = 360;
const BAR_END = 1560;

/** Lowercase without diacritics, so a query typed without them still finds the name. */
const fold = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Every name of a fish, so the search matches both languages. */
const fishNames = (fish: FishOut) =>
  LOCALES.map((locale) => localizedText(fish.name, locale) ?? fish.id);

const matchesWeather = (fish: FishOut, weather: FishWeatherFilter) =>
  weather === 'all' || fish.weather === 'any' || fish.weather === weather;

const matchesKind = (fish: FishOut, kind: FishKindFilter) => {
  if (kind === 'all') return true;
  if (kind === 'crab-pot') return fish.tool === 'crab-pot';
  if (kind === 'rod') return fish.tool === 'rod';
  return fish.category !== 'regular';
};

/** Fish of the season matching weather, kind and the name query; keeps the API order. */
export const filterFish = (
  fish: FishOut[],
  { season, weather, kind, query }: FishFilters,
): FishOut[] => {
  const needle = fold(query);
  return fish.filter(
    (f) =>
      f.seasons.includes(season) &&
      matchesWeather(f, weather) &&
      matchesKind(f, kind) &&
      (!needle || fishNames(f).some((name) => fold(name).includes(needle))),
  );
};

const GROUPS: {
  id: FishSection['id'];
  title: MessageRef;
  test: (f: FishOut) => boolean;
}[] = [
  {
    id: 'rod',
    title: message('labels.fishSection.rod'),
    test: (f) => f.tool === 'rod' && f.category === 'regular',
  },
  {
    id: 'night-market',
    title: message('labels.fishSection.nightMarket'),
    test: (f) => f.category === 'night-market',
  },
  {
    id: 'legendary',
    title: message('labels.fishSection.legendary'),
    test: (f) => f.category === 'legendary',
  },
  {
    id: 'legendary-ii',
    title: message('labels.fishSection.legendaryII'),
    test: (f) => f.category === 'legendary-ii',
  },
  {
    id: 'crab-pot',
    title: message('labels.fishSection.crabPot'),
    test: (f) => f.tool === 'crab-pot',
  },
];

/** Sections by tool and category; empty sections are dropped. */
export const groupFish = (fish: FishOut[]): FishSection[] =>
  GROUPS.map(({ id, title, test }) => ({
    id,
    title,
    fish: fish.filter(test),
  })).filter((section) => section.fish.length > 0);

/** Fish catchable on a rainy day of the season: rain-only first, then the rest grouped. */
export const rainFishSections = (
  fish: FishOut[],
  season: Season,
): FishSection[] => {
  const today = fish.filter(
    (f) => f.seasons.includes(season) && f.weather !== 'sun',
  );
  const rainOnly = today.filter((f) => f.weather === 'rain');
  return [
    ...(rainOnly.length > 0
      ? [
          {
            id: 'rain-only' as const,
            title: message('labels.fishSection.rainOnly'),
            fish: rainOnly,
          },
        ]
      : []),
    ...groupFish(today.filter((f) => f.weather === 'any')),
  ];
};

const clock = (minutes: number) => {
  const m = minutes % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** "06:00–19:00"; times after midnight are shown as the next day's clock. */
export const formatWindow = ({ fromMinute, toMinute }: FishWindowOut): string =>
  `${clock(fromMinute)}–${clock(toMinute)}`;

const percent = (minute: number) =>
  ((Math.min(Math.max(minute, BAR_START), BAR_END) - BAR_START) /
    (BAR_END - BAR_START)) *
  100;

/** Position of a window on the 06:00 → 02:00 bar, in percent. */
export const windowBar = ({ fromMinute, toMinute }: FishWindowOut) => {
  const left = percent(fromMinute);
  return { left, width: percent(toMinute) - left };
};

const PREFS_KEY = 'stardew.fishPrefs';

const pick = <T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T => options.find((option) => option === value) ?? fallback;

/**
 * Only the kind is remembered: the season comes from the game date and the weather from
 * today's rain, so the page never opens on a stale season or ignores the rain.
 */
export const loadFishPrefs = (fallback: FishPrefs): FishPrefs => {
  try {
    const stored: { kind?: unknown } = JSON.parse(
      localStorage.getItem(PREFS_KEY) ?? '{}',
    );
    return {
      ...fallback,
      kind: pick(
        stored.kind,
        KIND_OPTIONS.map((o) => o.value),
        fallback.kind,
      ),
    };
  } catch {
    return fallback;
  }
};

export const saveFishPrefs = ({ kind }: FishPrefs): void => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ kind }));
  } catch {
    // Storage blocked (private window, quota): the filters still work for this visit.
  }
};
