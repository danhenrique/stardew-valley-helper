import { Link } from '@tanstack/react-router';
import type { Season } from '../generated/stardew-valley-api/types.gen';
import { useFish } from '../hooks/useGameData';
import { rainFishSections } from '../lib/fish';
import { FishSectionList } from './FishCatalog';
import { Modal } from './Modal';
import { SkeletonList } from './Skeleton';

/** Fish catchable today when it rains: rain-only first (spec: fish design). */
export const RainFishModal = ({
  open,
  onClose,
  season,
}: {
  open: boolean;
  onClose: () => void;
  season: Season;
}) => {
  const fish = useFish();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Peixes de chuva"
      footer={
        <Link
          to="/peixes"
          onClick={onClose}
          className="text-sm font-semibold text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300"
        >
          Ver todos os peixes
        </Link>
      }
    >
      {fish.isPending ? (
        <SkeletonList label="Carregando peixes..." rows={4} />
      ) : fish.isError || !fish.data ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          Não foi possível carregar os peixes.
        </p>
      ) : (
        <FishSectionList sections={rainFishSections(fish.data, season)} />
      )}
    </Modal>
  );
};
