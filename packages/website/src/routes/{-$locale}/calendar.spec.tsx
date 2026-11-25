import { createRouter } from '@tanstack/react-router';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectLoading } from '../../components/expectLoading';
import { renderWithRouter } from '../../components/renderWithRouter';
import {
  BERRY_PLANTING,
  MACHINE_SCHEDULE,
  MACHINES,
  machineBatch,
  PLANTABLES,
  SPRING_1,
  TEST_FESTIVAL,
} from '../../components/testData';
import { buildEvents } from '../../lib/events';
import { routeTree } from '../../routeTree.gen';
import { parseCalendarSearch, Route } from './calendar';

const mocks = vi.hoisted(() => ({
  useMe: vi.fn(),
  usePlantables: vi.fn(),
  useFixedEvents: vi.fn(),
  useMachines: vi.fn(),
}));
vi.mock('../../hooks/useGameData', () => mocks);

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

const renderAt = (path = '/calendar') =>
  renderWithRouter(null, {
    initialPath: path,
    pages: [{ path: '/{-$locale}/calendar', component: Page }],
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
    renderAt('/calendar?tab=events');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Primavera' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Primavera, Ano 1' }),
    ).not.toBeInTheDocument();
  });

  it('should fall back to the calendar tab on an unknown tab', async () => {
    renderAt('/calendar?tab=xyz');
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
    expect(router.state.location.search).toEqual({ tab: 'events' });
  });

  it('should show a skeleton while the events of the events tab load', async () => {
    mocks.useFixedEvents.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderAt('/calendar?tab=events');
    expectLoading(await screen.findByText('Carregando eventos...'));
  });

  it('should open the events tab under the en locale and keep the prefix on tab change', async () => {
    const router = renderAt('/en/calendar?tab=events');
    await screen.findByRole('heading', { level: 2, name: 'Spring' });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Calendar' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Events' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    await screen.findByRole('heading', { name: 'Spring, Year 1' });
    expect(router.state.location.pathname).toBe('/en/calendar');
    expect(router.state.location.search).toEqual({ tab: 'calendar' });
  });

  it('should parse the tab of the search', () => {
    expect(parseCalendarSearch({})).toEqual({ tab: 'calendar' });
    expect(parseCalendarSearch({ tab: 'events' })).toEqual({ tab: 'events' });
    expect(parseCalendarSearch({ tab: 1 })).toEqual({ tab: 'calendar' });
  });
});

describe('Calendar tab history', () => {
  it('should switch tabs without adding history entries', async () => {
    const router = renderAt();
    await screen.findByRole('heading', { name: 'Primavera, Ano 1' });
    const before = router.history.length;
    await userEvent.click(screen.getByRole('button', { name: 'Eventos' }));
    await screen.findByRole('heading', { level: 2, name: 'Primavera' });
    expect(router.history.length).toBe(before);
  });
});

describe('Events routes in the app route tree', () => {
  it('should match an event id to the detail page', () => {
    const router = createRouter({ routeTree });
    expect(router.matchRoutes('/events/festival:egg')?.at(-1)?.routeId).toBe(
      '/{-$locale}/events/$id',
    );
  });
});
