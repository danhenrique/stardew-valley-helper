import type {
  Anchor,
  GameDateIn,
  Location,
  PlantableOut,
  PlantingIn,
  PlantingOut,
  ScheduleOut,
} from '../generated/stardew-valley-api/types.gen';
import { formatGameDate, type PlantingStatus } from './i18n';
import { daysBetween } from './machines';
import { filterPlantables } from './plantables';

/** Why the chosen seed cannot be planted this way (pt-BR), or null when it can. */
export const plantingIssue = (
  plantable: PlantableOut | undefined,
  input: { date: GameDateIn; location: Location; anchor: Anchor },
): string | null => {
  if (!plantable) return 'Escolha uma semente ou muda';
  const allowed = filterPlantables(
    [plantable],
    input.date.season,
    input.location,
    input.anchor,
  ).length;
  if (allowed) return null;
  if (input.anchor === 'harvested')
    return plantable.kind === 'crop' && plantable.regrowDays != null
      ? 'Fora da estação na Fazenda — use Estufa ou Ilha'
      : 'Só cultivos que rebrotam podem partir de uma colheita';
  return 'Fora da estação na Fazenda — use Estufa ou Ilha';
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

/** "hoje", "amanhã", "daqui a 8 dias", "ontem" or "há 9 dias", counted from `today`. */
export const relativeDay = (today: GameDateIn, date: GameDateIn): string => {
  const days = daysBetween(today, date);
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days === -1) return 'ontem';
  return days > 1 ? `daqui a ${days} dias` : `há ${-days} dias`;
};

/** "Primavera 9, Ano 1 (daqui a 8 dias)" for the first harvest, or why there is none. */
export const describeFirstHarvest = (
  schedule: ScheduleOut,
  today: GameDateIn,
): string =>
  schedule.firstHarvest
    ? `${formatGameDate(schedule.firstHarvest)} (${relativeDay(today, schedule.firstHarvest)})`
    : NEVER_MATURES;

const NEVER_MATURES = 'Não amadurece antes do fim da estação';

export const summarizeSchedule = (
  schedule: ScheduleOut,
  today: GameDateIn,
): string => {
  if (!schedule.firstHarvest) return NEVER_MATURES;
  const harvests = schedule.infinite
    ? 'colheitas sem fim'
    : `${schedule.totalHarvests} ${schedule.totalHarvests === 1 ? 'colheita' : 'colheitas'}`;
  return `Pronto em ${describeFirstHarvest(schedule, today)} · ${harvests}`;
};

export const isActionable = (planting: PlantingOut): boolean =>
  planting.schedule?.status === 'ready';
