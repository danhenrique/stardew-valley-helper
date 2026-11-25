import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { StardewValleyApi } from '../../generated/stardew-valley-api/client.gen';
import { StardewValleyApiOptionsProxy } from '../../generated/stardew-valley-api/options-proxy.gen';
import type { PlacedObject } from '../../lib/farmPlanner/types';
import { renderWithRouter } from '../renderWithRouter';
import { StardewValleyApiContext } from '../StardewValleyApiProvider';
import { clickTile, FARMHOUSE, planWith } from './editorFixtures.spec-helpers';
import { FarmPlanPage } from './FarmPlanPage';

// Terrain and catalog are static game data; the plan goes through the real hooks and client.
vi.mock('../../hooks/useFarmPlans', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../hooks/useFarmPlans')>();
  const fixtures = await import('./editorFixtures.spec-helpers');
  return {
    ...actual,
    useFarmTerrain: () => ({
      data: fixtures.terrain,
      isPending: false,
      isError: false,
    }),
    usePlannerCatalog: () => ({
      data: fixtures.catalog,
      isPending: false,
      isError: false,
    }),
  };
});

function OtherPlanPage() {
  const { id } = useParams({ strict: false });
  return <p>plano {id}</p>;
}

const summary = (id: string, name: string) => {
  const { objects: _objects, ...rest } = planWith([]);
  return { ...rest, id, name };
};

const BARN: PlacedObject = { t: 'barn', x: 3, y: 3 };
const SCARECROW: PlacedObject = { t: 'scarecrow', x: 5, y: 5 };

type Reply = { status: number; body?: unknown };
const json = ({ status, body }: Reply) =>
  new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Fake API: `getPlan` and `putPlan` decide each reply; the default is the stored plan. */
const setup = () => {
  const server = {
    plan: planWith([FARMHOUSE]),
    /** Summaries returned by the plan list (the current plan included). */
    plans: [] as Omit<ReturnType<typeof planWith>, 'objects'>[],
  };
  const getPlan = vi.fn((): Reply => ({ status: 200, body: server.plan }));
  const putPlan = vi.fn(
    (body: Record<string, unknown>): Reply | Promise<Reply> => {
      server.plan = {
        ...server.plan,
        name: body.name as string,
        objects: body.objects as PlacedObject[],
        version: (body.version as number) + 1,
      };
      return { status: 200, body: server.plan };
    },
  );
  const puts: Record<string, unknown>[] = [];
  const fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const method = init?.method ?? 'GET';
    if (path === '/me/farm-plans/plan-1' && method === 'GET')
      return json(getPlan());
    if (path === '/me/farm-plans/plan-1' && method === 'PUT') {
      const body = JSON.parse(String(init?.body));
      puts.push(body);
      return json(await putPlan(body));
    }
    if (path === '/me/farm-plans')
      return json({ status: 200, body: server.plans });
    return json({ status: 404, body: { detail: 'Not found' } });
  });
  const client = new StardewValleyApi({ url: 'https://api.test', fetch });
  const api = new StardewValleyApiOptionsProxy({ client });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 1, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  const page = (
    <QueryClientProvider client={queryClient}>
      <StardewValleyApiContext.Provider value={api}>
        <FarmPlanPage planId="plan-1" />
      </StardewValleyApiContext.Provider>
    </QueryClientProvider>
  );
  const renderAt = (initialPath: string) =>
    renderWithRouter(null, {
      initialPath,
      pages: [
        { path: '/{-$locale}/farm', component: () => <p>lista</p> },
        { path: '/{-$locale}/farm/$id', component: () => page },
      ],
    });
  const render = () =>
    renderWithRouter(page, {
      pages: [
        { path: '/{-$locale}/farm', component: () => <p>lista</p> },
        { path: '/{-$locale}/farm/$id', component: OtherPlanPage },
      ],
    });
  const getCalls = () =>
    fetch.mock.calls.filter(
      ([url, init]) =>
        String(url).endsWith('/me/farm-plans/plan-1') &&
        (init?.method ?? 'GET') === 'GET',
    ).length;
  const cachedPlan = () =>
    queryClient.getQueryData(api.getFarmPlan.queryKey({ planId: 'plan-1' }));
  return {
    server,
    getPlan,
    putPlan,
    puts,
    render,
    renderAt,
    getCalls,
    cachedPlan,
  };
};

const map = () => screen.findByRole('application', { name: 'Mapa da fazenda' });
const hasObject = (t: string) =>
  screen
    .getByRole('application', { name: 'Mapa da fazenda' })
    .querySelector(`[data-object="${t}"]`) !== null;

/** Places a scarecrow on the map and lets the 1.5 s autosave fire. */
const placeScarecrow = async (x = SCARECROW.x, y = SCARECROW.y) => {
  const palette = screen.getByRole('region', { name: 'Objetos' });
  fireEvent.click(within(palette).getByRole('button', { name: 'Espantalho' }));
  clickTile(await map(), x, y);
};
const placeScarecrowAndWait = async (x?: number, y?: number) => {
  await placeScarecrow(x, y);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
};
const saveStatus = () => screen.getByRole('status', { name: 'Salvamento' });
const leaveDialog = () =>
  screen.findByRole('dialog', { name: 'Sair sem salvar?' });
/** A blocked navigation never settles, so it is started without awaiting it. */
const tryLeave = (router: { navigate: (opts: { to: string }) => unknown }) =>
  act(async () => {
    void router.navigate({ to: '/farm' });
    await vi.advanceTimersByTimeAsync(0);
  });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('FarmPlanPage', () => {
  it('should show the not found state with a link to the plan list', async () => {
    const { getPlan, render, getCalls } = setup();
    getPlan.mockReturnValue({
      status: 404,
      body: { detail: 'Plan not found' },
    });
    render();
    expect(await screen.findByText('Plano não encontrado')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Voltar para os planos' }),
    ).toHaveAttribute('href', '/farm');
    expect(getCalls()).toBe(1);
  });

  it('should render under /en/farm/<id> and keep the prefix in the back link', async () => {
    const { getPlan, renderAt } = setup();
    getPlan.mockReturnValue({
      status: 404,
      body: { detail: 'Plan not found' },
    });
    renderAt('/en/farm/plan-1');
    expect(await screen.findByText('Plan not found')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to plans' })).toHaveAttribute(
      'href',
      '/en/farm',
    );
  });

  it('should retry a failed load with "Tentar de novo"', async () => {
    const { getPlan, render } = setup();
    getPlan.mockReturnValue({ status: 500, body: { detail: 'boom' } });
    render();
    const retry = await screen.findByRole('button', { name: 'Tentar de novo' });
    getPlan.mockRestore();
    getPlan.mockImplementation(() => ({ status: 200, body: planWith([]) }));
    fireEvent.click(retry);
    expect(await map()).toBeInTheDocument();
  });

  it('should autosave an edit with the plan version and keep editing when the cache updates', async () => {
    const { putPlan, puts, render, cachedPlan } = setup();
    render();
    await map();
    expect(saveStatus()).toHaveTextContent('');
    // The saved plan goes into the detail cache; its objects must not reach the editor.
    putPlan.mockImplementationOnce((body) => ({
      status: 200,
      body: {
        ...planWith([FARMHOUSE, BARN]),
        version: (body.version as number) + 1,
      },
    }));
    await placeScarecrowAndWait();
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Salvo'));
    expect(puts).toEqual([
      { name: 'Ano 1', objects: [FARMHOUSE, SCARECROW], version: 1 },
    ]);
    expect(cachedPlan()).toMatchObject({
      version: 2,
      objects: [FARMHOUSE, BARN],
    });
    expect(hasObject('scarecrow')).toBe(true);
    expect(hasObject('barn')).toBe(false);
  });

  it('should reopen a plan left with pending changes at the flushed objects and version', async () => {
    const { getPlan, puts, render } = setup();
    const router = render();
    await map();
    await placeScarecrow();
    // Leave before the debounce (picking "Sair"): the pending change is flushed on unmount.
    await tryLeave(router);
    fireEvent.click(
      within(await leaveDialog()).getByRole('button', { name: 'Sair' }),
    );
    expect(await screen.findByText('lista')).toBeVisible();
    await waitFor(() => expect(puts).toHaveLength(1));
    // Coming back shows the cached plan at once, even if the background refetch fails.
    getPlan.mockReturnValue({ status: 500, body: { detail: 'boom' } });
    await act(() => router.navigate({ to: '/' }));
    await map();
    expect(hasObject('scarecrow')).toBe(true);
    await placeScarecrowAndWait(4, 4);
    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts[1]).toMatchObject({ version: 2 });
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Salvo'));
  });

  describe('leaving the editor inside the app', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should navigate away when the user picks "Sair" with unsaved changes', async () => {
      const { render } = setup();
      const router = render();
      await map();
      await placeScarecrow();
      await tryLeave(router);
      const dialog = await leaveDialog();
      expect(
        within(dialog).getByText('Há alterações que ainda não foram salvas.'),
      ).toBeVisible();
      expect(screen.queryByText('lista')).toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Sair' }));
      expect(await screen.findByText('lista')).toBeVisible();
    });

    it('should stay on the editor when the user picks "Continuar editando" with unsaved changes', async () => {
      const { puts, render } = setup();
      const router = render();
      await map();
      await placeScarecrow();
      const confirm = vi.spyOn(window, 'confirm');
      await tryLeave(router);
      fireEvent.click(
        within(await leaveDialog()).getByRole('button', {
          name: 'Continuar editando',
        }),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Sair sem salvar?' }),
        ).toBeNull(),
      );
      expect(confirm).not.toHaveBeenCalled();
      expect(screen.queryByText('lista')).toBeNull();
      expect(hasObject('scarecrow')).toBe(true);
      // Still mounted: the change is saved on the normal debounce.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      await waitFor(() => expect(puts).toHaveLength(1));
    });

    it('should close the dialog, keep the editor and cancel the navigation when the user presses Escape', async () => {
      const { render } = setup();
      const router = render();
      await map();
      await placeScarecrow();
      await tryLeave(router);
      const dialog = await leaveDialog();
      fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Escape' });
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Sair sem salvar?' }),
        ).toBeNull(),
      );
      // The blocked navigation was cancelled, not left pending.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.queryByText('lista')).toBeNull();
      expect(router.state.location.pathname).not.toBe('/farm');
      expect(hasObject('scarecrow')).toBe(true);
    });

    it('should ask when the last save failed', async () => {
      const { putPlan, render } = setup();
      putPlan.mockReturnValue({ status: 500, body: { detail: 'boom' } });
      const router = render();
      await map();
      await placeScarecrowAndWait();
      await waitFor(() =>
        expect(saveStatus()).toHaveTextContent('Erro ao salvar'),
      );
      await tryLeave(router);
      expect(await leaveDialog()).toBeVisible();
      expect(screen.queryByText('lista')).toBeNull();
    });

    it('should ask when a conflict is open', async () => {
      const { putPlan, render } = setup();
      putPlan.mockReturnValueOnce({
        status: 409,
        body: { detail: 'Plan changed elsewhere' },
      });
      const router = render();
      await map();
      await placeScarecrowAndWait();
      await screen.findByRole('dialog');
      await tryLeave(router);
      expect(await leaveDialog()).toBeVisible();
      expect(screen.queryByText('lista')).toBeNull();
    });

    it('should leave without asking once everything is saved', async () => {
      const { render } = setup();
      const router = render();
      await map();
      await placeScarecrowAndWait();
      await waitFor(() => expect(saveStatus()).toHaveTextContent('Salvo'));
      await act(() => router.navigate({ to: '/farm' }));
      expect(await screen.findByText('lista')).toBeVisible();
      expect(
        screen.queryByRole('dialog', { name: 'Sair sem salvar?' }),
      ).toBeNull();
    });
  });

  describe('plan selector', () => {
    const withPlans = () => {
      const ctx = setup();
      ctx.server.plans = [
        summary('plan-1', 'Ano 1'),
        summary('plan-2', 'Ano 2'),
        summary('plan-3', 'Fazenda dos sonhos'),
      ];
      return ctx;
    };
    const openSelector = async () => {
      fireEvent.click(
        await screen.findByRole('button', { name: 'Trocar de plano: Ano 1' }),
      );
      return screen.findByRole('menu');
    };

    it('should list the other plans of the player when the selector is opened', async () => {
      withPlans().render();
      await map();
      const menu = await openSelector();
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((item) => item.textContent),
      ).toEqual(['Ano 2', 'Fazenda dos sonhos']);
    });

    it('should open the chosen plan when the user picks it', async () => {
      withPlans().render();
      await map();
      const menu = await openSelector();
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Ano 2' }));
      expect(await screen.findByText('plano plan-2')).toBeVisible();
    });

    it('should ask before opening another plan when there are unsaved changes', async () => {
      withPlans().render();
      await map();
      await placeScarecrow();
      const menu = await openSelector();
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Ano 2' }));
      const dialog = await leaveDialog();
      expect(screen.queryByText('plano plan-2')).toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Sair' }));
      expect(await screen.findByText('plano plan-2')).toBeVisible();
    });
  });

  it('should show "Salvando…" while the save is in flight', async () => {
    const { putPlan, render } = setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store = putPlan.getMockImplementation();
    putPlan.mockImplementationOnce(async (body) => {
      await gate;
      return store?.(body) as Reply;
    });
    render();
    await map();
    await placeScarecrowAndWait();
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Salvando…'));
    release();
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Salvo'));
  });

  it('should show "Erro ao salvar" when the save fails', async () => {
    const { putPlan, render } = setup();
    putPlan.mockReturnValue({ status: 500, body: { detail: 'boom' } });
    render();
    await map();
    await placeScarecrowAndWait();
    await waitFor(() =>
      expect(saveStatus()).toHaveTextContent('Erro ao salvar'),
    );
  });

  it('should show the server detail and stop retrying when the save is rejected', async () => {
    const { putPlan, puts, render } = setup();
    putPlan.mockReturnValue({
      status: 400,
      body: { detail: 'Unknown object: scarecrow' },
    });
    render();
    await map();
    await placeScarecrowAndWait();
    await waitFor(() =>
      expect(saveStatus()).toHaveTextContent(
        'Erro ao salvar: Objeto desconhecido: scarecrow',
      ),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(puts).toHaveLength(1);
  });

  it('should reload the server plan when the user picks "Recarregar" on a conflict', async () => {
    const { server, putPlan, render } = setup();
    server.plan = { ...planWith([FARMHOUSE, BARN]), version: 5 };
    putPlan.mockReturnValueOnce({
      status: 409,
      body: { detail: 'Plan changed elsewhere' },
    });
    render();
    await map();
    // The editor loaded version 5 with a barn; another tab then saved version 6 without it.
    server.plan = { ...planWith([FARMHOUSE]), version: 6 };
    await placeScarecrowAndWait();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Recarregar' }));
    await waitFor(() => expect(hasObject('scarecrow')).toBe(false));
    expect(hasObject('barn')).toBe(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(putPlan).toHaveBeenCalledTimes(1);
  });

  it('should save the local objects with the server version on "Sobrescrever"', async () => {
    const { server, putPlan, puts, render } = setup();
    putPlan.mockReturnValueOnce({
      status: 409,
      body: { detail: 'Plan changed elsewhere' },
    });
    render();
    await map();
    server.plan = { ...planWith([FARMHOUSE, BARN]), version: 6 };
    await placeScarecrowAndWait();
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Plano alterado em outro lugar'),
    ).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Sobrescrever' }),
    );
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Salvo'));
    expect(puts.at(-1)).toEqual({
      name: 'Ano 1',
      objects: [FARMHOUSE, SCARECROW],
      version: 6,
    });
    expect(hasObject('scarecrow')).toBe(true);
  });
});
