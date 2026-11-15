import { createFileRoute } from '@tanstack/react-router';
import { ShopTable } from '../components/ShopTable';
import { SkeletonPage } from '../components/Skeleton';
import { CARD } from '../components/styles';
import { useFixedEvents, useMe, useShops } from '../hooks/useGameData';

export const Route = createFileRoute('/lojas/')({
  component: ShopsPage,
});

function ShopsPage() {
  const me = useMe();
  const shops = useShops();
  const events = useFixedEvents();

  if (me.isPending || shops.isPending || events.isPending) {
    return <SkeletonPage label="Carregando lojas..." rows={8} />;
  }
  const profile = me.data?.profile;
  if (
    me.isError ||
    shops.isError ||
    events.isError ||
    !profile ||
    !shops.data
  ) {
    return (
      <p className="text-sm text-red-700 dark:text-red-400">
        Não foi possível carregar as lojas.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Lojas
      </h1>
      <section className={CARD}>
        <ShopTable
          shops={shops.data}
          today={profile.currentDate}
          events={events.data ?? []}
          progress={profile}
        />
      </section>
    </div>
  );
}
