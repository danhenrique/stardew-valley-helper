import { useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';
import type { GameDateIn } from '../generated/stardew-valley-api/types.gen';
import {
  useFixedEvents,
  useMe,
  useShopOffers,
  useShops,
} from '../hooks/useGameData';
import { sameDate } from '../lib/gameDate';
import { localizedName } from '../lib/i18n';
import { cartTotals, offersOn } from '../lib/shopCatalog';
import { type Shop, shopStatusToday } from '../lib/shops';
import { CartFooter } from './CartFooter';
import { GameDatePicker } from './GameDatePicker';
import { GameIcon } from './GameIcon';
import { LocaleLink } from './LocaleLink';
import { ShopCatalog } from './ShopCatalog';
import { SkeletonList, SkeletonPage } from './Skeleton';
import { CARD } from './styles';
import { useLabels } from './useLabels';

const LINK =
  'text-sm font-semibold text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300';

const Notice = ({ error, children }: { error?: boolean; children: string }) => (
  <p
    className={
      error
        ? 'text-sm text-red-700 dark:text-red-400'
        : 'text-sm text-gray-500 dark:text-gray-400'
    }
  >
    {children}
  </p>
);

const Catalog = ({
  shop,
  date,
  onDateChange,
}: {
  shop: Shop;
  date: GameDateIn;
  onDateChange: (next: GameDateIn) => void;
}) => {
  const locale = useLocale();
  const labels = useLabels();
  const t = useTranslations('shops');
  const me = useMe();
  const events = useFixedEvents();
  const { status: offersStatus, offers } = useShopOffers(shop.id, true);
  // A purchase belongs to the offers of one date: when the date changes (picked here or
  // moved on by the game day), the quantities saved for another date no longer apply.
  const dateKey = `${date.year}-${date.season}-${date.day}`;
  const [cart, setCart] = useState<{ dateKey: string; quantities: number[] }>({
    dateKey,
    quantities: [],
  });
  const quantities = cart.dateKey === dateKey ? cart.quantities : [];
  const visible = offersOn(offers, date);
  const setQuantity = (index: number, qty: number) => {
    const next = [...quantities];
    next[index] = qty;
    setCart({ dateKey, quantities: next });
  };
  const clearCart = () => setCart({ dateKey, quantities: [] });
  const profile = me.data?.profile;
  // Rain is known only for the current game day, not for other dates picked here.
  const status = shopStatusToday(
    shop,
    date,
    events.data ?? [],
    profile
      ? {
          ...profile,
          rainToday:
            Boolean(profile.rainToday) && sameDate(date, profile.currentDate),
        }
      : {},
  );
  const statusText =
    status.status === 'always'
      ? shop.access
        ? t('status.alwaysAccess', { access: shop.access })
        : t('status.always')
      : status.status === 'open'
        ? t('status.open', { hours: status.hours.join(', ') })
        : t('status.closed', {
            reason: status.reason ? labels.text(status.reason) : '',
          });
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-x-3">
        <GameIcon
          id={shop.id}
          label={localizedName(shop.name, locale)}
          size="lg"
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {localizedName(shop.name, locale)}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {statusText}
          </p>
        </div>
      </div>
      <GameDatePicker value={date} onChange={onDateChange} />
      <section className={CARD}>
        {offersStatus === 'pending' ? (
          <SkeletonList label={t('loadingCatalog')} rows={6} />
        ) : offersStatus === 'error' ? (
          <Notice error>{t('catalogError')}</Notice>
        ) : (
          <ShopCatalog
            offers={visible}
            date={date}
            quantities={quantities}
            onQuantityChange={setQuantity}
          />
        )}
      </section>
      {offersStatus === 'success' && (
        <CartFooter
          totals={cartTotals(visible, quantities, date.year)}
          onClear={clearCart}
        />
      )}
      <LocaleLink to="/{-$locale}/shops" className={LINK}>
        {t('viewAll')}
      </LocaleLink>
    </div>
  );
};

/** Catalog of one shop on a chosen date (the player's current date by default). */
export const ShopCatalogPage = ({ shopId }: { shopId: string }) => {
  const t = useTranslations('shops');
  const me = useMe();
  const shops = useShops();
  const [chosen, setChosen] = useState<GameDateIn | null>(null);

  if (me.isPending || shops.isPending) {
    return <SkeletonPage label={t('loadingOne')} rows={6} />;
  }
  const today = me.data?.profile?.currentDate;
  if (me.isError || shops.isError || !today) {
    return <Notice error>{t('loadErrorOne')}</Notice>;
  }
  const shop = shops.data?.find((s) => s.id === shopId);
  if (!shop) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {t('notFound')}
        </p>
        <LocaleLink to="/{-$locale}/shops" className={LINK}>
          {t('viewAll')}
        </LocaleLink>
      </div>
    );
  }
  return (
    <Catalog shop={shop} date={chosen ?? today} onDateChange={setChosen} />
  );
};
