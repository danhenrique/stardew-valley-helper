import { createFileRoute } from '@tanstack/react-router';
import { FishCatalog } from '../components/FishCatalog';
import { SkeletonList } from '../components/Skeleton';
import { useFish, useMe } from '../hooks/useGameData';
import { loadFishPrefs } from '../lib/fish';

export const Route = createFileRoute('/peixes')({
  component: FishPage,
});

function FishPage() {
  const fish = useFish();
  const me = useMe();
  const profile = me.data?.profile;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Peixes
      </h1>
      {fish.isPending || me.isPending ? (
        <SkeletonList label="Carregando peixes..." rows={6} />
      ) : fish.isError || !fish.data ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          Não foi possível carregar os peixes. Recarregue a página.
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
