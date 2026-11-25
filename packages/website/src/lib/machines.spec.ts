import {
  INVALID_MACHINE,
  MACHINE_SCHEDULE,
  MACHINES,
  machineBatch,
} from '../components/testData';
import type { MachineScheduleOut } from '../generated/stardew-valley-api/types.gen';
import {
  isMachineActionable,
  machineBatchNames,
  machineDates,
  machineIssue,
  machineMarkers,
  milestoneReachedOn,
  nextMachineDate,
  recollectBody,
  summarizeMachineSchedule,
  toMachineBatchIn,
} from './machines';
import { textOf } from './messageText.spec-helpers';

const day = (
  season: 'spring' | 'summer' | 'fall' | 'winter',
  d: number,
  year = 1,
) => ({
  year,
  season,
  day: d,
});
const keg = MACHINES[0];
const schedule = (
  overrides: Partial<MachineScheduleOut>,
): MachineScheduleOut => ({ ...MACHINE_SCHEDULE, ...overrides });

describe('machineIssue', () => {
  it('should ask for a machine', () => {
    expect(machineIssue(undefined, null)).toEqual({
      key: 'errors.machine.chooseMachine',
    });
  });

  it('should ask for an output of the machine', () => {
    expect(machineIssue(keg, null)).toEqual({
      key: 'errors.machine.chooseProduct',
    });
    expect(machineIssue(keg, 'other')).toEqual({
      key: 'errors.machine.chooseProduct',
    });
  });

  it('should accept a valid output', () => {
    expect(machineIssue(keg, 'test-wine')).toBeNull();
  });
});

describe('summarizeMachineSchedule', () => {
  it('should summarize a batch', () => {
    expect(
      textOf(
        summarizeMachineSchedule(
          'batch',
          7,
          schedule({ readyOn: day('summer', 3) }),
        ),
      ),
    ).toBe('Pronto em Verão 3, Ano 1');
  });

  it('should summarize a continuous machine', () => {
    expect(
      textOf(
        summarizeMachineSchedule(
          'continuous',
          4,
          schedule({
            readyOn: null,
            collections: [day('summer', 3), day('summer', 7)],
            daysUntilNext: 2,
          }),
        ),
      ),
    ).toBe('Coleta a cada 4 dias · próxima Verão 3, Ano 1');
  });

  it('should use the output days, not the gap across the winter pause', () => {
    expect(
      textOf(
        summarizeMachineSchedule(
          'continuous',
          4,
          schedule({
            readyOn: null,
            collections: [day('fall', 26), day('spring', 1, 2)],
            daysUntilNext: 0,
          }),
        ),
      ),
    ).toBe('Coleta a cada 4 dias · próxima Outono 26, Ano 1');
  });

  it('should summarize aging milestones', () => {
    expect(
      textOf(
        summarizeMachineSchedule(
          'aging',
          56,
          schedule({
            readyOn: null,
            milestones: [
              { quality: 'silver', on: day('summer', 5) },
              { quality: 'gold', on: day('summer', 19) },
              { quality: 'iridium', on: day('fall', 19) },
            ],
          }),
        ),
      ),
    ).toBe(
      'Prata Verão 5, Ano 1 · Ouro Verão 19, Ano 1 · Irídio Outono 19, Ano 1',
    );
  });
});

describe('machineDates', () => {
  it('should return the ready date of a batch', () => {
    expect(machineDates(machineBatch())).toEqual([
      { date: day('summer', 3), label: { key: 'labels.machineDate.ready' } },
    ]);
  });

  it('should return the 10 collections of a continuous machine', () => {
    const collections = Array.from({ length: 10 }, (_, i) =>
      day('summer', 5 + i * 2),
    );
    const dates = machineDates(
      machineBatch({
        machineId: 'bee-house',
        schedule: schedule({ readyOn: null, collections }),
      }),
    );
    expect(dates).toHaveLength(10);
    expect(dates[0].date).toEqual(collections[0]);
  });

  it('should return each aging milestone labeled by quality', () => {
    const dates = machineDates(
      machineBatch({
        machineId: 'cask',
        schedule: schedule({
          readyOn: null,
          milestones: [{ quality: 'gold', on: day('summer', 19) }],
        }),
      }),
    );
    expect(dates).toEqual([
      { date: day('summer', 19), label: { key: 'labels.quality.gold' } },
    ]);
  });

  it('should return nothing without a ready date', () => {
    expect(
      machineDates(machineBatch({ schedule: schedule({ readyOn: null }) })),
    ).toEqual([]);
  });
});

describe('isMachineActionable', () => {
  it('should be true for ready and iridium only', () => {
    const with_ = (status: MachineScheduleOut['status']) =>
      machineBatch({ schedule: schedule({ status }) });
    expect(isMachineActionable(with_('ready'))).toBe(true);
    expect(isMachineActionable(with_('iridium'))).toBe(true);
    expect(isMachineActionable(with_('processing'))).toBe(false);
    expect(isMachineActionable(with_('aging'))).toBe(false);
  });
});

describe('milestoneReachedOn', () => {
  const cask = machineBatch({
    machineId: 'cask',
    outputId: 'test-aged',
    schedule: {
      ...MACHINE_SCHEDULE,
      readyOn: null,
      milestones: [
        { quality: 'silver', on: day('spring', 5) },
        { quality: 'gold', on: day('spring', 12) },
      ],
      status: 'aging',
    },
  });

  it('should return the quality reached on that day', () => {
    expect(milestoneReachedOn(cask, day('spring', 5))).toBe('silver');
    expect(milestoneReachedOn(cask, day('spring', 12))).toBe('gold');
  });

  it('should return null on other days and for batches without schedule', () => {
    expect(milestoneReachedOn(cask, day('spring', 6))).toBeNull();
    expect(milestoneReachedOn(INVALID_MACHINE, day('spring', 5))).toBeNull();
  });
});

describe('toMachineBatchIn / recollectBody', () => {
  it('should drop id and schedule', () => {
    const body = toMachineBatchIn(machineBatch());
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('schedule');
    expect(body.machineId).toBe('keg');
  });

  it('should restart the batch today', () => {
    expect(recollectBody(machineBatch(), day('fall', 2))).toEqual({
      ...toMachineBatchIn(machineBatch()),
      startedOn: day('fall', 2),
    });
  });
});

describe('machineBatchNames', () => {
  it('should localize the machine and product names', () => {
    expect(machineBatchNames(machineBatch(), MACHINES, 'pt-BR')).toEqual({
      machine: 'Barril',
      output: 'Vinho Teste',
      kind: 'batch',
    });
  });

  it('should fall back to the ids for unknown entries', () => {
    expect(
      machineBatchNames(
        { machineId: 'old-machine', outputId: 'old-output' },
        MACHINES,
        'pt-BR',
      ),
    ).toEqual({
      machine: 'Old Machine',
      output: 'Old Output',
      kind: undefined,
    });
  });
});

describe('invalid machine batches (no schedule)', () => {
  it('should never be actionable when the batch is invalid', () => {
    expect(isMachineActionable(INVALID_MACHINE)).toBe(false);
  });

  it('should have no dates, markers or next date when the batch is invalid', () => {
    expect(machineDates(INVALID_MACHINE)).toEqual([]);
    expect(machineMarkers([INVALID_MACHINE], MACHINES, 'pt-BR')).toEqual([]);
    expect(nextMachineDate(INVALID_MACHINE, day('summer', 1))).toBeNull();
  });

  it('should strip invalid from the request body when converting to MachineBatchIn', () => {
    const body = toMachineBatchIn(INVALID_MACHINE);
    expect(body).not.toHaveProperty('invalid');
    expect(body).not.toHaveProperty('schedule');
    expect(recollectBody(INVALID_MACHINE, day('summer', 2))).not.toHaveProperty(
      'invalid',
    );
  });

  describe('machineMarkers icon', () => {
    it('should carry the machine id when building markers', () => {
      const [marker] = machineMarkers(
        [
          machineBatch({
            schedule: {
              ...MACHINE_SCHEDULE,
              readyOn: { year: 1, season: 'spring', day: 3 },
            },
          }),
        ],
        MACHINES,
        'pt-BR',
      );
      expect(marker.machineId).toBe('keg');
    });
  });
});
