import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectLoading } from '../components/expectLoading';
import { NotificationsProvider } from '../components/Notifications';
import { renderWithRouter } from '../components/renderWithRouter';
import {
  BERRY_PLANTING,
  FERTILIZERS,
  MACHINE_SCHEDULE,
  MACHINES,
  machineBatch,
  PLANTABLES,
  SPRING_1,
  TEST_FESTIVAL,
} from '../components/testData';
import type { MachineBatchOut } from '../generated/stardew-valley-api/types.gen';
import { buildEvents } from '../lib/events';
import { Route as MachinesRoute } from './maquinas';
import { Route as PlantingsRoute } from './plantios';
import { parseProductionSearch, Route } from './producao';

const mocks = vi.hoisted(() => ({
  useMe: vi.fn(),
  usePlantables: vi.fn(),
  useFertilizers: vi.fn(),
  useFixedEvents: vi.fn(),
  useUpdateProfile: vi.fn(),
  useCreatePlanting: vi.fn(),
  useUpdatePlanting: vi.fn(),
  useDeletePlanting: vi.fn(),
  useSchedulePreview: vi.fn(),
  useMachines: vi.fn(),
  useCreateMachineBatch: vi.fn(),
  useUpdateMachineBatch: vi.fn(),
  useDeleteMachineBatch: vi.fn(),
  useMachineSchedulePreview: vi.fn(),
}));
vi.mock('../hooks/useGameData', () => mocks);

const Page = Route.options.component as () => React.ReactElement;
const ProductionPage = () => (
  <NotificationsProvider>
    <Page />
  </NotificationsProvider>
);
const BATCH = machineBatch({
  startedOn: { year: 1, season: 'spring', day: 1 },
  schedule: {
    ...MACHINE_SCHEDULE,
    readyOn: { year: 1, season: 'spring', day: 8 },
  },
});
const deleteMutateAsync = vi.fn();

const mockMe = (machines: MachineBatchOut[]) =>
  mocks.useMe.mockReturnValue({
    data: {
      profile: { currentDate: SPRING_1, agriculturist: false },
      plantings: [BERRY_PLANTING],
      machines,
    },
    isPending: false,
    isError: false,
  });

beforeEach(() => {
  vi.clearAllMocks();
  const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
  mockMe([BATCH]);
  mocks.usePlantables.mockReturnValue({ data: PLANTABLES, isPending: false });
  mocks.useFertilizers.mockReturnValue({ data: FERTILIZERS });
  mocks.useFixedEvents.mockReturnValue({
    data: buildEvents({
      festivals: [TEST_FESTIVAL],
      villagers: [],
      foraging: [],
      plantables: [],
    }),
    isPending: false,
    isError: false,
  });
  mocks.useMachines.mockReturnValue({ data: MACHINES, isPending: false });
  for (const hook of [
    mocks.useUpdateProfile,
    mocks.useCreatePlanting,
    mocks.useUpdatePlanting,
    mocks.useDeletePlanting,
    mocks.useSchedulePreview,
    mocks.useCreateMachineBatch,
    mocks.useUpdateMachineBatch,
    mocks.useMachineSchedulePreview,
  ])
    hook.mockReturnValue(mutation);
  deleteMutateAsync.mockResolvedValue(undefined);
  mocks.useDeleteMachineBatch.mockReturnValue({
    ...mutation,
    mutateAsync: deleteMutateAsync,
  });
});

const renderAt = (path = '/producao') =>
  renderWithRouter(null, {
    initialPath: path,
    pages: [
      { path: '/producao', component: ProductionPage },
      {
        path: '/plantios',
        beforeLoad: PlantingsRoute.options.beforeLoad as () => void,
      },
      {
        path: '/maquinas',
        beforeLoad: MachinesRoute.options.beforeLoad as () => void,
      },
    ],
  });
const renderPlantings = async () => {
  const router = renderAt();
  await screen.findByRole('button', { name: 'Adicionar plantio' });
  return router;
};
const renderMachines = async () => {
  const router = renderAt('/producao?aba=maquinas');
  await screen.findByRole('button', { name: 'Adicionar máquina' });
  return router;
};

describe('Produção page', () => {
  it('should open on the plantings tab under the page title', async () => {
    await renderPlantings();
    expect(
      screen.getByRole('heading', { name: 'Produção', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plantios' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('should fall back to the plantings tab on an unknown tab', async () => {
    renderAt('/producao?aba=xyz');
    expect(
      await screen.findByRole('button', { name: 'Adicionar plantio' }),
    ).toBeInTheDocument();
  });

  it('should switch to the machines tab and keep it in the URL', async () => {
    const router = await renderPlantings();
    await userEvent.click(screen.getByRole('button', { name: 'Máquinas' }));
    expect(
      await screen.findByRole('button', { name: 'Adicionar máquina' }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ aba: 'maquinas' });
  });

  it('should close the machine drawer when the tab changes', async () => {
    const router = await renderMachines();
    await userEvent.click(
      screen.getByRole('button', { name: 'Adicionar máquina' }),
    );
    await screen.findByRole('dialog', { name: 'Adicionar máquina' });
    await act(() =>
      router.navigate({ to: '/producao', search: { aba: 'plantios' } }),
    );
    await screen.findByRole('button', { name: 'Adicionar plantio' });
    expect(
      screen.queryByRole('dialog', { name: 'Adicionar máquina' }),
    ).not.toBeInTheDocument();
  });

  it('should redirect the old pages to their tabs', async () => {
    const plantings = renderAt('/plantios');
    await screen.findByRole('button', { name: 'Adicionar plantio' });
    expect(plantings.state.location.pathname).toBe('/producao');
    expect(plantings.state.location.search).toEqual({ aba: 'plantios' });
  });

  it('should redirect the old machines page to its tab', async () => {
    const machines = renderAt('/maquinas');
    await screen.findByRole('button', { name: 'Adicionar máquina' });
    expect(machines.state.location.search).toEqual({ aba: 'maquinas' });
  });

  it('should parse the tab of the search', () => {
    expect(parseProductionSearch({})).toEqual({ aba: 'plantios' });
    expect(parseProductionSearch({ aba: 'maquinas' })).toEqual({
      aba: 'maquinas',
    });
  });
});

describe('Plantios tab', () => {
  it('should show the location tabs, list and calendar', async () => {
    await renderPlantings();
    expect(screen.getByRole('button', { name: /^Todos/ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Plantios' })).toBeInTheDocument();
    expect(screen.getByTestId('calendar-day-9')).toBeInTheDocument();
  });

  it('should open the add drawer when Adicionar plantio is clicked', async () => {
    await renderPlantings();
    await userEvent.click(
      screen.getByRole('button', { name: 'Adicionar plantio' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Adicionar plantio' }),
    ).toBeInTheDocument();
  });

  it('should open the edit drawer pre-filled when Editar is chosen', async () => {
    await renderPlantings();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Editar' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar plantio',
    });
    expect(within(dialog).getByRole('combobox')).toHaveValue(
      'Sementes de Fruta',
    );
  });

  it('should show a skeleton while the player data loads', async () => {
    mocks.useMe.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderAt();
    expectLoading(await screen.findByText('Carregando plantios...'));
  });
});

describe('Máquinas tab', () => {
  it('should show the tabs, list and calendar', async () => {
    await renderMachines();
    expect(screen.getByRole('button', { name: /^Todas/ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Máquinas' })).toHaveTextContent(
      'Barril → Vinho Teste',
    );
    expect(
      within(screen.getByTestId('calendar-day-8')).getByText(/Vinho Teste/),
    ).toBeInTheDocument();
  });

  it('should open the edit drawer when Editar is chosen', async () => {
    await renderMachines();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Editar' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar máquina',
    });
    expect(
      within(dialog).getByRole('button', { name: /^Produto/ }),
    ).toHaveTextContent('Vinho Teste');
  });

  it('should empty the machine and offer to undo', async () => {
    await renderMachines();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Esvaziar' }),
    );
    expect(deleteMutateAsync).toHaveBeenCalledWith({
      machineBatchId: BATCH.id,
    });
    expect(await screen.findByText('Máquina esvaziada')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Desfazer' }),
    ).toBeInTheDocument();
  });

  it('should show the empty state with a button opening the drawer', async () => {
    mockMe([]);
    await renderMachines();
    expect(screen.getByText('Nenhuma máquina ainda')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Nova máquina' }));
    expect(
      await screen.findByRole('dialog', { name: 'Adicionar máquina' }),
    ).toBeInTheDocument();
  });

  it('should show a skeleton while the player data loads', async () => {
    mocks.useMe.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderAt('/producao?aba=maquinas');
    expectLoading(await screen.findByText('Carregando máquinas...'));
  });
});
