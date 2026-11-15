import type {
  Fertilizer,
  GameDateIn,
  Location,
  MachineScheduleOut,
  Quality,
  ScheduleOut,
  Season,
} from '../generated/stardew-valley-api/types.gen';
import type { EventKind } from './events';
import type { Weekday } from './gameDate';
import type { MachineMarkerKind } from './machines';

// The generator names the planting and machine status unions `Status1` and `Status`
// (unstable under collisions), so derive them from the schedules instead.
export type PlantingStatus = ScheduleOut['status'];
export type MachineStatus = MachineScheduleOut['status'];

type LocalizedName =
  | { en?: string | null; ptBr?: string | null }
  | null
  | undefined;

export const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Primavera',
  summer: 'Verão',
  fall: 'Outono',
  winter: 'Inverno',
};

// Fertilizer names come from the game data (API); only the empty option is local.
export const NO_FERTILIZER_LABEL = 'Nenhum';

export const FERTILIZER_SPEED_LABELS: Record<Fertilizer, string> = {
  none: 'Sem bônus',
  'speed-gro': '−10%',
  'deluxe-speed-gro': '−25%',
  'hyper-speed-gro': '−33%',
};

export const LOCATION_LABELS: Record<Location, string> = {
  farm: 'Fazenda',
  greenhouse: 'Estufa',
  'ginger-island': 'Ilha Gengibre',
};

export const STATUS_LABELS: Record<PlantingStatus, string> = {
  growing: 'Crescendo',
  ready: 'Pronta',
  regrowing: 'Rebrotando',
  finished: 'Finalizada',
  dead: 'Morta',
};

export const QUALITY_LABELS: Record<Quality, string> = {
  normal: 'Normal',
  silver: 'Prata',
  gold: 'Ouro',
  iridium: 'Irídio',
};

export const MACHINE_STATUS_LABELS: Record<MachineStatus, string> = {
  processing: 'Processando',
  ready: 'Pronto',
  aging: 'Envelhecendo',
  iridium: 'Irídio',
};

export const WARNING_LABELS: Record<string, string> = {
  will_not_mature: 'Não amadurece antes do fim da estação.',
  approximate: 'Cálculo aproximado para esta semente.',
};

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  festival: 'Festival',
  birthday: 'Aniversário',
  cropDeadline: 'Prazo de plantio',
  foraging: 'Coleta',
};

export const MACHINE_MARKER_LABELS: Record<MachineMarkerKind, string> = {
  machine: 'Máquina',
  caskMilestone: 'Barril de Madeira',
};

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'seg',
  tue: 'ter',
  wed: 'qua',
  thu: 'qui',
  fri: 'sex',
  sat: 'sáb',
  sun: 'dom',
};

/** Plural names, for "Fecha às segundas". */
export const WEEKDAY_NAMES: Record<Weekday, string> = {
  mon: 'segundas',
  tue: 'terças',
  wed: 'quartas',
  thu: 'quintas',
  fri: 'sextas',
  sat: 'sábados',
  sun: 'domingos',
};

export const localizedName = (name: LocalizedName): string =>
  name?.ptBr ?? name?.en ?? '';

/** "Primavera 9" or "Primavera 9–10" for multi-day events. */
export const formatEventDays = (event: {
  season: Season;
  day: number;
  endDay?: number;
}): string =>
  `${SEASON_LABELS[event.season]} ${event.day}${
    event.endDay === undefined ? '' : `–${event.endDay}`
  }`;

/** Placeholder for item names until real names are available: "golden-pumpkin" -> "Golden Pumpkin". */
export const humanizeId = (id: string): string =>
  id
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const formatGameDate = (date: GameDateIn): string =>
  `${SEASON_LABELS[date.season]} ${date.day}, Ano ${date.year}`;

const NUMBER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const formatAmount = (value: number): string => NUMBER.format(value);

/** "≈ 40,8 no total (20,4 por colheita)" or "≈ 20,4 por colheita" for open-ended schedules. */
export const formatExpectedYield = (
  perHarvest: number,
  total: number | null | undefined,
): string =>
  total == null
    ? `≈ ${formatAmount(perHarvest)} por colheita`
    : `≈ ${formatAmount(total)} no total (${formatAmount(perHarvest)} por colheita)`;
