import { Link } from '@tanstack/react-router';
import { useVillagerGifts } from '../hooks/useGameData';
import type { FixedEvent } from '../lib/events';
import { isEmptyTastes } from '../lib/gifts';
import { formatEventDays, localizedName } from '../lib/i18n';
import { GiftTastes } from './GiftTastes';
import { Modal } from './Modal';
import { SkeletonCards } from './Skeleton';

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
  const { status, tastes } = useVillagerGifts(
    event?.refId ?? '',
    open && event !== null,
  );
  if (!event) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Aniversário de ${localizedName(event.name)}`}
      subtitle={formatEventDays(event)}
      footer={
        <Link
          to="/eventos/$id"
          params={{ id: event.id }}
          className="text-sm font-semibold text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
        >
          Ver evento
        </Link>
      }
    >
      {status === 'pending' ? (
        <SkeletonCards label="Carregando presentes..." cards={4} />
      ) : status === 'error' ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          Não foi possível carregar os presentes.
        </p>
      ) : isEmptyTastes(tastes) ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nenhum presente cadastrado.
        </p>
      ) : (
        <GiftTastes tastes={tastes} />
      )}
    </Modal>
  );
};
