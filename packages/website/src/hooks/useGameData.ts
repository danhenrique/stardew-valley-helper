import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type {
  GameEntityOut,
  MeOut,
  Season,
} from '../generated/stardew-valley-api/types.gen';
import { buildEvents } from '../lib/events';
import { giftTastes } from '../lib/gifts';
import { buildReminders } from '../lib/reminders';
import type { ValueFertilizer } from '../lib/seedValues';
import { buildOffers } from '../lib/shopCatalog';
import { buildShops } from '../lib/shops';
import { useStardewValleyApi } from './useStardewValleyApi';

export const SPEED_FERTILIZER_IDS = [
  'speed-gro',
  'deluxe-speed-gro',
  'hyper-speed-gro',
] as const;

export const useMe = () => {
  const api = useStardewValleyApi();
  return useQuery(api.getMe.queryOptions());
};

/** Every seed and sapling (greenhouse lists all); season/location filtering happens client-side. */
export const usePlantables = () => {
  const api = useStardewValleyApi();
  return useQuery({
    ...api.listPlantables.queryOptions({ location: 'greenhouse' }),
    staleTime: Infinity,
  });
};

export type SeedValueParams = {
  season: Season;
  fromDay: number;
  fertilizer: ValueFertilizer;
  farmingLevel: number;
  agriculturist: boolean;
  artisan: boolean;
};

/** Expected gold of each seed over a season window; static per parameter set. */
export const useSeedValues = (params: SeedValueParams) => {
  const api = useStardewValleyApi();
  return useQuery({
    ...api.listSeedValues.queryOptions(params),
    staleTime: Infinity,
  });
};

/** Every fish with its catch data; static game data. */
export const useFish = () => {
  const api = useStardewValleyApi();
  return useQuery({
    ...api.listFish.queryOptions(),
    staleTime: Infinity,
  });
};

/** Machine catalog (kinds and outputs); static game data. */
export const useMachines = () => {
  const api = useStardewValleyApi();
  return useQuery({
    ...api.listMachines.queryOptions(),
    staleTime: Infinity,
  });
};

export const useFertilizers = () => {
  const api = useStardewValleyApi();
  return useQuery({
    ...api.listGameEntities.queryOptions({ type: 'fertilizantes' }),
    staleTime: Infinity,
    select: (entities: GameEntityOut[]) =>
      entities.filter((entity) =>
        (SPEED_FERTILIZER_IDS as readonly string[]).includes(entity.id),
      ),
  });
};

const useInvalidateMe = () => {
  const api = useStardewValleyApi();
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: api.getMe.queryKey() });
};

export const useCreatePlanting = () => {
  const api = useStardewValleyApi();
  const invalidate = useInvalidateMe();
  return useMutation({
    ...api.createPlanting.mutationOptions(),
    onSuccess: invalidate,
  });
};

export const useUpdatePlanting = () => {
  const api = useStardewValleyApi();
  const invalidate = useInvalidateMe();
  return useMutation({
    ...api.updatePlanting.mutationOptions(),
    onSuccess: invalidate,
  });
};

export const useDeletePlanting = () => {
  const api = useStardewValleyApi();
  const invalidate = useInvalidateMe();
  return useMutation({
    ...api.deletePlanting.mutationOptions(),
    onSuccess: invalidate,
  });
};

export const useCreateMachineBatch = () => {
  const api = useStardewValleyApi();
  const invalidate = useInvalidateMe();
  return useMutation({
    ...api.createMachineBatch.mutationOptions(),
    onSuccess: invalidate,
  });
};

export const useUpdateMachineBatch = () => {
  const api = useStardewValleyApi();
  const invalidate = useInvalidateMe();
  return useMutation({
    ...api.updateMachineBatch.mutationOptions(),
    onSuccess: invalidate,
  });
};

export const useDeleteMachineBatch = () => {
  const api = useStardewValleyApi();
  const invalidate = useInvalidateMe();
  return useMutation({
    ...api.deleteMachineBatch.mutationOptions(),
    onSuccess: invalidate,
  });
};

/**
 * Saves the profile optimistically, so the day in the header moves on the first click.
 * Saves run one at a time (same scope); a failure restores the previous profile, and the
 * profile is refetched once the last pending save settles.
 */
export const useUpdateProfile = () => {
  const api = useStardewValleyApi();
  const queryClient = useQueryClient();
  const queryKey = api.getMe.queryKey();
  const options = api.updateProfile.mutationOptions();
  return useMutation({
    ...options,
    scope: { id: 'updateProfile' },
    onMutate: async (profile) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MeOut>(queryKey);
      if (previous) {
        queryClient.setQueryData<MeOut>(queryKey, {
          ...previous,
          // Mirrors the API: a save without artisan keeps the stored value.
          profile: {
            ...profile,
            artisan: profile.artisan ?? previous.profile.artisan ?? false,
          },
        });
      }
      return { previous };
    },
    onError: (_error, _profile, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () =>
      queryClient.isMutating({ mutationKey: options.mutationKey }) === 1
        ? queryClient.invalidateQueries({ queryKey })
        : undefined,
  });
};

export const useSchedulePreview = () => {
  const api = useStardewValleyApi();
  return useMutation(api.previewSchedule.mutationOptions());
};

export const useMachineSchedulePreview = () => {
  const api = useStardewValleyApi();
  return useMutation(api.previewMachineSchedule.mutationOptions());
};

/** Festivals, villager birthdays, foraging events and crop deadlines, merged into one list. */
export const useFixedEvents = () => {
  const api = useStardewValleyApi();
  const staleTime = Infinity;
  const festivals = useQuery({
    ...api.listGameEntities.queryOptions({ type: 'festivais' }),
    staleTime,
  });
  const villagers = useQuery({
    ...api.listGameEntities.queryOptions({ type: 'personagens' }),
    staleTime,
  });
  const foraging = useQuery({
    ...api.listGameEntities.queryOptions({ type: 'eventos-coleta' }),
    staleTime,
  });
  const plantables = usePlantables();
  const queries = [festivals, villagers, foraging, plantables];
  const data = useMemo(
    () =>
      festivals.data && villagers.data && foraging.data && plantables.data
        ? buildEvents({
            festivals: festivals.data,
            villagers: villagers.data,
            foraging: foraging.data,
            plantables: plantables.data,
          })
        : undefined,
    [festivals.data, villagers.data, foraging.data, plantables.data],
  );
  return {
    data,
    isPending: queries.some((q) => q.isPending),
    isError: queries.some((q) => q.isError),
  };
};

/** The villager's own gift tastes, every tier; fetched only when `enabled`. */
export const useVillagerGifts = (villagerId: string, enabled = true) => {
  const api = useStardewValleyApi();
  const query = useQuery({
    ...api.getGameEntity.queryOptions({ type: 'personagens', id: villagerId }),
    enabled,
    staleTime: Infinity,
  });
  const relations = query.data?.relations;
  const tastes = useMemo(() => giftTastes(relations ?? []), [relations]);
  return { status: query.status, tastes };
};

/** Whether the shops close during the festival; undefined when the data does not say. */
export const useFestivalShopsClosed = (festivalId: string) => {
  const api = useStardewValleyApi();
  const query = useQuery({
    ...api.listGameEntities.queryOptions({ type: 'festivais' }),
    staleTime: Infinity,
  });
  const closed = query.data?.find((e) => e.id === festivalId)?.attributes?.[
    'shopsClosed'
  ];
  return typeof closed === 'boolean' ? closed : undefined;
};

/** Weekly and season-start reminders (`lembretes`). */
export const useReminders = () => {
  const api = useStardewValleyApi();
  const query = useQuery({
    ...api.listGameEntities.queryOptions({ type: 'lembretes' }),
    staleTime: Infinity,
  });
  const data = useMemo(
    () => (query.data ? buildReminders(query.data) : undefined),
    [query.data],
  );
  return { data, isPending: query.isPending, isError: query.isError };
};

/** Shops and their opening rules (`lojas`). */
export const useShops = () => {
  const api = useStardewValleyApi();
  const query = useQuery({
    ...api.listGameEntities.queryOptions({ type: 'lojas' }),
    staleTime: Infinity,
  });
  const data = useMemo(
    () => (query.data ? buildShops(query.data) : undefined),
    [query.data],
  );
  return { data, isPending: query.isPending, isError: query.isError };
};

/** Offers of one shop, fetched only while its catalog is shown. */
export const useShopOffers = (shopId: string, enabled: boolean) => {
  const api = useStardewValleyApi();
  const query = useQuery({
    ...api.getGameEntity.queryOptions({ type: 'lojas', id: shopId }),
    enabled,
    staleTime: Infinity,
  });
  const relations = query.data?.relations;
  const offers = useMemo(() => buildOffers(relations ?? []), [relations]);
  return { status: query.status, offers };
};
