import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectLoading } from '../components/expectLoading';
import { NotificationsProvider } from '../components/Notifications';
import { renderWithRouter } from '../components/renderWithRouter';
import {
  BERRY_PLANTING,
  BERRY_SCHEDULE,
  FERTILIZERS,
  FISH,
  MACHINE_SCHEDULE,
  MACHINES,
  machineBatch,
  PLANTABLES,
  SPRING_1,
  TEST_FESTIVAL,
} from '../components/testData';
import type { PlantingOut } from '../generated/stardew-valley-api/types.gen';
import { buildEvents } from '../lib/events';
import { buildReminders } from '../lib/reminders';
import { Route } from './index';

const mocks = vi.hoisted(() => ({
  useMe: vi.fn(),
  usePlantables: vi.fn(),
  useFertilizers: vi.fn(),
  useFixedEvents: vi.fn(),
  useReminders: vi.fn(),
  useShops: vi.fn(),
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
  useVillagerGifts: vi.fn(),
  useShopOffers: vi.fn(),
  useFish: vi.fn(),
}));
vi.mock('../hooks/useGameData', () => mocks);

const Page = Route.options.component as () => React.ReactElement;

const KEG_READY = machineBatch({
  id: 'm-keg-ready',
  schedule: {
    ...MACHINE_SCHEDULE,
    readyOn: SPRING_1,
    status: 'ready',
    daysUntilNext: 0,
  },
});
const KEG_SOON = machineBatch({
  id: 'm-keg-soon',
  outputId: 'test-juice',
  schedule: {
    ...MACHINE_SCHEDULE,
    readyOn: { year: 1, season: 'spring', day: 3 },
  },
});

beforeEach(() => {
  const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
  mocks.useMe.mockReturnValue({
    data: {
      profile: { currentDate: SPRING_1, agriculturist: false },
      plantings: [BERRY_PLANTING],
      machines: [KEG_READY, KEG_SOON],
    },
    isPending: false,
    isError: false,
  });
  mocks.usePlantables.mockReturnValue({ data: PLANTABLES, isPending: false });
  mocks.useFertilizers.mockReturnValue({ data: FERTILIZERS });
  mocks.useMachines.mockReturnValue({ data: MACHINES, isPending: false });
  mocks.useVillagerGifts.mockReturnValue({
    status: 'pending',
    tastes: { loves: [], likes: [], neutral: [], dislikesOrHates: [] },
  });
  mocks.useShopOffers.mockReturnValue({ status: 'pending', offers: [] });
  mocks.useFish.mockReturnValue({
    data: FISH,
    isPending: false,
    isError: false,
  });
  mocks.useReminders.mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
  });
  mocks.useShops.mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
  });
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
    mocks.useCreateMachineBatch,
    mocks.useUpdateMachineBatch,
    mocks.useDeleteMachineBatch,
    mocks.useMachineSchedulePreview,
  ])
    hook.mockReturnValue(mutation);
});

const renderHome = async () => {
  renderWithRouter(
    <NotificationsProvider>
      <Page />
    </NotificationsProvider>,
  );
  await screen.findByRole('heading', { level: 2, name: 'Hoje' });
};

const raining = (rainToday: boolean) =>
  mocks.useMe.mockReturnValue({
    data: {
      profile: { currentDate: SPRING_1, agriculturist: false, rainToday },
      plantings: [],
      machines: [],
    },
    isPending: false,
    isError: false,
  });

describe('Home route rain', () => {
  it('should show the rain alert when it rains', async () => {
    raining(true);
    await renderHome();
    expect(screen.getByText('Está chovendo hoje')).toBeInTheDocument();
  });

  it('should not show the rain alert when it does not rain', async () => {
    raining(false);
    await renderHome();
    expect(screen.queryByText('Está chovendo hoje')).not.toBeInTheDocument();
  });

  it('should open the rain fish modal when the alert button is clicked', async () => {
    raining(true);
    await renderHome();
    await userEvent.click(
      screen.getByRole('button', { name: 'Ver peixes de chuva' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Peixes de chuva' }),
    ).toBeInTheDocument();
  });
});

describe('Home route', () => {
  it('should show the cards in order without the day control when there are reminders', async () => {
    mocks.useReminders.mockReturnValue({
      data: buildReminders([
        {
          type: 'lembretes',
          id: 'test-monday',
          name: { en: 'Test', ptBr: 'Lembrete de Segunda' },
          attributes: {
            detail: { en: 'd', ptBr: 'Detalhe' },
            order: 1,
            trigger: { kind: 'weekly', weekdays: ['mon'] },
          },
        },
      ]),
      isPending: false,
      isError: false,
    });
    await renderHome();
    expect(screen.queryByText('Primavera 1 · Ano 1')).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Hoje', 'Lembretes', 'Lojas abertas hoje', 'Próximos dias']);
  });

  it('should show the add buttons only in the Hoje card', async () => {
    await renderHome();
    const card = screen
      .getByRole('heading', { level: 2, name: 'Hoje' })
      .closest('section') as HTMLElement;
    expect(
      screen.getAllByRole('button', { name: 'Adicionar plantio' }),
    ).toEqual([
      within(card).getByRole('button', { name: 'Adicionar plantio' }),
    ]);
  });

  it('should not render the planting form before Adicionar plantio is clicked', async () => {
    await renderHome();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Meus plantios')).not.toBeInTheDocument();
  });

  it('should open the add drawer when Adicionar plantio is clicked', async () => {
    await renderHome();
    await userEvent.click(
      screen.getByRole('button', { name: 'Adicionar plantio' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Adicionar plantio' }),
    ).toBeInTheDocument();
  });

  it('should open the machine drawer when Adicionar máquina is clicked', async () => {
    await renderHome();
    await userEvent.click(
      screen.getByRole('button', { name: 'Adicionar máquina' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Adicionar máquina' }),
    ).toBeInTheDocument();
  });

  it('should list ready machines to do today and upcoming machine dates', async () => {
    await renderHome();
    expect(
      within(screen.getByRole('list', { name: 'Máquinas' })).getByText(
        'Barril → Vinho Teste',
      ),
    ).toBeInTheDocument();
    const upcoming = screen
      .getByRole('heading', { level: 2, name: 'Próximos dias' })
      .closest('section') as HTMLElement;
    expect(within(upcoming).getByText(/Suco Teste/)).toBeInTheDocument();
  });

  it('should show the reminders of a Friday in the Lembretes card', async () => {
    mocks.useMe.mockReturnValue({
      data: {
        profile: {
          currentDate: { year: 1, season: 'spring', day: 5 },
          agriculturist: false,
        },
        plantings: [],
        machines: [],
      },
      isPending: false,
      isError: false,
    });
    mocks.useReminders.mockReturnValue({
      data: buildReminders([
        {
          type: 'lembretes',
          id: 'test-cart',
          name: { en: 'Test Cart', ptBr: 'Carroça Teste' },
          attributes: {
            detail: { en: 'd', ptBr: 'Detalhe do lembrete' },
            order: 1,
            trigger: { kind: 'weekly', weekdays: ['fri'] },
          },
        },
      ]),
      isPending: false,
      isError: false,
    });
    await renderHome();
    const card = screen
      .getByRole('heading', { level: 2, name: 'Lembretes' })
      .closest('section') as HTMLElement;
    expect(within(card).getByText('Carroça Teste')).toBeInTheDocument();
  });

  describe('when the machine catalog is not loaded', () => {
    const FLOWER_READY: PlantingOut = {
      ...BERRY_PLANTING,
      id: 'p-flower',
      seedId: 'test-flower-seeds',
      schedule: {
        ...BERRY_SCHEDULE,
        status: 'ready',
        daysUntilNext: 0,
      },
    };

    beforeEach(() => {
      mocks.useMe.mockReturnValue({
        data: {
          profile: { currentDate: SPRING_1, agriculturist: false },
          plantings: [FLOWER_READY],
          machines: [KEG_READY],
        },
        isPending: false,
        isError: false,
      });
    });

    it('should show a loading message in the Máquinas group while the catalog is pending', async () => {
      mocks.useMachines.mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
      });
      await renderHome();
      // The Hoje card and the Próximos dias card each say so.
      expect(screen.getAllByText('Carregando máquinas...')).toHaveLength(2);
      for (const label of screen.getAllByText('Carregando máquinas...'))
        expectLoading(label);
      expect(
        screen.queryByRole('list', { name: 'Máquinas' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Recolocar' }),
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByRole('list', { name: 'Plantios' })).getAllByRole(
          'listitem',
        ),
      ).toHaveLength(1);
      expect(
        screen.getByRole('heading', { name: 'Próximos dias' }),
      ).toBeInTheDocument();
    });

    it('should show an error message in the Máquinas group when the catalog fails', async () => {
      mocks.useMachines.mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
      });
      await renderHome();
      expect(
        screen.getAllByText(
          'Não foi possível carregar as máquinas. Recarregue a página.',
        ),
      ).toHaveLength(2);
      expect(
        screen.queryByRole('list', { name: 'Máquinas' }),
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByRole('list', { name: 'Plantios' })).getAllByRole(
          'listitem',
        ),
      ).toHaveLength(1);
      expect(
        screen.getByRole('heading', { name: 'Próximos dias' }),
      ).toBeInTheDocument();
    });
  });

  it('should show the events of today in the Hoje card and in the first day of Próximos dias', async () => {
    mocks.useFixedEvents.mockReturnValue({
      data: buildEvents({
        festivals: [
          TEST_FESTIVAL,
          {
            ...TEST_FESTIVAL,
            id: 'test-today',
            name: { en: 'Today Festival', ptBr: 'Festival de Hoje' },
            attributes: { season: 'spring', startDay: 1 },
          },
        ],
        villagers: [],
        foraging: [],
        plantables: [],
      }),
      isPending: false,
      isError: false,
    });
    await renderHome();
    expect(
      within(screen.getByRole('list', { name: 'Eventos' })).getByText(
        'Festival de Hoje',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Festival de Hoje')).toHaveLength(2);
    expect(screen.queryByText('Festival Teste')).not.toBeInTheDocument();
  });

  it('should show the events loading notice in the Hoje card', async () => {
    mocks.useFixedEvents.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    await renderHome();
    expect(
      screen.getByRole('heading', { name: 'Eventos' }),
    ).toBeInTheDocument();
    for (const label of screen.getAllByText('Carregando eventos...'))
      expectLoading(label);
  });

  it('should show the home skeleton while the player data loads', async () => {
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
    expectLoading(await screen.findByText('Carregando o dia...'));
    expect(screen.getAllByTestId('skeleton-day')).toHaveLength(7);
  });
});
