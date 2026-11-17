import type {
  PlantableOut,
  SeedValueOut,
} from '../generated/stardew-valley-api/types.gen';
import { localizedName } from './i18n';

/** Fertilizers accepted by `GET /plantables/value` (the generated client types it as a string). */
export type ValueFertilizer =
  | 'none'
  | 'basic'
  | 'quality'
  | 'deluxe'
  | 'speed-gro'
  | 'deluxe-speed-gro'
  | 'hyper-speed-gro';

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
};

export const DEFAULT_SEED_PREFS: SeedPrefs = {
  fertilizer: 'none',
  farmingLevel: 0,
  sort: 'goldPerDay',
};

export const FERTILIZER_OPTIONS: {
  value: ValueFertilizer;
  label: string;
  iconId?: string;
}[] = [
  { value: 'none', label: 'Nenhum' },
  { value: 'basic', label: 'Fertilizante Básico', iconId: 'basic-fertilizer' },
  {
    value: 'quality',
    label: 'Fertilizante de Qualidade',
    iconId: 'quality-fertilizer',
  },
  {
    value: 'deluxe',
    label: 'Fertilizante Premium',
    iconId: 'deluxe-fertilizer',
  },
  { value: 'speed-gro', label: 'Solo Foliar', iconId: 'speed-gro' },
  {
    value: 'deluxe-speed-gro',
    label: 'Solo Foliar Premium',
    iconId: 'deluxe-speed-gro',
  },
  {
    value: 'hyper-speed-gro',
    label: 'Hiper Solo Foliar',
    iconId: 'hyper-speed-gro',
  },
];

export const SORT_OPTIONS: { value: SeedSort; label: string }[] = [
  { value: 'goldPerDay', label: 'Ouro/dia' },
  { value: 'bestPerDay', label: 'Melhor g/dia' },
  { value: 'goldTotal', label: 'Ouro no período' },
  { value: 'name', label: 'Nome' },
];

const PREFS_KEY = 'stardew.seedPrefs';
const MAX_FARMING_LEVEL = 10;

const byName = (a: SeedRow, b: SeedRow) =>
  a.name.localeCompare(b.name, 'pt-BR');

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
): SeedRow[] => {
  const byId = new Map(values?.map((value) => [value.id, value]));
  const rows = plantables.map((plantable) => ({
    plantable,
    name: localizedName(plantable.name),
    value: byId.get(plantable.id),
  }));
  if (!values || sort === 'name') return rows.sort(byName);
  return rows.sort(
    (a, b) =>
      group(a) - group(b) ||
      (group(a) === 0 ? gold(b, sort) - gold(a, sort) : 0) ||
      byName(a, b),
  );
};

const integer = new Intl.NumberFormat('pt-BR');
const oneDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const formatGoldPerDay = (tenths: number): string =>
  `${oneDecimal.format(tenths / 10)} g/dia`;

export const formatGoldTotal = (gold: number, harvests: number): string =>
  `${integer.format(gold)} g · ${harvests} ${harvests === 1 ? 'colheita' : 'colheitas'}`;

const isFertilizer = (value: unknown): value is ValueFertilizer =>
  FERTILIZER_OPTIONS.some((option) => option.value === value);

const isSort = (value: unknown): value is SeedSort =>
  SORT_OPTIONS.some((option) => option.value === value);

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
