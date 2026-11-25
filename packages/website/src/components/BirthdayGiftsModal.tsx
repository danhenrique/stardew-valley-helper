import { useLocale, useTranslations } from 'use-intl';
import { useVillagerGifts } from '../hooks/useGameData';
import type { FixedEvent } from '../lib/events';
import { isEmptyTastes } from '../lib/gifts';
import { localizedName } from '../lib/i18n';
import { GiftTastes } from './GiftTastes';
import { LocaleLink } from './LocaleLink';
import { Modal } from './Modal';
import { SkeletonCards } from './Skeleton';
import { useLabels } from './useLabels';

/** Every gift taste of a birthday's villager, with a link to the event page. */
export const BirthdayGiftsModal = ({
  event,
  open,
  onClose,
}: {
  event: FixedEvent | null;
  open: boolean;
  onClose: () => void;
}) => {
  const locale = useLocale();
  const t = useTranslations('today');
  const labels = useLabels();
  const { status, tastes } = useVillagerGifts(
    event?.refId ?? '',
    open && event !== null,
  );
  if (!event) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('birthdayOf', { name: localizedName(event.name, locale) })}
      subtitle={labels.eventDays(event)}
      footer={
        <LocaleLink
          to="/{-$locale}/events/$id"
          params={{ id: event.id }}
          className="text-sm font-semibold text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
        >
          {t('viewEvent')}
        </LocaleLink>
      }
    >
      {status === 'pending' ? (
        <SkeletonCards label={t('giftsLoading')} cards={4} />
      ) : status === 'error' ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          {t('giftsError')}
        </p>
      ) : isEmptyTastes(tastes) ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('noGifts')}
        </p>
      ) : (
        <GiftTastes tastes={tastes} />
      )}
    </Modal>
  );
};
