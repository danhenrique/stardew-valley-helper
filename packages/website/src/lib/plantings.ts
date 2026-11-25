import type {
  Anchor,
  GameDateIn,
  Location,
  PlantableOut,
  PlantingIn,
  PlantingOut,
  ScheduleOut,
} from '../generated/stardew-valley-api/types.gen';
import { gameDateMessage, type PlantingStatus } from './i18n';
import { daysBetween } from './machines';
import { type MessageRef, message } from './message';
import { filterPlantables } from './plantables';

/** Why the chosen seed cannot be planted this way, or null when it can. */
export const plantingIssue = (
  plantable: PlantableOut | undefined,
  input: { date: GameDateIn; location: Location; anchor: Anchor },
): MessageRef | null => {
  if (!plantable) return message('errors.planting.chooseSeed');
  const allowed = filterPlantables(
    [plantable],
    input.date.season,
    input.location,
    input.anchor,
  ).length;
  if (allowed) return null;
  if (input.anchor === 'harvested')
    return plantable.kind === 'crop' && plantable.regrowDays != null
      ? message('errors.planting.outOfSeason')
      : message('errors.planting.onlyRegrowing');
  return message('errors.planting.outOfSeason');
};

const ENDED_STATUSES = new Set<PlantingStatus>(['dead', 'finished']);

/**
 * A crop can be replanted today where it was, when the season allows: a non-regrowing crop
 * (ready, dead or finished) or a regrowing crop that is dead or finished. Never a fruit tree,
 * nor an invalid planting (no schedule: its seed left the game data).
 */
export const canReplant = (
  planting: PlantingOut,
  plantable: PlantableOut | undefined,
  today: GameDateIn,
): boolean =>
  planting.schedule != null &&
  plantable?.kind === 'crop' &&
  (plantable.regrowDays == null ||
    ENDED_STATUSES.has(planting.schedule.status)) &&
  plantingIssue(plantable, {
    date: today,
    location: planting.location ?? 'farm',
    anchor: 'planted',
  }) === null;

export const toPlantingIn = (planting: PlantingOut): PlantingIn => {
  const { id: _id, schedule: _schedule, invalid: _invalid, ...body } = planting;
  return body;
};

export const replantBody = (
  planting: PlantingOut,
  today: GameDateIn,
): PlantingIn => ({
  ...toPlantingIn(planting),
  anchor: 'planted',
  plantedOn: today,
  lastHarvestOn: null,
});

/** "today", "tomorrow", "in 8 days", "yesterday" or "9 days ago", counted from `today`. */
export const relativeDay = (
  today: GameDateIn,
  date: GameDateIn,
): MessageRef => {
  const days = daysBetween(today, date);
  if (days === 0) return message('labels.relativeDay.today');
  if (days === 1) return message('labels.relativeDay.tomorrow');
  if (days === -1) return message('labels.relativeDay.yesterday');
  return days > 1
    ? message('labels.relativeDay.inDays', { days })
    : message('labels.relativeDay.daysAgo', { days: -days });
};

const neverMatures = () => message('labels.neverMatures');

/** "Spring 9, Year 1 (in 8 days)" for the first harvest, or why there is none. */
export const describeFirstHarvest = (
  schedule: ScheduleOut,
  today: GameDateIn,
): MessageRef =>
  schedule.firstHarvest
    ? message('labels.firstHarvest', {
        date: gameDateMessage(schedule.firstHarvest),
        relative: relativeDay(today, schedule.firstHarvest),
      })
    : neverMatures();

export const summarizeSchedule = (
  schedule: ScheduleOut,
  today: GameDateIn,
): MessageRef => {
  if (!schedule.firstHarvest) return neverMatures();
  const harvests = schedule.infinite
    ? message('labels.harvests.endless')
    : message('labels.harvests.count', { count: schedule.totalHarvests });
  return message('labels.scheduleSummary', {
    firstHarvest: describeFirstHarvest(schedule, today),
    harvests,
  });
};

export const isActionable = (planting: PlantingOut): boolean =>
  planting.schedule?.status === 'ready';
