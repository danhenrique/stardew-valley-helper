import type { ReactNode } from 'react';
import { CARD } from './styles';

// Adapted from the Tailwind CSS docs, "Adding a pulse animation"
// (https://tailwindcss.com/docs/animation#adding-a-pulse-animation): gray bars that fade in and out.
// `motion-safe:` keeps them still for people who prefer reduced motion.

const BAR = 'rounded bg-gray-200 dark:bg-white/10';

/** One placeholder bar; `className` sets its size. */
export const SkeletonBar = ({
  className = 'h-2',
  testId = 'skeleton-bar',
}: {
  className?: string;
  testId?: string;
}) => <div data-testid={testId} className={`${BAR} ${className}`} />;

/** Loading placeholder; `label` is read by screen readers instead of the bars. */
export const Skeleton = ({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) => (
  <div
    role="status"
    aria-busy="true"
    className={`motion-safe:animate-pulse ${className}`}
  >
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">{children}</div>
  </div>
);

/** Placeholder list rows, without the status wrapper (for composing page skeletons). */
export const SkeletonRows = ({ rows }: { rows: number }) => (
  <ul className="divide-y divide-gray-100 dark:divide-white/5">
    {Array.from({ length: rows }, (_, index) => (
      <li
        key={index}
        data-testid="skeleton-row"
        className="flex items-center gap-x-3 py-4"
      >
        <SkeletonBar className="size-6 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonBar className="h-2.5 w-2/5" />
          <SkeletonBar className="h-2 w-3/5" />
        </div>
      </li>
    ))}
  </ul>
);

/** Rows of a stacked list: an icon and two lines each. */
export const SkeletonList = ({
  label,
  rows = 3,
}: {
  label: string;
  rows?: number;
}) => (
  <Skeleton label={label}>
    <SkeletonRows rows={rows} />
  </Skeleton>
);

/** Tiles of a grid list: an icon over two lines each, in the grid of OpenShops. */
export const SkeletonGrid = ({
  label,
  tiles = 4,
}: {
  label: string;
  tiles?: number;
}) => (
  <Skeleton label={label}>
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: tiles }, (_, index) => (
        <li
          key={index}
          data-testid="skeleton-tile"
          className="flex flex-col items-center gap-y-2 rounded-lg border border-gray-200 px-3 py-4 dark:border-white/10"
        >
          <SkeletonBar className="size-12 rounded-md" />
          <SkeletonBar className="h-2.5 w-3/4" />
          <SkeletonBar className="h-2 w-1/2" />
        </li>
      ))}
    </ul>
  </Skeleton>
);

/** Compact cards (icon block + name) in the two-column grid of the gift tastes. */
export const SkeletonCards = ({
  label,
  cards = 4,
}: {
  label: string;
  cards?: number;
}) => (
  <Skeleton label={label}>
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {Array.from({ length: cards }, (_, index) => (
        <li
          key={index}
          data-testid="skeleton-card"
          className="flex rounded-md border border-gray-200 dark:border-white/10"
        >
          <div className="flex w-12 shrink-0 items-center justify-center border-r border-gray-200 py-3 dark:border-white/10">
            <SkeletonBar className="size-6 rounded" />
          </div>
          <div className="flex flex-1 items-center px-3">
            <SkeletonBar className="h-2.5 w-2/3" />
          </div>
        </li>
      ))}
    </ul>
  </Skeleton>
);

/** A card surface with a title bar and list rows. */
export const SkeletonCard = ({
  label,
  rows = 3,
}: {
  label: string;
  rows?: number;
}) => (
  <Skeleton label={label}>
    <SkeletonCardBody rows={rows} />
  </Skeleton>
);

/** Placeholder calendar cells, without the status wrapper: a row of 7 from `sm` up, stacked on phones. */
export const SkeletonDays = ({ days }: { days: number }) => (
  <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md bg-gray-200 sm:grid-cols-7 dark:bg-white/10">
    {Array.from({ length: days }, (_, index) => (
      <div
        key={index}
        data-testid="skeleton-day"
        className="space-y-2 bg-white px-2 py-2 sm:min-h-20 dark:bg-gray-900"
      >
        <SkeletonBar className="h-2 w-6" />
        <SkeletonBar className="h-2 w-4/5" />
      </div>
    ))}
  </div>
);

/** A card surface with a title bar and rows, without the status wrapper. */
export const SkeletonCardBody = ({ rows }: { rows: number }) => (
  <div className={CARD}>
    <SkeletonBar className="h-3 w-1/4" testId="skeleton-title" />
    <SkeletonRows rows={rows} />
  </div>
);

/** Calendar day cells (7 for a week strip, 28 for a season). */
export const SkeletonCalendar = ({
  label,
  days,
}: {
  label: string;
  days: number;
}) => (
  <Skeleton label={label}>
    <SkeletonDays days={days} />
  </Skeleton>
);

/** Page heading bar followed by a card of rows: the shape of every list page. */
export const SkeletonPage = ({
  label,
  rows = 5,
}: {
  label: string;
  rows?: number;
}) => (
  <Skeleton label={label} className="space-y-8">
    <SkeletonBar className="h-7 w-1/3" />
    <SkeletonCardBody rows={rows} />
  </Skeleton>
);
