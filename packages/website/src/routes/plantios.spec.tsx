import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectLoading } from '../components/expectLoading';
import { NotificationsProvider } from '../components/Notifications';
import { renderWithRouter } from '../components/renderWithRouter';
import {
  BERRY_PLANTING,
  FERTILIZERS,
  PLANTABLES,
  SPRING_1,
  TEST_FESTIVAL,
} from '../components/testData';
import { buildEvents } from '../lib/events';
import { Route } from './plantios';

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
}));
vi.mock('../hooks/useGameData', () => mocks);

const Page = Route.options.component as () => React.ReactElement;

beforeEach(() => {
  const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
  mocks.useMe.mockReturnValue({
    data: {
      profile: { currentDate: SPRING_1, agriculturist: false },
      plantings: [BERRY_PLANTING],
    },
    isPending: false,
    isError: false,
  });
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
  for (const hook of [
    mocks.useUpdateProfile,
    mocks.useCreatePlanting,
    mocks.useUpdatePlanting,
    mocks.useDeletePlanting,
    mocks.useSchedulePreview,
  ])
    hook.mockReturnValue(mutation);
});

const renderPlantios = async () => {
  renderWithRouter(
    <NotificationsProvider>
      <Page />
    </NotificationsProvider>,
  );
  await screen.findByRole('heading', { name: 'Plantios', level: 1 });
};

describe('Plantios route', () => {
  it('should show the heading, location tabs, list and calendar', async () => {
    await renderPlantios();
    expect(screen.getByRole('button', { name: /^Todos/ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Plantios' })).toBeInTheDocument();
    expect(screen.getByTestId('calendar-day-9')).toBeInTheDocument();
  });

  it('should open the add drawer when Adicionar plantio is clicked', async () => {
    await renderPlantios();
    await userEvent.click(
      screen.getByRole('button', { name: 'Adicionar plantio' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Adicionar plantio' }),
    ).toBeInTheDocument();
  });

  it('should open the edit drawer pre-filled when Editar is chosen', async () => {
    await renderPlantios();
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
    renderWithRouter(
      <NotificationsProvider>
        <Page />
      </NotificationsProvider>,
    );
    expectLoading(await screen.findByText('Carregando plantios...'));
  });
});
