import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { StardewValleyApiContext } from '../components/StardewValleyApiProvider';
import type { StardewValleyApiOptionsProxy } from '../generated/stardew-valley-api/options-proxy.gen';
import type {
  MeOut,
  ProfileIn,
} from '../generated/stardew-valley-api/types.gen';
import { useUpdateProfile } from './useGameData';

const ME_KEY = ['me'];
const ME: MeOut = {
  profile: { currentDate: { year: 1, season: 'spring', day: 1 } },
  plantings: [],
};
const NEXT: ProfileIn = {
  currentDate: { year: 1, season: 'spring', day: 2 },
};

const setup = (mutationFn: (profile: ProfileIn) => Promise<ProfileIn>) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(ME_KEY, ME);
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const api = {
    getMe: { queryKey: () => ME_KEY },
    updateProfile: {
      mutationOptions: () => ({ mutationFn, mutationKey: ['updateProfile'] }),
    },
  } as unknown as StardewValleyApiOptionsProxy;
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <StardewValleyApiContext.Provider value={api}>
        {children}
      </StardewValleyApiContext.Provider>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => useUpdateProfile(), { wrapper });
  return { queryClient, invalidate, result };
};

const deferred = () => {
  let resolve!: (profile: ProfileIn) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<ProfileIn>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useUpdateProfile', () => {
  it('should show the new profile before the API answers and refetch after', async () => {
    const request = deferred();
    const { queryClient, invalidate, result } = setup(() => request.promise);
    act(() => result.current.mutate(NEXT));
    await waitFor(() =>
      expect(queryClient.getQueryData<MeOut>(ME_KEY)?.profile).toEqual(NEXT),
    );
    expect(invalidate).not.toHaveBeenCalled();
    await act(async () => request.resolve(NEXT));
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ME_KEY }),
    );
    expect(queryClient.getQueryData<MeOut>(ME_KEY)?.profile).toEqual(NEXT);
  });

  it('should roll back to the previous profile when the API fails', async () => {
    const request = deferred();
    const { queryClient, result } = setup(() => request.promise);
    act(() => result.current.mutate(NEXT));
    await waitFor(() =>
      expect(queryClient.getQueryData<MeOut>(ME_KEY)?.profile).toEqual(NEXT),
    );
    await act(async () => request.reject(new Error('boom')));
    await waitFor(() =>
      expect(queryClient.getQueryData<MeOut>(ME_KEY)?.profile).toEqual(
        ME.profile,
      ),
    );
  });
});
