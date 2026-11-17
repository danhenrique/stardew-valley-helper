import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectLoading } from '../components/expectLoading';
import { renderWithRouter } from '../components/renderWithRouter';
import {
  BERRY_PLANTING,
  MACHINE_SCHEDULE,
  MACHINES,
  machineBatch,
  PLANTABLES,
  SPRING_1,
  TEST_FESTIVAL,
} from '../components/testData';
import { buildEvents } from '../lib/events';
import { parseCalendarSearch, Route } from './calendario';
import { Route as EventsRoute } from './eventos.index';

const mocks = vi.hoisted(() => ({
  useMe: vi.fn(),
  usePlantables: vi.fn(),
  useFixedEvents: vi.fn(),
  useMachines: vi.fn(),
}));
vi.mock('../hooks/useGameData', () => mocks);

const Page = Route.options.component as () => React.ReactElement;

const KEG = machineBatch({
  label: 'Adega',
  schedule: {
    ...MACHINE_SCHEDULE,
    readyOn: { year: 1, season: 'spring', day: 3 },
  },
});
const dayCell = (day: number) => screen.getByTestId(`calendar-day-${day}`);

beforeEach(() => {
  mocks.useMe.mockReturnValue({
    data: {
      profile: { currentDate: SPRING_1, agriculturist: false },
      plantings: [BERRY_PLANTING],
      machines: [KEG],
    },
    isPending: false,
    isError: false,
  });
  mocks.usePlantables.mockReturnValue({ data: PLANTABLES, isPending: false });
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
  mocks.useMachines.mockReturnValue({
    data: MACHINES,
    isPending: false,
    isError: false,
  });
});

const renderAt = (path = '/calendario') =>
  renderWithRouter(null, {
    initialPath: path,
    pages: [{ path: '/calendario', component: Page }],
  });
const renderCalendar = async () => {
  renderAt();
  await screen.findByRole('heading', { name: 'Primavera, Ano 1' });
};

describe('Calendar route', () => {
  it('should mark machine dates once the catalog is loaded', async () => {
    await renderCalendar();
    expect(within(dayCell(3)).getByText(/Adega/)).toBeInTheDocument();
  });

  it('should hide machine markers and keep harvests while the catalog is pending', async () => {
    mocks.useMachines.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    await renderCalendar();
    expectLoading(screen.getByText('Carregando máquinas...'));
    expect(within(dayCell(3)).queryByText(/Adega/)).not.toBeInTheDocument();
    expect(
      within(dayCell(9)).getByText('Sementes de Fruta'),
    ).toBeInTheDocument();
    expect(within(dayCell(13)).getByText('Festival Teste')).toBeInTheDocument();
  });

  it('should show an error and keep harvests when the catalog fails', async () => {
    mocks.useMachines.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    await renderCalendar();
    expect(
      screen.getByText(
        'Não foi possível carregar as máquinas. Recarregue a página.',
      ),
    ).toBeInTheDocument();
    expect(within(dayCell(3)).queryByText(/Adega/)).not.toBeInTheDocument();
    expect(
      within(dayCell(9)).getByText('Sementes de Fruta'),
    ).toBeInTheDocument();
    expect(within(dayCell(13)).getByText('Festival Teste')).toBeInTheDocument();
  });

  it('should show a calendar skeleton while the events load', async () => {
    mocks.useMe.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderAt();
    expectLoading(await screen.findByText('Carregando calendário...'));
    expect(screen.getAllByTestId('skeleton-day')).toHaveLength(28);
  });
});

describe('Calendar tabs', () => {
  it('should open on the calendar tab under the page title', async () => {
    await renderCalendar();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Calendário' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calendário' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('should open the events tab from the search', async () => {
    renderAt('/calendario?aba=eventos');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Primavera' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Primavera, Ano 1' }),
    ).not.toBeInTheDocument();
  });

  it('should fall back to the calendar tab on an unknown tab', async () => {
    renderAt('/calendario?aba=xyz');
    expect(
      await screen.findByRole('heading', { name: 'Primavera, Ano 1' }),
    ).toBeInTheDocument();
  });

  it('should switch to the events tab and keep it in the URL', async () => {
    const router = renderAt();
    await screen.findByRole('heading', { name: 'Primavera, Ano 1' });
    await userEvent.click(screen.getByRole('button', { name: 'Eventos' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Primavera' }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ aba: 'eventos' });
  });

  it('should show a skeleton while the events of the events tab load', async () => {
    mocks.useFixedEvents.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderAt('/calendario?aba=eventos');
    expectLoading(await screen.findByText('Carregando eventos...'));
  });

  it('should redirect the old events page to the events tab', async () => {
    const router = renderWithRouter(null, {
      initialPath: '/eventos',
      pages: [
        { path: '/calendario', component: Page },
        {
          path: '/eventos/',
          beforeLoad: EventsRoute.options.beforeLoad as () => void,
        },
      ],
    });
    await screen.findByRole('heading', { level: 2, name: 'Primavera' });
    expect(router.state.location.pathname).toBe('/calendario');
    expect(router.state.location.search).toEqual({ aba: 'eventos' });
  });

  it('should parse the tab of the search', () => {
    expect(parseCalendarSearch({})).toEqual({ aba: 'calendario' });
    expect(parseCalendarSearch({ aba: 'eventos' })).toEqual({ aba: 'eventos' });
    expect(parseCalendarSearch({ aba: 1 })).toEqual({ aba: 'calendario' });
  });
});
