import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useLocale } from 'use-intl';
import { toCatalog } from '../lib/farmPlanner/catalog';
import { toTerrain } from '../lib/farmPlanner/terrain';
import { useStardewValleyApi } from './useStardewValleyApi';
import { useStardewValleyApiClient } from './useStardewValleyApiClient';

/** URL of the background image of a farm map (static asset). */
export const farmBackgroundUrl = (farmId: string): string =>
  `${import.meta.env.BASE_URL}farms/${farmId}.webp`;

/** Farm map entities (`farms`); static game data. */
export const useFarms = () => {
  const api = useStardewValleyApi();
  return useQuery({
    ...api.listGameEntities.queryOptions({ type: 'farms' }),
    staleTime: Infinity,
  });
};

/** Decoded terrain of one farm; fetched only when a farm is given. */
export const useFarmTerrain = (farmId: string | undefined) => {
  const api = useStardewValleyApi();
  return useQuery({
    ...api.getGameEntity.queryOptions({ type: 'farms', id: farmId ?? '' }),
    enabled: farmId !== undefined,
    staleTime: Infinity,
    select: toTerrain,
  });
};

/** Planner object catalog (`planner-objects`) with localized names. */
export const usePlannerCatalog = () => {
  const api = useStardewValleyApi();
  const locale = useLocale();
  const entities = useQuery({
    ...api.listGameEntities.queryOptions({ type: 'planner-objects' }),
    staleTime: Infinity,
  });
  const names = useQuery({
    ...api.listGameNames.queryOptions(),
    staleTime: Infinity,
  });
  const data = useMemo(
    () =>
      entities.data && names.data
        ? toCatalog(entities.data, names.data, locale)
        : undefined,
    [entities.data, names.data, locale],
  );
  return {
    data,
    isPending: entities.isPending || names.isPending,
    isError: entities.isError || names.isError,
  };
};

export const useFarmPlans = () => {
  const api = useStardewValleyApi();
  return useQuery(api.listFarmPlans.queryOptions());
};

/** True for the generated client's 404 error (`{ status: 404, error }`). */
export const isNotFound = (error: unknown): boolean =>
  (error as { status?: unknown } | null)?.status === 404;

const MAX_LOAD_RETRIES = 3;

export const useFarmPlan = (planId: string) => {
  const api = useStardewValleyApi();
  return useQuery({
    ...api.getFarmPlan.queryOptions({ planId }),
    // A missing plan stays missing: show the 404 state at once.
    retry: (failures, error) =>
      !isNotFound(error) && failures < MAX_LOAD_RETRIES,
  });
};

const useInvalidatePlans = () => {
  const api = useStardewValleyApi();
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: api.listFarmPlans.queryKey() });
};

export const useCreateFarmPlan = () => {
  const api = useStardewValleyApi();
  const invalidate = useInvalidatePlans();
  return useMutation({
    ...api.createFarmPlan.mutationOptions(),
    onSuccess: invalidate,
  });
};

export const useUpdateFarmPlan = () => {
  const api = useStardewValleyApi();
  const queryClient = useQueryClient();
  const invalidate = useInvalidatePlans();
  return useMutation({
    ...api.updateFarmPlan.mutationOptions(),
    onSuccess: (saved, { planId }) => {
      // The response is the stored plan: an editor opened next starts from it, not a stale copy.
      queryClient.setQueryData(api.getFarmPlan.queryKey({ planId }), saved);
      return invalidate();
    },
  });
};

export const useDeleteFarmPlan = () => {
  const api = useStardewValleyApi();
  const queryClient = useQueryClient();
  const invalidate = useInvalidatePlans();
  return useMutation({
    ...api.deleteFarmPlan.mutationOptions(),
    onSuccess: (_data, { planId }) => {
      queryClient.removeQueries({
        queryKey: api.getFarmPlan.queryKey({ planId }),
      });
      return invalidate();
    },
  });
};

/** Renames a plan: reads the current plan, then saves it back with its own objects and version. */
export const useRenameFarmPlan = () => {
  const client = useStardewValleyApiClient();
  const update = useUpdateFarmPlan();
  return useMutation({
    mutationFn: async ({ planId, name }: { planId: string; name: string }) => {
      const plan = await client.getFarmPlan({ planId });
      return update.mutateAsync({
        planId,
        name,
        objects: plan.objects,
        version: plan.version,
      });
    },
  });
};
