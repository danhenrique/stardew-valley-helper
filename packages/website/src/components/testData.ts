import type {
  FishOut,
  GameEntityOut,
  MachineBatchOut,
  MachineOut,
  MachineScheduleOut,
  PlantableOut,
  PlantingOut,
  ScheduleOut,
  SeedValueOut,
} from '../generated/stardew-valley-api/types.gen';

// Fictitious test data shaped like the API responses.
export const PLANTABLES: PlantableOut[] = [
  {
    id: 'test-berry-seeds',
    name: { en: 'Berry Seeds', ptBr: 'Sementes de Fruta' },
    kind: 'crop',
    seasons: ['spring'],
    growthDays: 8,
    regrowDays: 4,
  },
  {
    id: 'test-flower-seeds',
    name: { en: 'Flower Seeds', ptBr: null },
    kind: 'crop',
    seasons: ['spring'],
    growthDays: 12,
  },
  {
    id: 'test-melon-seeds',
    name: { en: 'Melon Seeds', ptBr: 'Sementes de Melão' },
    kind: 'crop',
    seasons: ['summer'],
    growthDays: 12,
  },
  {
    id: 'test-sapling',
    name: { en: 'Test Sapling', ptBr: 'Muda Teste' },
    kind: 'fruit_tree',
    seasons: ['fall'],
    daysToMature: 28,
  },
];

/** Values of the spring PLANTABLES: berry has gold, flower does not mature, the sapling has none. */
export const SEED_VALUES: SeedValueOut[] = [
  {
    id: 'test-berry-seeds',
    harvests: 4,
    days: 28,
    goldTotal: 440,
    goldPerDayTenths: 157,
    willNotMature: false,
    approximate: false,
  },
  {
    id: 'test-flower-seeds',
    harvests: 0,
    days: 19,
    goldTotal: 0,
    goldPerDayTenths: 0,
    willNotMature: true,
    approximate: false,
  },
];

export const FERTILIZERS: GameEntityOut[] = [
  {
    type: 'fertilizers',
    id: 'speed-gro',
    name: { en: 'Speed-Gro', ptBr: 'Solo Foliar' },
  },
  {
    type: 'fertilizers',
    id: 'deluxe-speed-gro',
    name: { en: 'Deluxe Speed-Gro', ptBr: 'Solo Foliar Premium' },
  },
];

export const SPRING_1 = { year: 1, season: 'spring', day: 1 } as const;

const day = (
  season: 'spring' | 'summer' | 'fall' | 'winter',
  d: number,
  year = 1,
) => ({ year, season, day: d });

/** Schedule of BERRY_PLANTING, non-null so specs can spread it. */
export const BERRY_SCHEDULE: ScheduleOut = {
  firstHarvest: day('spring', 9),
  harvests: [9, 13, 17, 21, 25].map((d) => day('spring', d)),
  totalHarvests: 5,
  infinite: false,
  diesOn: day('summer', 1),
  status: 'growing',
  daysUntilNext: 8,
  approximate: false,
  warnings: [],
  yieldPerHarvest: 3.1,
  expectedTotalYield: 15.3,
};

export const BERRY_PLANTING: PlantingOut = {
  id: 'p-berry',
  seedId: 'test-berry-seeds',
  anchor: 'planted',
  plantedOn: day('spring', 1),
  lastHarvestOn: null,
  fertilizer: 'none',
  location: 'farm',
  quantity: 3,
  label: null,
  schedule: BERRY_SCHEDULE,
};

export const NAMES: Record<string, string> = {
  'test-berry-seeds': 'Sementes de Fruta',
  'test-melon-seeds': 'Sementes de Melão',
};

export const MELON_GREENHOUSE_PLANTING: PlantingOut = {
  ...BERRY_PLANTING,
  id: 'p-melon',
  seedId: 'test-melon-seeds',
  location: 'greenhouse',
  quantity: 1,
};

export const TEST_FESTIVAL: GameEntityOut = {
  type: 'festivals',
  id: 'test-festival',
  name: { en: 'Test Festival', ptBr: 'Festival Teste' },
  attributes: { season: 'spring', startDay: 13, endDay: 14 },
};

export const TEST_VILLAGER: GameEntityOut = {
  type: 'villagers',
  id: 'test-villager',
  name: { en: 'Test Villager', ptBr: 'Aldeão Teste' },
  attributes: { birthday: { season: 'spring', day: 5 } },
};

export const TEST_FORAGING: GameEntityOut = {
  type: 'foraging-events',
  id: 'test-foraging',
  name: { en: 'Test Foraging', ptBr: 'Coleta Teste' },
  attributes: { season: 'spring', startDay: 20 },
};

export const TEST_DEADLINE_PLANTABLE: PlantableOut = {
  ...PLANTABLES[0],
  id: 'test-deadline-seeds',
  name: { en: 'Deadline Seeds', ptBr: 'Sementes Prazo' },
  lastPlantingDay: 20,
};

export const TEST_SUMMER_FESTIVAL: GameEntityOut = {
  type: 'festivals',
  id: 'test-summer-festival',
  name: { en: 'Test Summer Festival', ptBr: 'Festival de Verão Teste' },
  attributes: { season: 'summer', startDay: 9, shopsClosed: false },
};

export const TEST_ACCENT_VILLAGER: GameEntityOut = {
  type: 'villagers',
  id: 'test-accent-villager',
  name: { en: 'Test Accent', ptBr: 'Têste Açaí' },
  attributes: { birthday: { season: 'fall', day: 3 } },
};

export const MACHINES: MachineOut[] = [
  {
    id: 'keg',
    name: { en: 'Keg', ptBr: 'Barril' },
    kind: 'batch',
    outputs: [
      {
        id: 'test-wine',
        name: { en: 'Test Wine', ptBr: 'Vinho Teste' },
        days: 7,
        approximate: false,
      },
      {
        id: 'test-juice',
        name: { en: 'Test Juice', ptBr: 'Suco Teste' },
        days: 2,
        approximate: true,
      },
    ],
  },
  {
    id: 'preserves-jar',
    name: { en: 'Preserves Jar', ptBr: 'Jarra de Conservas' },
    kind: 'batch',
    outputs: [
      {
        id: 'test-jelly',
        name: { en: 'Test Jelly', ptBr: 'Geleia Teste' },
        days: 3,
        approximate: false,
      },
      {
        id: 'test-pickles',
        name: { en: 'Test Pickles', ptBr: 'Picles Teste' },
        days: 3,
        approximate: false,
      },
    ],
  },
  {
    id: 'bee-house',
    name: { en: 'Bee House', ptBr: 'Colmeia' },
    kind: 'continuous',
    outputs: [
      {
        id: 'test-honey',
        name: { en: 'Test Honey', ptBr: 'Mel Teste' },
        days: 4,
        approximate: false,
      },
    ],
  },
  {
    id: 'cask',
    name: { en: 'Cask', ptBr: 'Barril de Envelhecimento' },
    kind: 'aging',
    outputs: [
      {
        id: 'test-aged',
        name: { en: 'Test Aged', ptBr: 'Envelhecido Teste' },
        days: 56,
        approximate: false,
      },
    ],
  },
];

/** Schedule of the default machineBatch() (keg processing), non-null so specs can spread it. */
export const MACHINE_SCHEDULE: MachineScheduleOut = {
  readyOn: day('summer', 3),
  collections: [],
  milestones: [],
  infinite: false,
  status: 'processing',
  daysUntilNext: 2,
  approximate: false,
  warnings: [],
};

export const machineBatch = (
  overrides: Partial<MachineBatchOut> = {},
): MachineBatchOut => ({
  id: 'm-keg',
  machineId: 'keg',
  outputId: 'test-wine',
  startedOn: day('summer', 1),
  quantity: 1,
  location: 'farm',
  label: null,
  schedule: MACHINE_SCHEDULE,
  ...overrides,
});

/** A stored planting whose seed left the game data (e.g. after a re-import): no schedule. */
export const INVALID_PLANTING: PlantingOut = {
  ...BERRY_PLANTING,
  id: 'p-invalid',
  seedId: 'removed-seed',
  label: 'Canteiro sumido',
  schedule: null,
  invalid: true,
};

/** A stored batch whose product left the game data: no schedule. */
export const INVALID_MACHINE: MachineBatchOut = machineBatch({
  id: 'm-invalid',
  outputId: 'removed-output',
  label: 'Barril sumido',
  schedule: null,
  invalid: true,
});

const fish = (
  id: string,
  ptBr: string,
  fields: Partial<FishOut> = {},
): FishOut => ({
  id,
  name: { en: ptBr, ptBr },
  tool: 'rod',
  category: 'regular',
  seasons: ['spring'],
  weather: 'any',
  windows: [{ fromMinute: 360, toMinute: 1140 }],
  location: { en: 'River', ptBr: 'Rio' },
  locationVerified: false,
  ...fields,
});

export const FISH: FishOut[] = [
  fish('test-crab', 'Caranguejo Teste', {
    tool: 'crab-pot',
    seasons: ['spring', 'summer', 'fall', 'winter'],
    windows: [{ fromMinute: 360, toMinute: 1560 }],
    location: { en: 'Ocean', ptBr: 'Oceano' },
  }),
  fish('test-two-windows', 'Duas Janelas', {
    category: 'night-market',
    seasons: ['winter'],
    weather: 'sun',
    windows: [
      { fromMinute: 360, toMinute: 660 },
      { fromMinute: 1080, toMinute: 1560 },
    ],
    location: { en: 'Submarine', ptBr: 'Submarino' },
  }),
  fish('test-legend-rain', 'Lenda Teste', {
    category: 'legendary',
    weather: 'rain',
    windows: [{ fromMinute: 360, toMinute: 1560 }],
    location: {
      en: 'Mountain lake, near the log.',
      ptBr: 'Lago da montanha, perto do tronco. Nível de pesca 10 necessário.',
    },
  }),
  fish('test-fall-fish', 'Peixe de Outono', { seasons: ['fall'] }),
  fish('test-rod-fish', 'Peixe Teste', { seasons: ['spring', 'summer'] }),
  fish('test-rain-only', 'Picão-verde', { weather: 'rain' }),
];
