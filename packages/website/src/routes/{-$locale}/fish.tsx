import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { FishCatalog } from '../../components/FishCatalog';
import { SkeletonList } from '../../components/Skeleton';
import { useFish, useMe } from '../../hooks/useGameData';
import { loadFishPrefs } from '../../lib/fish';

export const Route = createFileRoute('/{-$locale}/fish')({
  component: FishPage,
});

function FishPage() {
  const t = useTranslations('fish');
  const fish = useFish();
  const me = useMe();
  const profile = me.data?.profile;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        {t('title')}
      </h1>
      {fish.isPending || me.isPending ? (
        <SkeletonList label={t('loading')} rows={6} />
      ) : fish.isError || !fish.data ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          {t('loadError')}
        </p>
      ) : (
        <FishCatalog
          fish={fish.data}
          initialPrefs={loadFishPrefs({
            season: profile?.currentDate.season ?? 'spring',
            weather: profile?.rainToday ? 'rain' : 'all',
            kind: 'all',
          })}
        />
      )}
    </div>
  );
}
