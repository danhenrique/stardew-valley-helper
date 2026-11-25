import clsx from 'clsx';
import { useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';
import type {
  PlantableOut,
  Season,
  SeedValueOut,
} from '../generated/stardew-valley-api/types.gen';
import { useSeedValues } from '../hooks/useGameData';
import { hasIcon } from '../lib/icons';
import { describePlantable, filterPlantables } from '../lib/plantables';
import {
  buildSeedRows,
  FERTILIZER_OPTIONS,
  formatGoldPerDay,
  formatGoldPerHarvest,
  formatGoldTotal,
  LOCATION_OPTIONS,
  loadSeedPrefs,
  MODE_OPTIONS,
  type SeedPrefs,
  type SeedSort,
  SORT_OPTIONS,
  saveSeedPrefs,
} from '../lib/seedValues';
import { NumberStepper } from './form/NumberStepper';
import { SegmentedButtons } from './form/SegmentedButtons';
import { SelectMenu } from './form/SelectMenu';
import { GameIcon } from './GameIcon';
import { type SeasonOrAll, SeasonTabs } from './SeasonTabs';
import { SeedDestinations } from './SeedDestinations';
import { SkeletonBar } from './Skeleton';
import { useLabels } from './useLabels';

// Cards adapted from Tailwind Plus lists/grid-lists/03-simple-cards.jsx
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(-2)
    .map((word) => word[0]?.toUpperCase())
    .join('');

type Period = 'season' | 'today';

const MAX_FARMING_LEVEL = 10;

/** Without a window there is no "gold in the period" to sort by. */
const CONTINUOUS_SORT_OPTIONS = SORT_OPTIONS.filter(
  (option) => option.value !== 'goldTotal',
);

type SeedCatalogProps = {
  plantables: PlantableOut[];
  initialSeason: Season;
  currentSeason: Season;
  currentDay: number;
  agriculturist: boolean;
  artisan: boolean;
};

const SeedValue = ({
  value,
  loading,
}: {
  value?: SeedValueOut;
  loading: boolean;
}) => {
  const locale = useLocale();
  const labels = useLabels();
  const t = useTranslations('seeds');
  if (loading)
    return <SkeletonBar testId="seed-value-skeleton" className="h-3 w-16" />;
  if (value?.willNotMature)
    return (
      <p className="text-gray-500 dark:text-gray-400">{t('willNotMature')}</p>
    );
  if (value?.goldTotal == null || value.goldPerDayTenths == null)
    return <p className="text-gray-500 dark:text-gray-400">—</p>;
  return (
    <>
      <p className="font-semibold text-gray-900 dark:text-white">
        {labels.text(formatGoldPerDay(value.goldPerDayTenths, locale))}
      </p>
      <p className="text-gray-500 dark:text-gray-400">
        {value.cycleDays != null
          ? labels.text(
              formatGoldPerHarvest(value.goldTotal, value.cycleDays, locale),
            )
          : labels.text(
              formatGoldTotal(value.goldTotal, value.harvests, locale),
            )}
      </p>
    </>
  );
};

export const SeedCatalog = ({
  plantables,
  initialSeason,
  currentSeason,
  currentDay,
  agriculturist,
  artisan,
}: SeedCatalogProps) => {
  const labels = useLabels();
  const t = useTranslations('seeds');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [season, setSeason] = useState<SeasonOrAll>(initialSeason);
  const [period, setPeriod] = useState<Period>('today');
  const [prefs, setPrefs] = useState<SeedPrefs>(loadSeedPrefs);

  const onFarm = prefs.location === 'farm';
  const farmSeason = onFarm && season !== 'all' ? season : undefined;
  const mode = onFarm ? 'window' : prefs.mode;
  const continuous = mode === 'continuous';
  const isCurrentSeason = farmSeason === currentSeason;
  const effectivePeriod: Period = isCurrentSeason ? period : 'season';
  const sort: SeedSort =
    continuous && prefs.sort === 'goldTotal' ? 'goldPerDay' : prefs.sort;
  const values = useSeedValues({
    ...(farmSeason && { season: farmSeason }),
    fromDay: effectivePeriod === 'today' ? currentDay : 1,
    fertilizer: prefs.fertilizer,
    farmingLevel: prefs.farmingLevel,
    agriculturist,
    artisan,
    location: prefs.location,
    mode,
  });

  const updatePrefs = (change: Partial<SeedPrefs>) => {
    const next = { ...prefs, ...change };
    setPrefs(next);
    saveSeedPrefs(next);
  };

  const rows = buildSeedRows(
    farmSeason
      ? filterPlantables(plantables, farmSeason, 'farm', 'planted')
      : plantables,
    values.isError ? undefined : values.data,
    sort,
    locale,
  );

  return (
    <div className="space-y-6">
      <div className="max-w-md">
        <SegmentedButtons
          label={tc('location')}
          value={prefs.location}
          onChange={(location) => updatePrefs({ location })}
          options={labels.options(LOCATION_OPTIONS)}
        />
      </div>
      {onFarm && <SeasonTabs withAll value={season} onChange={setSeason} />}
      <div
        data-testid="seed-controls"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {onFarm ? (
          <SegmentedButtons<Period>
            label={t('period')}
            value={effectivePeriod}
            onChange={setPeriod}
            options={[
              { value: 'season', label: t('periodSeason') },
              {
                value: 'today',
                label: t('periodToday'),
                disabled: !isCurrentSeason,
              },
            ]}
          />
        ) : (
          <SegmentedButtons
            label={t('mode')}
            value={prefs.mode}
            onChange={(next) => updatePrefs({ mode: next })}
            options={labels.options(MODE_OPTIONS)}
          />
        )}
        <SelectMenu
          label={t('fertilizer')}
          value={prefs.fertilizer}
          options={labels.options(FERTILIZER_OPTIONS)}
          onChange={(fertilizer) => updatePrefs({ fertilizer })}
        />
        <NumberStepper
          label={t('farmingLevel')}
          value={prefs.farmingLevel}
          min={0}
          max={MAX_FARMING_LEVEL}
          onChange={(farmingLevel) => updatePrefs({ farmingLevel })}
        />
        <SelectMenu
          label={t('sortBy')}
          value={sort}
          options={labels.options(
            continuous ? CONTINUOUS_SORT_OPTIONS : SORT_OPTIONS,
          )}
          onChange={(next) => updatePrefs({ sort: next })}
        />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('machinesNote')}
      </p>
      {values.isError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {t('calcError')}
        </p>
      )}
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {rows.map(({ plantable, name, value }) => (
          <li
            key={plantable.id}
            className="col-span-1 flex rounded-md shadow-xs dark:shadow-none"
          >
            <div
              className={clsx(
                plantable.kind === 'fruit_tree'
                  ? 'bg-amber-600'
                  : 'bg-green-600',
                'flex w-16 shrink-0 items-center justify-center rounded-l-md text-sm font-medium text-white',
              )}
            >
              {hasIcon(plantable.id) ? (
                <GameIcon id={plantable.id} label={name} size="lg" />
              ) : (
                initials(name)
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col rounded-r-md border-t border-r border-b border-gray-200 bg-white dark:border-white/10 dark:bg-gray-800/50">
              <div className="flex flex-1 items-center justify-between truncate">
                <div className="flex-1 truncate px-4 py-2 text-sm">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {name}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {labels.text(describePlantable(plantable))}
                  </p>
                </div>
                <div className="shrink-0 px-4 py-2 text-right text-sm">
                  <SeedValue value={value} loading={values.isPending} />
                </div>
              </div>
              {value && !value.willNotMature && (
                <SeedDestinations value={value} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
