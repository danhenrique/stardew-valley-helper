import { useCallback, useState } from 'react';
import { apiErrorMessage, useNotifications } from '../components/Notifications';
import type {
  GameDateIn,
  PlantingOut,
} from '../generated/stardew-valley-api/types.gen';
import { replantBody, toPlantingIn } from '../lib/plantings';
import {
  useCreatePlanting,
  useDeletePlanting,
  useUpdatePlanting,
} from './useGameData';

export type PlantingActions = {
  replant: (planting: PlantingOut) => void;
  remove: (planting: PlantingOut) => void;
  /** Plantings with an action in flight, so views can hide them optimistically. */
  removing: ReadonlySet<string>;
  replanting: ReadonlySet<string>;
};

const without = (ids: ReadonlySet<string>, id: string) => {
  const next = new Set(ids);
  next.delete(id);
  return next;
};

/**
 * One-click planting actions with undo (spec §7.4). The row hides while the request runs and
 * comes back with an error notification when it fails. `mutateAsync` keeps every call's
 * outcome, even when several actions run at once.
 */
export const usePlantingActions = (today: GameDateIn): PlantingActions => {
  const createPlanting = useCreatePlanting();
  const updatePlanting = useUpdatePlanting();
  const deletePlanting = useDeletePlanting();
  const { notifyError, notifyUndo } = useNotifications();
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
  const [replanting, setReplanting] = useState<ReadonlySet<string>>(new Set());

  const onError = useCallback(
    (error: unknown) => notifyError(apiErrorMessage(error)),
    [notifyError],
  );

  const replant = (planting: PlantingOut) => {
    setReplanting((ids) => new Set(ids).add(planting.id));
    updatePlanting
      .mutateAsync({ plantingId: planting.id, ...replantBody(planting, today) })
      .then(
        () =>
          notifyUndo('Plantio replantado', () =>
            updatePlanting
              .mutateAsync({
                plantingId: planting.id,
                ...toPlantingIn(planting),
              })
              .catch(onError),
          ),
        onError,
      )
      .finally(() => setReplanting((ids) => without(ids, planting.id)));
  };

  const remove = (planting: PlantingOut) => {
    setRemoving((ids) => new Set(ids).add(planting.id));
    deletePlanting
      .mutateAsync({ plantingId: planting.id })
      .then(
        () =>
          notifyUndo('Plantio removido', () =>
            createPlanting.mutateAsync(toPlantingIn(planting)).catch(onError),
          ),
        onError,
      )
      .finally(() => setRemoving((ids) => without(ids, planting.id)));
  };

  return { replant, remove, removing, replanting };
};
