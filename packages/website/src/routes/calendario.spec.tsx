import { screen, within } from '@testing-library/react';
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
import { Route } from './calendario';

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

const renderCalendar = async () => {
  renderWithRouter(<Page />);
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
    renderWithRouter(<Page />);
    expectLoading(await screen.findByText('Carregando calendário...'));
    expect(screen.getAllByTestId('skeleton-day')).toHaveLength(28);
  });
});
