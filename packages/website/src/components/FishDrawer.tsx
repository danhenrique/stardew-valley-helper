import { useLocale, useTranslations } from 'use-intl';
import type { FishOut } from '../generated/stardew-valley-api/types.gen';
import { formatWindow } from '../lib/fish';
import { localizedText } from '../lib/locale';
import { FishHours, fishName } from './FishCard';
import { ItemDrawer } from './ItemDrawer';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus overlays/drawers/05-with-sticky-footer.jsx (via ItemDrawer);
// details list from data-display/description-lists/01-left-aligned.jsx.

export const FishDrawer = ({
  fish,
  onClose,
}: {
  fish: FishOut | null;
  onClose: () => void;
}) => {
  const labels = useLabels();
  const t = useTranslations('fish');
  const tc = useTranslations('common');
  const locale = useLocale();
  return (
    <ItemDrawer
      open={fish !== null}
      title={fish ? fishName(fish, locale) : ''}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
        >
          {tc('close')}
        </button>
      }
    >
      {fish && (
        <dl className="divide-y divide-gray-100 text-sm dark:divide-white/10">
          {[
            [
              t('drawer.type'),
              t('drawer.typeValue', {
                category: t(`drawer.category.${fish.category}`),
                tool: t(`drawer.tool.${fish.tool}`),
              }),
            ],
            [tc('location'), localizedText(fish.location, locale) ?? '—'],
            [
              tc('seasons'),
              fish.seasons.map((s) => labels.season(s)).join(', '),
            ],
            [t('weather'), t(`drawer.weatherValue.${fish.weather}`)],
            [t('drawer.hours'), fish.windows.map(formatWindow).join(' · ')],
          ].map(([term, detail]) => (
            <div key={term} className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="font-medium text-gray-900 dark:text-white">
                {term}
              </dt>
              <dd className="mt-1 text-gray-700 sm:col-span-2 sm:mt-0 dark:text-gray-400">
                {detail}
              </dd>
            </div>
          ))}
          <div className="py-3">
            <FishHours fish={fish} />
          </div>
        </dl>
      )}
    </ItemDrawer>
  );
};
