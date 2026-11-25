import { MagnifyingGlassIcon } from '@heroicons/react/16/solid';
import { useId, useState } from 'react';
import { useTranslations } from 'use-intl';
import type { FishOut } from '../generated/stardew-valley-api/types.gen';
import {
  type FishKindFilter,
  type FishPrefs,
  type FishSection,
  type FishWeatherFilter,
  filterFish,
  groupFish,
  KIND_OPTIONS,
  saveFishPrefs,
  WEATHER_OPTIONS,
} from '../lib/fish';
import { FishCard } from './FishCard';
import { FishDrawer } from './FishDrawer';
import { SegmentedButtons } from './form/SegmentedButtons';
import { SeasonTabs } from './SeasonTabs';
import { useLabels } from './useLabels';

// Search input adapted from Tailwind Plus forms/input-groups/07-input-with-leading-icon.jsx.

/** Fish sections with a heading and a card grid; shared by /fish and the rain modal. */
export const FishSectionList = ({
  sections,
  onSelect,
}: {
  sections: FishSection[];
  onSelect?: (fish: FishOut) => void;
}) => {
  const labels = useLabels();
  const t = useTranslations('fish');
  return (
    <div className="space-y-8">
      {sections.map((section) => {
        const title = t('sectionTitle', {
          title: labels.text(section.title),
          count: section.fish.length,
        });
        return (
          <section key={section.id} aria-label={title} className="space-y-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.fish.map((fish) => (
                <li key={fish.id} className="flex">
                  <FishCard fish={fish} onSelect={onSelect} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};

export const FishCatalog = ({
  fish,
  initialPrefs,
}: {
  fish: FishOut[];
  initialPrefs: FishPrefs;
}) => {
  const labels = useLabels();
  const t = useTranslations('fish');
  const searchId = useId();
  const [prefs, setPrefs] = useState<FishPrefs>(initialPrefs);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FishOut | null>(null);

  const updatePrefs = (change: Partial<FishPrefs>) => {
    const next = { ...prefs, ...change };
    setPrefs(next);
    saveFishPrefs(next);
  };

  const sections = groupFish(filterFish(fish, { ...prefs, query }));

  return (
    <div className="space-y-6">
      <SeasonTabs
        value={prefs.season}
        onChange={(season) => updatePrefs({ season })}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SegmentedButtons<FishWeatherFilter>
          label={t('weather')}
          value={prefs.weather}
          options={labels.options(WEATHER_OPTIONS)}
          onChange={(weather) => updatePrefs({ weather })}
        />
        <SegmentedButtons<FishKindFilter>
          label={t('kind')}
          value={prefs.kind}
          options={labels.options(KIND_OPTIONS)}
          onChange={(kind) => updatePrefs({ kind })}
        />
        <div>
          <label
            htmlFor={searchId}
            className="block text-sm/6 font-medium text-gray-900 dark:text-white"
          >
            {t('search')}
          </label>
          <div className="mt-2 grid grid-cols-1">
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="col-start-1 row-start-1 block w-full rounded-md bg-white py-1.5 pr-3 pl-10 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 sm:pl-9 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-green-500"
            />
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-gray-400 sm:size-4 dark:text-gray-500"
            />
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('unverified')}
      </p>
      {sections.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('empty')}</p>
      ) : (
        <FishSectionList sections={sections} onSelect={setSelected} />
      )}
      <FishDrawer fish={selected} onClose={() => setSelected(null)} />
    </div>
  );
};
