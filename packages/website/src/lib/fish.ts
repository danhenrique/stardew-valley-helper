import type {
  FishOut,
  FishWindowOut,
  Season,
} from '../generated/stardew-valley-api/types.gen';

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
  title: string;
  fish: FishOut[];
};

export type FishPrefs = Pick<FishFilters, 'season' | 'weather' | 'kind'>;

export const WEATHER_OPTIONS: { value: FishWeatherFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'sun', label: 'Sol' },
  { value: 'rain', label: 'Chuva' },
];

export const KIND_OPTIONS: { value: FishKindFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'rod', label: 'Vara' },
  { value: 'crab-pot', label: 'Covo' },
  { value: 'special', label: 'Especiais' },
];

const MINUTES_PER_DAY = 1440;
/** The hour bar spans the fishing day: 06:00 to 02:00 of the next day. */
const BAR_START = 360;
const BAR_END = 1560;

/** Lowercase without accents, so "picao" finds "Picão-verde". */
const fold = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

const fishName = (fish: FishOut) => fish.name.ptBr ?? fish.name.en ?? fish.id;

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
      (!needle || fold(fishName(f)).includes(needle)),
  );
};

const GROUPS: {
  id: FishSection['id'];
  title: string;
  test: (f: FishOut) => boolean;
}[] = [
  {
    id: 'rod',
    title: 'Vara',
    test: (f) => f.tool === 'rod' && f.category === 'regular',
  },
  {
    id: 'night-market',
    title: 'Mercado Noturno',
    test: (f) => f.category === 'night-market',
  },
  {
    id: 'legendary',
    title: 'Lendários',
    test: (f) => f.category === 'legendary',
  },
  {
    id: 'legendary-ii',
    title: 'Lendários II',
    test: (f) => f.category === 'legendary-ii',
  },
  { id: 'crab-pot', title: 'Covo', test: (f) => f.tool === 'crab-pot' },
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
      ? [{ id: 'rain-only' as const, title: 'Só na chuva', fish: rainOnly }]
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
