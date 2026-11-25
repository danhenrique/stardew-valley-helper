import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { ShopGrid } from '../../components/ShopGrid';
import { SkeletonPage } from '../../components/Skeleton';
import { useFixedEvents, useMe, useShops } from '../../hooks/useGameData';

export const Route = createFileRoute('/{-$locale}/shops/')({
  component: ShopsPage,
});

function ShopsPage() {
  const t = useTranslations('shops');
  const me = useMe();
  const shops = useShops();
  const events = useFixedEvents();

  if (me.isPending || shops.isPending || events.isPending) {
    return <SkeletonPage label={t('loading')} rows={8} />;
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
      <p className="text-sm text-red-700 dark:text-red-400">{t('loadError')}</p>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        {t('title')}
      </h1>
      <ShopGrid
        shops={shops.data}
        today={profile.currentDate}
        events={events.data ?? []}
        progress={profile}
      />
    </div>
  );
}
