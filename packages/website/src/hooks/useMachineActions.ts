import { useCallback, useState } from 'react';
import { useTranslations } from 'use-intl';
import { apiErrorMessage, useNotifications } from '../components/Notifications';
import type {
  GameDateIn,
  MachineBatchOut,
} from '../generated/stardew-valley-api/types.gen';
import { recollectBody, toMachineBatchIn } from '../lib/machines';
import {
  useCreateMachineBatch,
  useDeleteMachineBatch,
  useUpdateMachineBatch,
} from './useGameData';

export type MachineActions = {
  recollect: (batch: MachineBatchOut) => void;
  remove: (batch: MachineBatchOut) => void;
  /** Batches with an action in flight, so views can hide them optimistically. */
  removing: ReadonlySet<string>;
  recollecting: ReadonlySet<string>;
};

const without = (ids: ReadonlySet<string>, id: string) => {
  const next = new Set(ids);
  next.delete(id);
  return next;
};

/**
 * One-click machine actions with undo, like `usePlantingActions`: the row hides while the
 * request runs and comes back with an error notification when it fails.
 */
export const useMachineActions = (today: GameDateIn): MachineActions => {
  const createBatch = useCreateMachineBatch();
  const updateBatch = useUpdateMachineBatch();
  const deleteBatch = useDeleteMachineBatch();
  const { notifyError, notifyUndo } = useNotifications();
  const t = useTranslations('machines');
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
  const [recollecting, setRecollecting] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const onError = useCallback(
    (error: unknown) => notifyError(apiErrorMessage(error)),
    [notifyError],
  );

  const recollect = (batch: MachineBatchOut) => {
    setRecollecting((ids) => new Set(ids).add(batch.id));
    updateBatch
      .mutateAsync({ machineBatchId: batch.id, ...recollectBody(batch, today) })
      .then(
        () =>
          notifyUndo(t('recollected'), () =>
            updateBatch
              .mutateAsync({
                machineBatchId: batch.id,
                ...toMachineBatchIn(batch),
              })
              .catch(onError),
          ),
        onError,
      )
      .finally(() => setRecollecting((ids) => without(ids, batch.id)));
  };

  const remove = (batch: MachineBatchOut) => {
    setRemoving((ids) => new Set(ids).add(batch.id));
    deleteBatch
      .mutateAsync({ machineBatchId: batch.id })
      .then(
        () =>
          notifyUndo(t('emptied'), () =>
            createBatch.mutateAsync(toMachineBatchIn(batch)).catch(onError),
          ),
        onError,
      )
      .finally(() => setRemoving((ids) => without(ids, batch.id)));
  };

  return { recollect, remove, removing, recollecting };
};
