import {
  BERRY_PLANTING,
  BERRY_SCHEDULE,
  INVALID_PLANTING,
  PLANTABLES,
  SPRING_1,
} from '../components/testData';
import type {
  PlantingOut,
  ScheduleOut,
} from '../generated/stardew-valley-api/types.gen';
import type { PlantingStatus } from './i18n';
import { textOf } from './messageText.spec-helpers';
import {
  canReplant,
  isActionable,
  plantingIssue,
  relativeDay,
  replantBody,
  summarizeSchedule,
  toPlantingIn,
} from './plantings';

const plantable = (id: string) => PLANTABLES.find((item) => item.id === id);
const SPRING_20 = { year: 1, season: 'spring', day: 20 } as const;
const SUMMER_1 = { year: 1, season: 'summer', day: 1 } as const;

describe('plantingIssue', () => {
  it('should flag an out-of-season crop on the farm', () => {
    expect(
      plantingIssue(plantable('test-melon-seeds'), {
        date: SPRING_1,
        location: 'farm',
        anchor: 'planted',
      }),
    ).toEqual({ key: 'errors.planting.outOfSeason' });
  });

  it('should accept an out-of-season crop in the greenhouse', () => {
    expect(
      plantingIssue(plantable('test-melon-seeds'), {
        date: SPRING_1,
        location: 'greenhouse',
        anchor: 'planted',
      }),
    ).toBeNull();
  });

  it('should accept a fruit tree on the farm in any season', () => {
    expect(
      plantingIssue(plantable('test-sapling'), {
        date: SPRING_1,
        location: 'farm',
        anchor: 'planted',
      }),
    ).toBeNull();
  });

  it('should reject a non-regrowing crop anchored on a harvest', () => {
    expect(
      plantingIssue(plantable('test-flower-seeds'), {
        date: SPRING_1,
        location: 'farm',
        anchor: 'harvested',
      }),
    ).toEqual({ key: 'errors.planting.onlyRegrowing' });
  });

  it('should ask for a seed when none is selected', () => {
    expect(
      plantingIssue(undefined, {
        date: SPRING_1,
        location: 'farm',
        anchor: 'planted',
      }),
    ).toEqual({ key: 'errors.planting.chooseSeed' });
  });
});

describe('canReplant', () => {
  const planting = BERRY_PLANTING as unknown as PlantingOut;
  const withStatus = (
    base: PlantingOut,
    status: PlantingStatus,
  ): PlantingOut => ({ ...base, schedule: { ...BERRY_SCHEDULE, status } });

  it('should be false for a ready regrowing crop', () => {
    expect(
      canReplant(
        withStatus(planting, 'ready'),
        plantable('test-berry-seeds'),
        SPRING_1,
      ),
    ).toBe(false);
  });

  it('should be true for a dead or finished regrowing crop in season', () => {
    for (const status of ['dead', 'finished'] as const)
      expect(
        canReplant(
          withStatus(planting, status),
          plantable('test-berry-seeds'),
          SPRING_1,
        ),
      ).toBe(true);
  });

  it('should be false for a dead regrowing crop out of season on the farm', () => {
    expect(
      canReplant(
        withStatus(planting, 'dead'),
        plantable('test-berry-seeds'),
        SUMMER_1,
      ),
    ).toBe(false);
  });

  it('should be false for a dead fruit tree', () => {
    const tree: PlantingOut = {
      ...withStatus(planting, 'dead'),
      seedId: 'test-sapling',
    };
    expect(canReplant(tree, plantable('test-sapling'), SPRING_1)).toBe(false);
  });

  it('should be false for an out-of-season crop on the farm', () => {
    const melon = { ...planting, seedId: 'test-melon-seeds' } as PlantingOut;
    expect(canReplant(melon, plantable('test-melon-seeds'), SPRING_1)).toBe(
      false,
    );
  });

  it('should be true for an in-season non-regrowing crop on the farm', () => {
    const flower = { ...planting, seedId: 'test-flower-seeds' } as PlantingOut;
    expect(canReplant(flower, plantable('test-flower-seeds'), SPRING_1)).toBe(
      true,
    );
  });
});

describe('replantBody', () => {
  it('should restart from today keeping the other fields', () => {
    const harvested = {
      ...BERRY_PLANTING,
      anchor: 'harvested',
      plantedOn: null,
      lastHarvestOn: SPRING_20,
      fertilizer: 'speed-gro',
    } as unknown as PlantingOut;
    expect(replantBody(harvested, SPRING_1)).toEqual({
      seedId: 'test-berry-seeds',
      anchor: 'planted',
      plantedOn: SPRING_1,
      lastHarvestOn: null,
      fertilizer: 'speed-gro',
      location: 'farm',
      quantity: 3,
      label: null,
    });
  });
});

describe('toPlantingIn', () => {
  it('should strip id and schedule', () => {
    const body = toPlantingIn(BERRY_PLANTING as unknown as PlantingOut);
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('schedule');
    expect(body.seedId).toBe('test-berry-seeds');
  });
});

describe('summarizeSchedule', () => {
  const schedule = (patch: Partial<ScheduleOut>) =>
    ({
      ...BERRY_SCHEDULE,
      firstHarvest: SPRING_20,
      totalHarvests: 4,
      infinite: false,
      ...patch,
    }) as unknown as ScheduleOut;

  it('should summarize several harvests', () => {
    expect(textOf(summarizeSchedule(schedule({}), SPRING_1))).toBe(
      'Pronto em Primavera 20, Ano 1 (daqui a 19 dias) · 4 colheitas',
    );
  });

  it('should use the singular for one harvest', () => {
    expect(
      textOf(summarizeSchedule(schedule({ totalHarvests: 1 }), SPRING_1)),
    ).toBe('Pronto em Primavera 20, Ano 1 (daqui a 19 dias) · 1 colheita');
  });

  it('should describe endless harvests', () => {
    expect(
      textOf(summarizeSchedule(schedule({ infinite: true }), SPRING_1)),
    ).toBe(
      'Pronto em Primavera 20, Ano 1 (daqui a 19 dias) · colheitas sem fim',
    );
  });

  it('should explain when the crop never matures', () => {
    expect(
      textOf(summarizeSchedule(schedule({ firstHarvest: null }), SPRING_1)),
    ).toBe('Não amadurece antes do fim da estação');
  });
});

describe('relativeDay', () => {
  it('should say hoje, amanhã or daqui a N dias when the date is today or later', () => {
    expect(textOf(relativeDay(SPRING_1, SPRING_1))).toBe('hoje');
    expect(textOf(relativeDay(SPRING_1, { ...SPRING_1, day: 2 }))).toBe(
      'amanhã',
    );
    expect(textOf(relativeDay(SPRING_1, SUMMER_1))).toBe('daqui a 28 dias');
  });

  it('should say ontem or há N dias when the date is in the past', () => {
    expect(textOf(relativeDay(SPRING_20, { ...SPRING_20, day: 19 }))).toBe(
      'ontem',
    );
    expect(textOf(relativeDay(SUMMER_1, SPRING_20))).toBe('há 9 dias');
  });
});

describe('isActionable', () => {
  it('should be true only when the planting is ready', () => {
    const withStatus = (status: ScheduleOut['status']) =>
      ({
        ...BERRY_PLANTING,
        schedule: { ...BERRY_SCHEDULE, status },
      }) as unknown as PlantingOut;
    expect(isActionable(withStatus('ready'))).toBe(true);
    expect(isActionable(withStatus('growing'))).toBe(false);
  });
});

describe('invalid plantings (no schedule)', () => {
  it('should never be actionable when the planting is invalid', () => {
    expect(isActionable(INVALID_PLANTING)).toBe(false);
  });

  it('should not be replantable when the planting is invalid', () => {
    expect(
      canReplant(
        { ...INVALID_PLANTING, seedId: 'test-flower-seeds' },
        plantable('test-flower-seeds'),
        SPRING_1,
      ),
    ).toBe(false);
  });

  it('should strip invalid from the request body when converting to PlantingIn', () => {
    const body = toPlantingIn(INVALID_PLANTING);
    expect(body).not.toHaveProperty('invalid');
    expect(body).not.toHaveProperty('schedule');
    expect(body.seedId).toBe('removed-seed');
  });
});
