import { createFileRoute } from '@tanstack/react-router';
import { SeedCatalog } from '../components/SeedCatalog';
import { SkeletonList } from '../components/Skeleton';
import { useMe, usePlantables } from '../hooks/useGameData';

export const Route = createFileRoute('/sementes')({
  component: SeedsPage,
});

function SeedsPage() {
  const plantables = usePlantables();
  const me = useMe();
  const season = me.data?.profile.currentDate.season ?? 'spring';

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Sementes
      </h1>
      {plantables.isPending ? (
        <SkeletonList label="Carregando sementes..." rows={6} />
      ) : plantables.isError ? (
        <p className="text-sm text-red-700">
          Não foi possível carregar as sementes. Recarregue a página.
        </p>
      ) : (
        <SeedCatalog
          key={season}
          plantables={plantables.data}
          initialSeason={season}
          currentSeason={season}
          currentDay={me.data?.profile.currentDate.day ?? 1}
          agriculturist={me.data?.profile.agriculturist ?? false}
        />
      )}
    </div>
  );
}
