import clsx from 'clsx';
import { useState } from 'react';
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
  formatGoldTotal,
  loadSeedPrefs,
  type SeedPrefs,
  SORT_OPTIONS,
  saveSeedPrefs,
} from '../lib/seedValues';
import { NumberStepper } from './form/NumberStepper';
import { SegmentedButtons } from './form/SegmentedButtons';
import { SelectMenu } from './form/SelectMenu';
import { GameIcon } from './GameIcon';
import { SeasonTabs } from './SeasonTabs';
import { SkeletonBar } from './Skeleton';

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

type SeedCatalogProps = {
  plantables: PlantableOut[];
  initialSeason: Season;
  currentSeason: Season;
  currentDay: number;
  agriculturist: boolean;
};

const SeedValue = ({
  value,
  loading,
}: {
  value?: SeedValueOut;
  loading: boolean;
}) => {
  if (loading)
    return <SkeletonBar testId="seed-value-skeleton" className="h-3 w-16" />;
  if (value?.willNotMature)
    return (
      <p className="text-gray-500 dark:text-gray-400">Não amadurece a tempo</p>
    );
  if (value?.goldTotal == null || value.goldPerDayTenths == null)
    return <p className="text-gray-500 dark:text-gray-400">—</p>;
  return (
    <>
      <p className="font-semibold text-gray-900 dark:text-white">
        {formatGoldPerDay(value.goldPerDayTenths)}
      </p>
      <p className="text-gray-500 dark:text-gray-400">
        {formatGoldTotal(value.goldTotal, value.harvests)}
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
}: SeedCatalogProps) => {
  const [season, setSeason] = useState<Season>(initialSeason);
  const [period, setPeriod] = useState<Period>('today');
  const [prefs, setPrefs] = useState<SeedPrefs>(loadSeedPrefs);

  const isCurrentSeason = season === currentSeason;
  const effectivePeriod: Period = isCurrentSeason ? period : 'season';
  const values = useSeedValues({
    season,
    fromDay: effectivePeriod === 'today' ? currentDay : 1,
    fertilizer: prefs.fertilizer,
    farmingLevel: prefs.farmingLevel,
    agriculturist,
  });

  const updatePrefs = (change: Partial<SeedPrefs>) => {
    const next = { ...prefs, ...change };
    setPrefs(next);
    saveSeedPrefs(next);
  };

  const rows = buildSeedRows(
    filterPlantables(plantables, season, 'farm', 'planted'),
    values.isError ? undefined : values.data,
    prefs.sort,
  );

  return (
    <div className="space-y-6">
      <SeasonTabs value={season} onChange={setSeason} />
      <div
        data-testid="seed-controls"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <SegmentedButtons<Period>
          label="Período"
          value={effectivePeriod}
          onChange={setPeriod}
          options={[
            { value: 'season', label: 'Estação inteira' },
            {
              value: 'today',
              label: 'A partir de hoje',
              disabled: !isCurrentSeason,
            },
          ]}
        />
        <SelectMenu
          label="Fertilizante"
          value={prefs.fertilizer}
          options={FERTILIZER_OPTIONS}
          onChange={(fertilizer) => updatePrefs({ fertilizer })}
        />
        <NumberStepper
          label="Nível de Agricultura"
          value={prefs.farmingLevel}
          min={0}
          max={MAX_FARMING_LEVEL}
          onChange={(farmingLevel) => updatePrefs({ farmingLevel })}
        />
        <SelectMenu
          label="Ordenar por"
          value={prefs.sort}
          options={SORT_OPTIONS}
          onChange={(sort) => updatePrefs({ sort })}
        />
      </div>
      {values.isError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          Não foi possível calcular os valores.
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
            <div className="flex flex-1 items-center justify-between truncate rounded-r-md border-t border-r border-b border-gray-200 bg-white dark:border-white/10 dark:bg-gray-800/50">
              <div className="flex-1 truncate px-4 py-2 text-sm">
                <p className="font-medium text-gray-900 dark:text-white">
                  {name}
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  {describePlantable(plantable)}
                </p>
              </div>
              <div className="shrink-0 px-4 py-2 text-right text-sm">
                <SeedValue value={value} loading={values.isPending} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
