import type {
  Location,
  PlantableOut,
  SeedValueOut,
} from '../generated/stardew-valley-api/types.gen';
import { LOCATIONS, localizedName, locationMessage } from './i18n';
import type { Locale } from './locale';
import { type MessageRef, message } from './message';

/** Fertilizers accepted by `GET /plantables/value` (the generated client types it as a string). */
export type ValueFertilizer =
  | 'none'
  | 'basic'
  | 'quality'
  | 'deluxe'
  | 'speed-gro'
  | 'deluxe-speed-gro'
  | 'hyper-speed-gro';

/** How `GET /plantables/value` spreads the gold: over a window or per continuous cycle. */
export type ValueMode = 'window' | 'continuous';

export type SeedSort = 'goldPerDay' | 'bestPerDay' | 'goldTotal' | 'name';

/** Where the harvest goes: sold as is, in a preserves jar or in a keg. */
export type Destination = 'raw' | 'jar' | 'keg';

export type SeedRow = {
  plantable: PlantableOut;
  name: string;
  value?: SeedValueOut;
};

export type SeedPrefs = {
  fertilizer: ValueFertilizer;
  farmingLevel: number;
  sort: SeedSort;
  location: Location;
  /** Used only in the greenhouse and on Ginger Island; the farm always values a window. */
  mode: ValueMode;
};

export const DEFAULT_SEED_PREFS: SeedPrefs = {
  fertilizer: 'none',
  farmingLevel: 0,
  sort: 'goldPerDay',
  location: 'farm',
  mode: 'continuous',
};

export const LOCATION_OPTIONS = LOCATIONS.map((value) => ({
  value,
  label: locationMessage(value),
}));

export const MODE_OPTIONS: { value: ValueMode; label: MessageRef }[] = [
  { value: 'continuous', label: message('labels.valueMode.continuous') },
  { value: 'window', label: message('labels.valueMode.window') },
];

export const FERTILIZER_OPTIONS: {
  value: ValueFertilizer;
  label: MessageRef;
  iconId?: string;
}[] = [
  { value: 'none', label: message('labels.noFertilizer') },
  {
    value: 'basic',
    label: message('labels.fertilizer.basic'),
    iconId: 'basic-fertilizer',
  },
  {
    value: 'quality',
    label: message('labels.fertilizer.quality'),
    iconId: 'quality-fertilizer',
  },
  {
    value: 'deluxe',
    label: message('labels.fertilizer.deluxe'),
    iconId: 'deluxe-fertilizer',
  },
  {
    value: 'speed-gro',
    label: message('labels.fertilizer.speed-gro'),
    iconId: 'speed-gro',
  },
  {
    value: 'deluxe-speed-gro',
    label: message('labels.fertilizer.deluxe-speed-gro'),
    iconId: 'deluxe-speed-gro',
  },
  {
    value: 'hyper-speed-gro',
    label: message('labels.fertilizer.hyper-speed-gro'),
    iconId: 'hyper-speed-gro',
  },
];

export const SORT_OPTIONS: { value: SeedSort; label: MessageRef }[] = [
  { value: 'goldPerDay', label: message('labels.seedSort.goldPerDay') },
  { value: 'bestPerDay', label: message('labels.seedSort.bestPerDay') },
  { value: 'goldTotal', label: message('labels.seedSort.goldTotal') },
  { value: 'name', label: message('labels.seedSort.name') },
];

const PREFS_KEY = 'stardew.seedPrefs';
const MAX_FARMING_LEVEL = 10;

const byName = (locale: Locale) => {
  const collator = new Intl.Collator(locale);
  return (a: SeedRow, b: SeedRow) => collator.compare(a.name, b.name);
};

/** 0 = has gold, 1 = does not mature in the window, 2 = no value. */
const group = (row: SeedRow): number => {
  if (row.value?.willNotMature) return 1;
  return row.value?.goldTotal != null ? 0 : 2;
};

const perDay = (value: SeedValueOut): Record<Destination, number | null> => ({
  raw: value.goldPerDayTenths ?? null,
  jar: value.jarGoldPerDayTenths ?? null,
  keg: value.kegGoldPerDayTenths ?? null,
});

/** The destination with the most gold per day; raw, then jar, then keg on ties. */
export const bestDestination = (value: SeedValueOut): Destination | null => {
  let best: Destination | null = null;
  let bestGold = -1;
  for (const [destination, gold] of Object.entries(perDay(value)) as [
    Destination,
    number | null,
  ][]) {
    if (gold != null && gold > bestGold) {
      best = destination;
      bestGold = gold;
    }
  }
  return best;
};

const gold = (row: SeedRow, sort: SeedSort): number => {
  const { value } = row;
  if (!value) return 0;
  if (sort === 'goldTotal') return value.goldTotal ?? 0;
  if (sort === 'bestPerDay') {
    const best = bestDestination(value);
    return best ? (perDay(value)[best] ?? 0) : 0;
  }
  return value.goldPerDayTenths ?? 0;
};

/** Joins the plantables with their values and orders them: valued, not mature, without value. */
export const buildSeedRows = (
  plantables: PlantableOut[],
  values: SeedValueOut[] | undefined,
  sort: SeedSort,
  locale: Locale,
): SeedRow[] => {
  const byId = new Map(values?.map((value) => [value.id, value]));
  const rows = plantables.map((plantable) => ({
    plantable,
    name: localizedName(plantable.name, locale),
    value: byId.get(plantable.id),
  }));
  const compareNames = byName(locale);
  if (!values || sort === 'name') return rows.sort(compareNames);
  return rows.sort(
    (a, b) =>
      group(a) - group(b) ||
      (group(a) === 0 ? gold(b, sort) - gold(a, sort) : 0) ||
      compareNames(a, b),
  );
};

const integer = (value: number, locale: Locale) =>
  new Intl.NumberFormat(locale).format(value);

export const formatGoldPerDay = (tenths: number, locale: Locale): MessageRef =>
  message('seeds.goldPerDay', {
    gold: new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(tenths / 10),
  });

export const formatGoldTotal = (
  gold: number,
  harvests: number,
  locale: Locale,
): MessageRef =>
  message('seeds.goldTotal', { gold: integer(gold, locale), harvests });

/** Continuous mode: the gold of one harvest and the days between harvests. */
export const formatGoldPerHarvest = (
  gold: number,
  cycleDays: number,
  locale: Locale,
): MessageRef =>
  message('seeds.goldPerHarvest', {
    gold: integer(gold, locale),
    cycle: cycleDays,
  });

const isFertilizer = (value: unknown): value is ValueFertilizer =>
  FERTILIZER_OPTIONS.some((option) => option.value === value);

const isSort = (value: unknown): value is SeedSort =>
  SORT_OPTIONS.some((option) => option.value === value);

const isLocation = (value: unknown): value is Location =>
  LOCATION_OPTIONS.some((option) => option.value === value);

const isMode = (value: unknown): value is ValueMode =>
  MODE_OPTIONS.some((option) => option.value === value);

const isLevel = (value: unknown): value is number =>
  Number.isInteger(value) &&
  (value as number) >= 0 &&
  (value as number) <= MAX_FARMING_LEVEL;

/** Saved controls of the seeds tab; each invalid field falls back to its default. */
export const loadSeedPrefs = (): SeedPrefs => {
  try {
    const stored: Partial<Record<keyof SeedPrefs, unknown>> = JSON.parse(
      localStorage.getItem(PREFS_KEY) ?? '{}',
    );
    return {
      fertilizer: isFertilizer(stored.fertilizer)
        ? stored.fertilizer
        : DEFAULT_SEED_PREFS.fertilizer,
      farmingLevel: isLevel(stored.farmingLevel)
        ? stored.farmingLevel
        : DEFAULT_SEED_PREFS.farmingLevel,
      sort: isSort(stored.sort) ? stored.sort : DEFAULT_SEED_PREFS.sort,
      location: isLocation(stored.location)
        ? stored.location
        : DEFAULT_SEED_PREFS.location,
      mode: isMode(stored.mode) ? stored.mode : DEFAULT_SEED_PREFS.mode,
    };
  } catch {
    return DEFAULT_SEED_PREFS;
  }
};

export const saveSeedPrefs = (prefs: SeedPrefs): void => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked (private window, quota): the controls still work for this visit.
  }
};
