import { useLocale, useTranslations } from 'use-intl';
import type { GameDateIn } from '../generated/stardew-valley-api/types.gen';
import { useShopOffers } from '../hooks/useGameData';
import { localizedName } from '../lib/i18n';
import { offersOn } from '../lib/shopCatalog';
import type { Shop, ShopStatus } from '../lib/shops';
import { LocaleLink } from './LocaleLink';
import { Modal } from './Modal';
import { ShopCatalog } from './ShopCatalog';
import { SkeletonList } from './Skeleton';
import { useLabels } from './useLabels';

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
  const locale = useLocale();
  const labels = useLabels();
  const t = useTranslations('shops');
  const { status: offersStatus, offers } = useShopOffers(shop.id, open);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={localizedName(shop.name, locale)}
      subtitle={[
        status.hours.join(', '),
        ...status.notes.map((note) => labels.text(note)),
      ]
        .filter(Boolean)
        .join(' · ')}
      footer={
        <LocaleLink
          to="/{-$locale}/shops/$id"
          params={{ id: shop.id }}
          className="text-sm font-semibold text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
        >
          {t('viewCatalog')}
        </LocaleLink>
      }
    >
      {offersStatus === 'pending' ? (
        <SkeletonList label={t('loadingCatalog')} rows={5} />
      ) : offersStatus === 'error' ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          {t('catalogError')}
        </p>
      ) : (
        <ShopCatalog offers={offersOn(offers, today)} date={today} />
      )}
    </Modal>
  );
};
