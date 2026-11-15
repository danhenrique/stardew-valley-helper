import type { ReactNode } from 'react';
import type { CalendarMarker } from '../lib/calendarMarkers';
import { hasIcon } from '../lib/icons';
import { GameIcon } from './GameIcon';

// Adapted from Tailwind Plus data-display/calendars/02-month-view.jsx (one day cell).

const MarkerContent = ({ marker }: { marker: CalendarMarker }) => (
  <>
    {marker.iconId && hasIcon(marker.iconId) ? (
      <GameIcon id={marker.iconId} label={marker.label} size="sm" />
    ) : (
      marker.Icon && (
        <marker.Icon aria-hidden="true" className="size-3 shrink-0" />
      )
    )}
    <span className="sr-only">{`${marker.kindLabel}: `}</span>
    <span className="truncate">{marker.label}</span>
  </>
);

/** A calendar day: its header (day number or date label) and every marker of the day. */
export const CalendarDayCell = ({
  header,
  isToday,
  markers,
  testId,
  renderMarker,
}: {
  header: ReactNode;
  isToday: boolean;
  markers: readonly CalendarMarker[];
  testId?: string;
  /** Wraps a marker's content, e.g. in a link or a button; plain text by default. */
  renderMarker?: (marker: CalendarMarker, content: ReactNode) => ReactNode;
}) => (
  <div
    data-testid={testId}
    data-is-today={isToday ? '' : undefined}
    className="group relative min-h-20 bg-white px-2 py-2 dark:bg-gray-900"
  >
    {header}
    {markers.length > 0 && (
      <ol className="mt-1 space-y-0.5">
        {markers.map((marker) => {
          const content = <MarkerContent marker={marker} />;
          return (
            <li
              key={marker.key}
              className={`flex items-center gap-1 rounded-sm px-1 font-medium ${marker.color}`}
            >
              {renderMarker ? renderMarker(marker, content) : content}
            </li>
          );
        })}
      </ol>
    )}
  </div>
);
