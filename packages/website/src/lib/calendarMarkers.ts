import {
  BeakerIcon,
  CakeIcon,
  ClockIcon,
  SparklesIcon,
  StarIcon,
  SunIcon,
} from '@heroicons/react/16/solid';
import type {
  GameDateIn,
  PlantingOut,
} from '../generated/stardew-valley-api/types.gen';
import {
  type EventKind,
  eventIconId,
  eventsOn,
  type FixedEvent,
} from './events';
import { sameDate } from './gameDate';
import {
  EVENT_KIND_LABELS,
  localizedName,
  MACHINE_MARKER_LABELS,
} from './i18n';
import type { MachineMarker, MachineMarkerKind } from './machines';

export const KIND_COLORS: Record<EventKind, string> = {
  festival:
    'bg-purple-50 text-purple-700 dark:bg-purple-400/10 dark:text-purple-300',
  birthday: 'bg-pink-50 text-pink-700 dark:bg-pink-400/10 dark:text-pink-300',
  cropDeadline:
    'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  foraging:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
};

export const KIND_ICONS: Record<EventKind, typeof SparklesIcon> = {
  festival: SparklesIcon,
  birthday: CakeIcon,
  cropDeadline: ClockIcon,
  foraging: SunIcon,
};

export const MACHINE_MARKER_ICONS: Record<
  MachineMarkerKind,
  typeof SparklesIcon
> = {
  machine: BeakerIcon,
  caskMilestone: StarIcon,
};

const MACHINE_MARKER_COLORS: Record<MachineMarkerKind, string> = {
  machine: 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300',
  caskMilestone:
    'bg-orange-50 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300',
};

export const HARVEST_COLOR =
  'bg-green-50 text-green-700 dark:bg-green-400/10 dark:text-green-300';
export const HARVEST_LABEL = 'Colheita';

export type MarkerTarget =
  | { kind: 'event'; event: FixedEvent }
  | { kind: 'harvest' }
  | { kind: 'machine' };

export type CalendarMarker = {
  key: string;
  label: string;
  kindLabel: string;
  color: string;
  Icon?: typeof SparklesIcon;
  /** Data id whose sprite replaces `Icon` when one exists. */
  iconId?: string;
  target: MarkerTarget;
};

export const machineMarkerText = (marker: MachineMarker) =>
  `${marker.name} · ${marker.label}`;

export const harvestLabel = (
  planting: PlantingOut,
  names: Record<string, string>,
) => planting.label || names[planting.seedId] || planting.seedId;

/** Every marker of one day: fixed events, then the player's harvests, then machine dates. */
export const calendarMarkers = (
  date: GameDateIn,
  input: {
    events: readonly FixedEvent[];
    plantings: readonly PlantingOut[];
    names: Record<string, string>;
    machineMarkers: readonly MachineMarker[];
  },
): CalendarMarker[] => [
  ...eventsOn([...input.events], date.season, date.day).map(
    (event): CalendarMarker => ({
      key: event.id,
      label: localizedName(event.name),
      kindLabel: EVENT_KIND_LABELS[event.kind],
      color: KIND_COLORS[event.kind],
      Icon: KIND_ICONS[event.kind],
      iconId: eventIconId(event),
      target: { kind: 'event', event },
    }),
  ),
  ...input.plantings
    .filter((planting) =>
      (planting.schedule?.harvests ?? []).some((h) => sameDate(h, date)),
    )
    .map(
      (planting): CalendarMarker => ({
        key: `harvest:${planting.id}`,
        label: harvestLabel(planting, input.names),
        kindLabel: HARVEST_LABEL,
        color: HARVEST_COLOR,
        iconId: planting.seedId,
        target: { kind: 'harvest' },
      }),
    ),
  ...input.machineMarkers
    .filter((marker) => sameDate(marker.date, date))
    .map(
      (marker): CalendarMarker => ({
        key: marker.key,
        label: machineMarkerText(marker),
        kindLabel: MACHINE_MARKER_LABELS[marker.kind],
        color: MACHINE_MARKER_COLORS[marker.kind],
        Icon: MACHINE_MARKER_ICONS[marker.kind],
        iconId: marker.machineId,
        target: { kind: 'machine' },
      }),
    ),
];
