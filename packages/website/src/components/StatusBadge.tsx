import clsx from 'clsx';
import type { MachineStatus, PlantingStatus as Status } from '../lib/i18n';
import { MACHINE_STATUS_LABELS, STATUS_LABELS } from '../lib/i18n';

// Adapted from Tailwind Plus elements/badges/11-flat-pill-with-dot.jsx
type PillStyle = { badge: string; dot: string };

const STYLES: Record<Status, PillStyle> = {
  growing: {
    badge:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-500',
    dot: 'fill-yellow-500 dark:fill-yellow-400',
  },
  ready: {
    badge:
      'bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400',
    dot: 'fill-green-500 dark:fill-green-400',
  },
  regrowing: {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400',
    dot: 'fill-blue-500 dark:fill-blue-400',
  },
  finished: {
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-400/10 dark:text-gray-400',
    dot: 'fill-gray-400',
  },
  dead: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400',
    dot: 'fill-red-500 dark:fill-red-400',
  },
};

const Pill = ({ label, style }: { label: string; style: PillStyle }) => (
  <span
    className={clsx(
      'inline-flex items-center gap-x-1.5 rounded-full px-2 py-1 text-xs font-medium',
      style.badge,
    )}
  >
    <svg
      viewBox="0 0 6 6"
      aria-hidden="true"
      className={clsx('size-1.5', style.dot)}
    >
      <circle r={3} cx={3} cy={3} />
    </svg>
    {label}
  </span>
);

export const StatusBadge = ({ status }: { status: Status }) => (
  <Pill label={STATUS_LABELS[status]} style={STYLES[status]} />
);

const MACHINE_STYLES: Record<MachineStatus, PillStyle> = {
  processing: STYLES.growing,
  aging: STYLES.regrowing,
  ready: STYLES.ready,
  iridium: {
    badge:
      'bg-purple-100 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400',
    dot: 'fill-purple-500 dark:fill-purple-400',
  },
};

export const MachineStatusBadge = ({ status }: { status: MachineStatus }) => (
  <Pill label={MACHINE_STATUS_LABELS[status]} style={MACHINE_STYLES[status]} />
);

const UNAVAILABLE_STYLE: PillStyle = {
  badge:
    'bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-400',
  dot: 'fill-orange-500 dark:fill-orange-400',
};

/** A stored record whose seed, machine or product is no longer in the game data. */
export const UnavailableBadge = () => (
  <Pill label="Indisponível" style={UNAVAILABLE_STYLE} />
);
