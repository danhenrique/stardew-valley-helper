import { Link } from '@tanstack/react-router';
import { useState } from 'react';
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
import { ShopCatalog } from './ShopCatalog';
import { SkeletonList, SkeletonPage } from './Skeleton';
import { CARD } from './styles';

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
      ? ['Sem horário fixo', shop.access].filter(Boolean).join(' · ')
      : status.status === 'open'
        ? `Aberta · ${status.hours.join(', ')}`
        : `Fechada · ${status.reason}`;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-x-3">
        <GameIcon id={shop.id} label={localizedName(shop.name)} size="lg" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {localizedName(shop.name)}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {statusText}
          </p>
        </div>
      </div>
      <GameDatePicker value={date} onChange={onDateChange} />
      <section className={CARD}>
        {offersStatus === 'pending' ? (
          <SkeletonList label="Carregando catálogo..." rows={6} />
        ) : offersStatus === 'error' ? (
          <Notice error>Não foi possível carregar o catálogo.</Notice>
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
      <Link to="/lojas" className={LINK}>
        Ver todas as lojas
      </Link>
    </div>
  );
};

/** Catalog of one shop on a chosen date (the player's current date by default). */
export const ShopCatalogPage = ({ shopId }: { shopId: string }) => {
  const me = useMe();
  const shops = useShops();
  const [chosen, setChosen] = useState<GameDateIn | null>(null);

  if (me.isPending || shops.isPending) {
    return <SkeletonPage label="Carregando loja..." rows={6} />;
  }
  const today = me.data?.profile?.currentDate;
  if (me.isError || shops.isError || !today) {
    return <Notice error>Não foi possível carregar a loja.</Notice>;
  }
  const shop = shops.data?.find((s) => s.id === shopId);
  if (!shop) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          Loja não encontrada
        </p>
        <Link to="/lojas" className={LINK}>
          Ver todas as lojas
        </Link>
      </div>
    );
  }
  return (
    <Catalog shop={shop} date={chosen ?? today} onDateChange={setChosen} />
  );
};
