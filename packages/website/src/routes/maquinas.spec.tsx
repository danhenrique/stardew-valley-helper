import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectLoading } from '../components/expectLoading';
import { NotificationsProvider } from '../components/Notifications';
import { renderWithRouter } from '../components/renderWithRouter';
import {
  MACHINE_SCHEDULE,
  MACHINES,
  machineBatch,
  SPRING_1,
} from '../components/testData';
import type { MachineBatchOut } from '../generated/stardew-valley-api/types.gen';
import { Route } from './maquinas';

const mocks = vi.hoisted(() => ({
  useMe: vi.fn(),
  useMachines: vi.fn(),
  useCreateMachineBatch: vi.fn(),
  useUpdateMachineBatch: vi.fn(),
  useDeleteMachineBatch: vi.fn(),
  useMachineSchedulePreview: vi.fn(),
}));
vi.mock('../hooks/useGameData', () => mocks);

const Page = Route.options.component as () => React.ReactElement;
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
      plantings: [],
      machines,
    },
    isPending: false,
    isError: false,
  });

beforeEach(() => {
  vi.clearAllMocks();
  const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
  mockMe([BATCH]);
  mocks.useMachines.mockReturnValue({ data: MACHINES, isPending: false });
  for (const hook of [
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

const renderMaquinas = async () => {
  renderWithRouter(
    <NotificationsProvider>
      <Page />
    </NotificationsProvider>,
  );
  await screen.findByRole('heading', { name: 'Máquinas', level: 1 });
};

describe('Máquinas route', () => {
  it('should show the heading, tabs, list and calendar', async () => {
    await renderMaquinas();
    expect(screen.getByRole('button', { name: /^Todas/ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Máquinas' })).toHaveTextContent(
      'Barril → Vinho Teste',
    );
    expect(
      within(screen.getByTestId('calendar-day-8')).getByText(/Vinho Teste/),
    ).toBeInTheDocument();
  });

  it('should open the add drawer when Adicionar máquina is clicked', async () => {
    await renderMaquinas();
    await userEvent.click(
      screen.getByRole('button', { name: 'Adicionar máquina' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Adicionar máquina' }),
    ).toBeInTheDocument();
  });

  it('should open the edit drawer when Editar is chosen', async () => {
    await renderMaquinas();
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
    await renderMaquinas();
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
    await renderMaquinas();
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
    renderWithRouter(
      <NotificationsProvider>
        <Page />
      </NotificationsProvider>,
    );
    expectLoading(await screen.findByText('Carregando máquinas...'));
  });
});
