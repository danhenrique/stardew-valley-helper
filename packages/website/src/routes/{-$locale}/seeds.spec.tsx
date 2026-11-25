import { cleanup, screen } from '@testing-library/react';
import { expectLoading } from '../../components/expectLoading';
import { renderWithRouter } from '../../components/renderWithRouter';
import { PLANTABLES } from '../../components/testData';
import { Route } from './seeds';

const mocks = vi.hoisted(() => ({
  useMe: vi.fn(),
  usePlantables: vi.fn(),
  useSeedValues: vi.fn(),
}));
vi.mock('../../hooks/useGameData', () => mocks);

const Page = Route.options.component as () => React.ReactElement;

describe('Sementes route', () => {
  it('should show a skeleton while the seeds load', async () => {
    mocks.useMe.mockReturnValue({ data: undefined, isPending: true });
    mocks.usePlantables.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderWithRouter(<Page />);
    expectLoading(await screen.findByText('Carregando sementes...'));
  });

  it('should pass the profile date and agriculturist to the catalog when the profile loads', async () => {
    mocks.useMe.mockReturnValue({
      data: {
        profile: {
          currentDate: { year: 1, season: 'summer', day: 5 },
          agriculturist: true,
          artisan: false,
        },
      },
      isPending: false,
    });
    mocks.usePlantables.mockReturnValue({
      data: PLANTABLES,
      isPending: false,
      isError: false,
    });
    mocks.useSeedValues.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    renderWithRouter(<Page />);
    expect(await screen.findByText('Sementes de Melão')).toBeInTheDocument();
    expect(mocks.useSeedValues).toHaveBeenLastCalledWith(
      expect.objectContaining({
        season: 'summer',
        fromDay: 5,
        agriculturist: true,
        artisan: false,
      }),
    );
  });

  it('should render under /en/seeds', async () => {
    mocks.useMe.mockReturnValue({
      data: {
        profile: {
          currentDate: { year: 1, season: 'summer', day: 5 },
          agriculturist: false,
          artisan: false,
        },
      },
      isPending: false,
    });
    mocks.usePlantables.mockReturnValue({
      data: PLANTABLES,
      isPending: false,
      isError: false,
    });
    mocks.useSeedValues.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    const router = renderWithRouter(null, {
      initialPath: '/en/seeds',
      pages: [{ path: '/{-$locale}/seeds', component: Page }],
    });
    expect(await screen.findByText('Melon Seeds')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/en/seeds');
  });
});

describe('Seeds route in English', () => {
  it('should show the English heading, loading text and seed names under /en', async () => {
    mocks.useMe.mockReturnValue({ data: undefined, isPending: true });
    mocks.usePlantables.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderWithRouter(<Page />, { locale: 'en' });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Seeds' }),
    ).toBeInTheDocument();
    expectLoading(await screen.findByText('Loading seeds...'));
    cleanup();
    mocks.usePlantables.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    renderWithRouter(<Page />, { locale: 'en' });
    expect(
      await screen.findByText('Could not load the seeds. Reload the page.'),
    ).toBeInTheDocument();
  });
});
