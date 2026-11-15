import { ChevronDownIcon } from '@heroicons/react/16/solid';
import clsx from 'clsx';
import type { Season } from '../generated/stardew-valley-api/types.gen';
import { SEASON_LABELS, SEASONS } from '../lib/i18n';

// Adapted from Tailwind Plus navigation/tabs/03-tabs-in-pills.jsx (buttons instead of links: tabs filter in place)
type SeasonTabsProps = { value: Season; onChange: (season: Season) => void };

export const SeasonTabs = ({ value, onChange }: SeasonTabsProps) => (
  <div>
    <div className="grid grid-cols-1 sm:hidden">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Season)}
        aria-label="Escolher estação"
        className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-2 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 dark:bg-white/5 dark:text-gray-100 dark:outline-white/10 dark:*:bg-gray-800 dark:focus:outline-green-500"
      >
        {SEASONS.map((season) => (
          <option key={season} value={season}>
            {SEASON_LABELS[season]}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end fill-gray-500 dark:fill-gray-400"
      />
    </div>
    <div className="hidden sm:block">
      <nav aria-label="Estações" className="flex space-x-4">
        {SEASONS.map((season) => (
          <button
            key={season}
            type="button"
            onClick={() => onChange(season)}
            aria-current={value === season ? 'page' : undefined}
            className={clsx(
              value === season
                ? 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              'rounded-md px-3 py-2 text-sm font-medium',
            )}
          >
            {SEASON_LABELS[season]}
          </button>
        ))}
      </nav>
    </div>
  </div>
);
