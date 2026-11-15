import { Link } from '@tanstack/react-router';
import type { GameDateIn } from '../generated/stardew-valley-api/types.gen';
import { useShopOffers } from '../hooks/useGameData';
import { localizedName } from '../lib/i18n';
import { offersOn } from '../lib/shopCatalog';
import type { Shop, ShopStatus } from '../lib/shops';
import { Modal } from './Modal';
import { ShopCatalog } from './ShopCatalog';
import { SkeletonList } from './Skeleton';

/** Today's catalog of an open shop, with a link to the full catalog page. */
export const ShopCatalogModal = ({
  shop,
  status,
  today,
  open,
  onClose,
}: {
  shop: Shop;
  status: ShopStatus;
  today: GameDateIn;
  open: boolean;
  onClose: () => void;
}) => {
  const { status: offersStatus, offers } = useShopOffers(shop.id, open);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={localizedName(shop.name)}
      subtitle={[status.hours.join(', '), ...status.notes]
        .filter(Boolean)
        .join(' · ')}
      footer={
        <Link
          to="/lojas/$id"
          params={{ id: shop.id }}
          className="text-sm font-semibold text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
        >
          Ver catálogo completo
        </Link>
      }
    >
      {offersStatus === 'pending' ? (
        <SkeletonList label="Carregando catálogo..." rows={5} />
      ) : offersStatus === 'error' ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          Não foi possível carregar o catálogo.
        </p>
      ) : (
        <ShopCatalog offers={offersOn(offers, today)} date={today} />
      )}
    </Modal>
  );
};
