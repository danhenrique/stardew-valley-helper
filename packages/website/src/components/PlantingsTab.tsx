import { useState } from 'react';
import type { PlantingOut } from '../generated/stardew-valley-api/types.gen';
import { useMe, usePlantables } from '../hooks/useGameData';
import { usePlantableNames } from '../hooks/usePlantableNames';
import { usePlantingActions } from '../hooks/usePlantingActions';
import { canReplant } from '../lib/plantings';
import { MyPlantings } from './MyPlantings';
import { PlantingDrawer } from './PlantingDrawer';
import { SkeletonPage } from './Skeleton';

const REPLANTABLE_STATUSES = new Set(['ready', 'dead', 'finished']);

/** The player plantings with their drawer. */
export function PlantingsTab() {
  const me = useMe();
  const plantables = usePlantables();
  const names = usePlantableNames(plantables.data);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PlantingOut | null>(null);
  const today = me.data?.profile.currentDate;
  // Hooks run before the loading guards; the fallback date is never used for an action.
  const actions = usePlantingActions(
    today ?? { year: 1, season: 'spring', day: 1 },
  );

  const profile = me.data?.profile;
  if (me.isPending || plantables.isPending) {
    return <SkeletonPage label="Carregando plantios..." />;
  }
  if (me.isError || plantables.isError || !profile) {
    return (
      <p className="text-sm text-red-700 dark:text-red-400">
        Não foi possível carregar seus dados. Recarregue a página.
      </p>
    );
  }

  const plantableById = new Map(
    plantables.data.map((plantable) => [plantable.id, plantable]),
  );
  const openDrawer = (planting: PlantingOut | null) => {
    setEditing(planting);
    setDrawerOpen(true);
  };
  const shown = me.data.plantings.filter(
    (planting) => !actions.removing.has(planting.id),
  );

  return (
    <div className="space-y-10">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => openDrawer(null)}
          className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:bg-green-500 dark:hover:bg-green-400"
        >
          Adicionar plantio
        </button>
      </div>
      <MyPlantings
        plantings={shown}
        names={names}
        today={profile.currentDate}
        onEdit={openDrawer}
        onReplant={actions.replant}
        onRemove={actions.remove}
        canReplant={(planting) =>
          planting.schedule != null &&
          REPLANTABLE_STATUSES.has(planting.schedule.status) &&
          !actions.replanting.has(planting.id) &&
          canReplant(
            planting,
            plantableById.get(planting.seedId),
            profile.currentDate,
          )
        }
        onAddPlanting={() => openDrawer(null)}
      />
      <PlantingDrawer
        open={drawerOpen}
        editing={editing}
        profile={profile}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
