import { SunIcon } from '@heroicons/react/20/solid';
import { CloudRain } from 'lucide-react';
import { useLocale, useTranslations } from 'use-intl';
import type { FishOut } from '../generated/stardew-valley-api/types.gen';
import { formatWindow, windowBar } from '../lib/fish';
import { hasIcon } from '../lib/icons';
import { type Locale, localizedText } from '../lib/locale';
import { GameIcon } from './GameIcon';
import { useLabels } from './useLabels';

// Card adapted from Tailwind Plus lists/grid-lists/03-simple-cards.jsx (same base as SeedCatalog);
// season badges from elements/badges/01-with-border.jsx.

export const fishName = (fish: FishOut, locale: Locale) =>
  localizedText(fish.name, locale) ?? fish.id;

export const FishWeatherIcon = ({ fish }: { fish: FishOut }) => {
  const t = useTranslations('fish');
  if (fish.weather === 'rain')
    return (
      <span title={t('rainOnly')} aria-label={t('rainOnly')} role="img">
        <CloudRain
          aria-hidden="true"
          className="size-4 text-sky-600 dark:text-sky-400"
        />
      </span>
    );
  if (fish.weather === 'sun')
    return (
      <span title={t('sunOnly')} aria-label={t('sunOnly')} role="img">
        <SunIcon aria-hidden="true" className="size-4 text-amber-500" />
      </span>
    );
  return null;
};

/** Hour bar from 06:00 to 02:00 with the catch windows filled; the text is the readable version. */
export const FishHours = ({ fish }: { fish: FishOut }) => (
  <div className="space-y-1">
    <div
      aria-hidden="true"
      className="relative h-1.5 rounded-full bg-gray-200 dark:bg-white/10"
    >
      {fish.windows.map((window) => {
        const { left, width } = windowBar(window);
        return (
          <span
            key={`${window.fromMinute}-${window.toMinute}`}
            data-testid="fish-window"
            className="absolute inset-y-0 rounded-full bg-green-600 dark:bg-green-500"
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        );
      })}
    </div>
    <p className="text-xs text-gray-500 dark:text-gray-400">
      {fish.windows.map(formatWindow).join(' · ')}
    </p>
  </div>
);

export const FishCard = ({
  fish,
  onSelect,
}: {
  fish: FishOut;
  onSelect?: (fish: FishOut) => void;
}) => {
  const labels = useLabels();
  const locale = useLocale();
  const name = fishName(fish, locale);
  const body = (
    <>
      <div className="flex w-16 shrink-0 items-center justify-center rounded-l-md bg-sky-700 text-sm font-medium text-white">
        {hasIcon(fish.id) ? (
          <GameIcon id={fish.id} label={name} size="lg" decorative />
        ) : (
          <span aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-r-md border-t border-r border-b border-gray-200 bg-white px-4 py-2 text-left text-sm dark:border-white/10 dark:bg-gray-800/50">
        <div className="flex items-center gap-x-2">
          <p className="truncate font-medium text-gray-900 dark:text-white">
            {name}
          </p>
          <FishWeatherIcon fish={fish} />
        </div>
        <p className="line-clamp-2 text-gray-500 dark:text-gray-400">
          {localizedText(fish.location, locale)}
        </p>
        <div className="flex flex-wrap gap-1">
          {fish.seasons.map((season) => (
            <span
              key={season}
              className="inline-flex items-center rounded-md bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600 inset-ring inset-ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:inset-ring-gray-400/20"
            >
              {labels.season(season)}
            </span>
          ))}
        </div>
        <FishHours fish={fish} />
      </div>
    </>
  );
  return onSelect ? (
    <button
      type="button"
      onClick={() => onSelect(fish)}
      className="flex w-full rounded-md shadow-xs hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:shadow-none"
    >
      {body}
    </button>
  ) : (
    <div className="flex rounded-md shadow-xs dark:shadow-none">{body}</div>
  );
};
