import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { StardewValleyApiContext } from '../components/StardewValleyApiProvider';
import { StardewValleyApi } from '../generated/stardew-valley-api/client.gen';
import { StardewValleyApiOptionsProxy } from '../generated/stardew-valley-api/options-proxy.gen';
import {
  useDeleteFarmPlan,
  useFarmPlan,
  useUpdateFarmPlan,
} from './useFarmPlans';

const PLAN = {
  id: 'p1',
  name: 'A',
  farmId: 'standard',
  version: 1,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  objects: [],
};

// Real generated client and options proxy; only `fetch` is faked. GET always returns the
// original PLAN, so anything newer in the cache must come from the PUT response.
const setup = () => {
  const fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
    const request = input instanceof Request ? input : undefined;
    const method = init?.method ?? request?.method ?? 'GET';
    if (method === 'DELETE') return new Response(null, { status: 204 });
    let body: unknown = PLAN;
    if (method === 'PUT') {
      const sent = (
        request ? await request.clone().json() : JSON.parse(String(init?.body))
      ) as { name: string; version: number };
      body = { ...PLAN, name: sent.name, version: sent.version + 1 };
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  const client = new StardewValleyApi({ url: 'https://api.test', fetch });
  const api = new StardewValleyApiOptionsProxy({ client });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <StardewValleyApiContext.Provider value={api}>
        {children}
      </StardewValleyApiContext.Provider>
    </QueryClientProvider>
  );
  return { api, fetch, queryClient, wrapper };
};

describe('farm plan hooks', () => {
  it('should store the saved plan from the update response in the detail cache', async () => {
    const { fetch, wrapper } = setup();
    const { result } = renderHook(
      () => ({ plan: useFarmPlan('p1'), update: useUpdateFarmPlan() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.plan.data?.version).toBe(1));
    await result.current.update.mutateAsync({
      planId: 'p1',
      name: 'B',
      objects: [],
      version: 1,
    });
    await waitFor(() =>
      expect(result.current.plan.data).toMatchObject({ name: 'B', version: 2 }),
    );
    // No refetch of the detail: only the first load and the PUT reached the server.
    const methods = fetch.mock.calls.map(([input, init]) =>
      input instanceof Request ? input.method : (init?.method ?? 'GET'),
    );
    expect(methods).toEqual(['GET', 'PUT']);
  });

  it('should remove the plan detail after a delete', async () => {
    const { api, queryClient, wrapper } = setup();
    const { result } = renderHook(
      () => ({ plan: useFarmPlan('p1'), del: useDeleteFarmPlan() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.plan.data).toBeDefined());
    const key = api.getFarmPlan.queryKey({ planId: 'p1' });
    expect(queryClient.getQueryData(key)).toBeDefined();
    await result.current.del.mutateAsync({ planId: 'p1' });
    await waitFor(() => expect(queryClient.getQueryData(key)).toBeUndefined());
  });
});
