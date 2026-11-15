import { useState } from 'react';
import type {
  GameDateIn,
  PlantingOut,
} from '../generated/stardew-valley-api/types.gen';
import { LOCATION_LABELS } from '../lib/i18n';
import { HarvestCalendar } from './HarvestCalendar';
import { type LocationTab, LocationTabs } from './LocationTabs';
import { PlantingList } from './PlantingList';
import { CARD } from './styles';

const EMPTY_TITLES: Record<Exclude<LocationTab, 'all'>, string> = {
  farm: 'Nenhum plantio na Fazenda',
  greenhouse: 'Nenhum plantio na Estufa',
  'ginger-island': 'Nenhum plantio na Ilha Gengibre',
};

type MyPlantingsProps = {
  plantings: readonly PlantingOut[];
  names: Record<string, string>;
  today: GameDateIn;
  onEdit: (planting: PlantingOut) => void;
  onReplant: (planting: PlantingOut) => void;
  onRemove: (planting: PlantingOut) => void;
  canReplant: (planting: PlantingOut) => boolean;
  onAddPlanting?: () => void;
};

export const MyPlantings = ({
  plantings,
  names,
  today,
  onEdit,
  onReplant,
  onRemove,
  canReplant,
  onAddPlanting,
}: MyPlantingsProps) => {
  const [tab, setTab] = useState<LocationTab>('all');
  const locationOf = (planting: PlantingOut) => planting.location ?? 'farm';
  const shown =
    tab === 'all'
      ? plantings
      : plantings.filter((planting) => locationOf(planting) === tab);
  const counts = {
    all: plantings.length,
    ...Object.fromEntries(
      Object.keys(LOCATION_LABELS).map((location) => [
        location,
        plantings.filter((planting) => locationOf(planting) === location)
          .length,
      ]),
    ),
  } as Record<LocationTab, number>;

  return (
    <>
      <section className={CARD}>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">
          Meus plantios
        </h2>
        <div className="mt-2 mb-4">
          <LocationTabs value={tab} counts={counts} onChange={setTab} />
        </div>
        <PlantingList
          plantings={shown}
          names={names}
          onEdit={onEdit}
          onReplant={onReplant}
          onRemove={onRemove}
          canReplant={canReplant}
          emptyTitle={tab === 'all' ? undefined : EMPTY_TITLES[tab]}
          emptyDescription={
            tab === 'all'
              ? undefined
              : 'Adicione um plantio escolhendo este local no formulário.'
          }
          emptyAction={
            onAddPlanting
              ? { label: 'Novo plantio', onClick: onAddPlanting }
              : undefined
          }
        />
      </section>
      <section className="overflow-hidden rounded-lg bg-white shadow-sm outline outline-black/5 dark:bg-gray-800/50 dark:outline-white/10">
        <HarvestCalendar plantings={shown} names={names} today={today} />
      </section>
    </>
  );
};
