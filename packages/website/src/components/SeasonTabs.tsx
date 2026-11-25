import { ChevronDownIcon } from '@heroicons/react/16/solid';
import clsx from 'clsx';
import { useTranslations } from 'use-intl';
import type { Season } from '../generated/stardew-valley-api/types.gen';
import { SEASONS } from '../lib/i18n';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus navigation/tabs/03-tabs-in-pills.jsx (buttons instead of links: tabs filter in place)
export type SeasonOrAll = Season | 'all';

type SeasonTabsProps =
  | { value: Season; onChange: (season: Season) => void; withAll?: false }
  | {
      value: SeasonOrAll;
      onChange: (season: SeasonOrAll) => void;
      /** Adds a first "All" tab. */
      withAll: true;
    };

export const SeasonTabs = (props: SeasonTabsProps) => {
  const { value, withAll } = props;
  const labels = useLabels();
  const t = useTranslations('common');
  const onChange = props.onChange as (season: SeasonOrAll) => void;
  const tabs: { id: SeasonOrAll; label: string }[] = [
    ...(withAll ? [{ id: 'all' as const, label: t('all') }] : []),
    ...SEASONS.map((season) => ({ id: season, label: labels.season(season) })),
  ];
  return (
    <div>
      <div className="grid grid-cols-1 sm:hidden">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as SeasonOrAll)}
          aria-label={t('chooseSeason')}
          className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-2 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 dark:bg-white/5 dark:text-gray-100 dark:outline-white/10 dark:*:bg-gray-800 dark:focus:outline-green-500"
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end fill-gray-500 dark:fill-gray-400"
        />
      </div>
      <div className="hidden sm:block">
        <nav aria-label={t('seasons')} className="flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={value === tab.id ? 'page' : undefined}
              className={clsx(
                value === tab.id
                  ? 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                'rounded-md px-3 py-2 text-sm font-medium',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};
