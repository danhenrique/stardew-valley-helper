import {
  BERRY_PLANTING,
  MACHINE_SCHEDULE,
  MACHINES,
  machineBatch,
  NAMES,
  TEST_FESTIVAL,
  TEST_VILLAGER,
} from '../components/testData';
import { calendarMarkers } from './calendarMarkers';
import { buildEvents } from './events';
import { machineMarkers } from './machines';

const EVENTS = buildEvents({
  festivals: [TEST_FESTIVAL],
  villagers: [TEST_VILLAGER],
  foraging: [],
  plantables: [],
});
const harvestDay = BERRY_PLANTING.schedule?.harvests[0];
const KEG = machineBatch({
  schedule: { ...MACHINE_SCHEDULE, readyOn: harvestDay ?? null },
});
const INPUT = {
  events: EVENTS,
  plantings: [BERRY_PLANTING],
  names: NAMES,
  machineMarkers: machineMarkers([KEG], MACHINES),
};

describe('calendarMarkers', () => {
  it('should list events, then harvests, then machines of the day', () => {
    if (!harvestDay) throw new Error('fixture without harvest');
    const markers = calendarMarkers(harvestDay, {
      ...INPUT,
      events: buildEvents({
        festivals: [],
        villagers: [
          {
            ...TEST_VILLAGER,
            attributes: {
              ...TEST_VILLAGER.attributes,
              birthday: { season: harvestDay.season, day: harvestDay.day },
            },
          },
        ],
        foraging: [],
        plantables: [],
      }),
    });
    expect(markers.map((m) => m.target.kind)).toEqual([
      'event',
      'harvest',
      'machine',
    ]);
    expect(markers[1].label).toBe('Sementes de Fruta');
  });

  it('should carry the event of an event marker', () => {
    const [marker] = calendarMarkers(
      { year: 1, season: 'spring', day: 5 },
      INPUT,
    );
    expect(marker.target).toEqual({
      kind: 'event',
      event: EVENTS.find((e) => e.kind === 'birthday'),
    });
  });

  it('should match harvests and machines on the full date, year included', () => {
    if (!harvestDay) throw new Error('fixture without harvest');
    const nextYear = { ...harvestDay, year: harvestDay.year + 1 };
    expect(
      calendarMarkers(nextYear, INPUT).filter((m) => m.target.kind !== 'event'),
    ).toEqual([]);
  });
});
