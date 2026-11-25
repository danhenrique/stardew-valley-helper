import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildEvents } from '../lib/events';
import { emptyTastes } from '../lib/gifts';
import { renderWithRouter } from './renderWithRouter';
import {
  BERRY_PLANTING,
  MACHINE_SCHEDULE,
  MACHINES,
  machineBatch,
  NAMES,
  TEST_FESTIVAL,
  TEST_VILLAGER,
} from './testData';
import { UpcomingDays } from './UpcomingDays';

const mocks = vi.hoisted(() => ({ useVillagerGifts: vi.fn() }));
vi.mock('../hooks/useGameData', () => mocks);
vi.mock('../hooks/useGameNames', () => ({
  useGameNames: () => ({ nameOf: (id: string) => id }),
}));

const EVENTS = buildEvents({
  festivals: [TEST_FESTIVAL],
  villagers: [TEST_VILLAGER],
  foraging: [],
  plantables: [],
});
// Birthday on spring 5, berry harvest on spring 9, keg ready on spring 4.
const KEG = machineBatch({
  schedule: {
    ...MACHINE_SCHEDULE,
    readyOn: { year: 1, season: 'spring', day: 4 },
  },
});
const SPRING_3 = { year: 1, season: 'spring', day: 3 } as const;

const renderDays = async (
  today: {
    year: number;
    season: 'spring' | 'summer' | 'fall' | 'winter';
    day: number;
  } = SPRING_3,
  machineCatalogStatus: 'pending' | 'error' | 'success' = 'success',
) => {
  renderWithRouter(
    <UpcomingDays
      events={EVENTS}
      today={today}
      plantings={[BERRY_PLANTING]}
      names={NAMES}
      machines={[KEG]}
      machineCatalog={MACHINES}
      machineCatalogStatus={machineCatalogStatus}
    />,
  );
  await screen.findByRole('heading', { name: 'Próximos dias' });
};
const cells = () => screen.getAllByTestId(/^upcoming-day-/);

beforeEach(() => {
  mocks.useVillagerGifts.mockReturnValue({
    status: 'success',
    tastes: emptyTastes(),
  });
});

describe('UpcomingDays', () => {
  it('should show seven days starting today when rendered', async () => {
    await renderDays();
    expect(cells()).toHaveLength(7);
    expect(cells()[0]).toHaveAttribute('data-is-today');
    expect(cells()[1]).not.toHaveAttribute('data-is-today');
    expect(within(cells()[0]).getByText('Qua 3')).toBeInTheDocument();
    expect(within(cells()[6]).getByText('Ter 9')).toBeInTheDocument();
  });

  it('should name the new season when the window crosses day 28', async () => {
    await renderDays({ year: 1, season: 'spring', day: 27 });
    expect(within(cells()[2]).getByText('Seg 1')).toBeInTheDocument();
    expect(within(cells()[2]).getByText('Verão')).toBeInTheDocument();
  });

  it('should show the birthday, harvest and machine of their days', async () => {
    await renderDays();
    expect(within(cells()[2]).getByText('Aldeão Teste')).toBeInTheDocument();
    expect(
      within(cells()[6]).getByText('Sementes de Fruta'),
    ).toBeInTheDocument();
  });

  it('should open the gifts modal when a birthday is clicked', async () => {
    await renderDays();
    await userEvent.click(screen.getByRole('button', { name: /Aldeão Teste/ }));
    expect(
      await screen.findByRole('dialog', {
        name: 'Aniversário de Aldeão Teste',
      }),
    ).toBeInTheDocument();
  });

  it('should link a festival to its page and a harvest to the plantings when rendered', async () => {
    await renderDays({ year: 1, season: 'spring', day: 9 });
    // The festival runs on two days of the window, so it shows twice.
    const [festival] = screen.getAllByRole('link', { name: /Festival Teste/ });
    expect(festival).toHaveAttribute(
      'href',
      expect.stringContaining('/events/'),
    );
    // The berry regrows, so it may be harvested more than once in the window.
    const [harvest] = screen.getAllByRole('link', {
      name: /Sementes de Fruta/,
    });
    expect(harvest).toHaveAttribute('href', '/farming?tab=plantings');
  });

  it('should link a machine date to the machines page', async () => {
    await renderDays();
    const machine = within(cells()[1]).getByRole('link');
    expect(machine).toHaveAttribute('href', '/farming?tab=machines');
  });

  it('should keep events and warn when the machine catalog fails', async () => {
    await renderDays(SPRING_3, 'error');
    expect(within(cells()[2]).getByText('Aldeão Teste')).toBeInTheDocument();
    expect(within(cells()[1]).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível carregar/)).toBeInTheDocument();
  });
});

describe('UpcomingDays in English', () => {
  it('should show the heading and the English weekday and season names', async () => {
    renderWithRouter(
      <UpcomingDays
        events={EVENTS}
        today={{ year: 1, season: 'spring', day: 28 }}
        plantings={[]}
        names={NAMES}
      />,
      { locale: 'en' },
    );
    expect(
      await screen.findByRole('heading', { name: 'Upcoming days' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sun 28')).toBeInTheDocument();
    expect(screen.getByText('Summer')).toBeInTheDocument();
  });
});
