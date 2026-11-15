import { screen } from '@testing-library/react';
import { expectLoading } from '../components/expectLoading';
import { renderWithRouter } from '../components/renderWithRouter';
import { FISH } from '../components/testData';
import { Route } from './peixes';

const mocks = vi.hoisted(() => ({ useMe: vi.fn(), useFish: vi.fn() }));
vi.mock('../hooks/useGameData', () => mocks);

const Page = Route.options.component as () => React.ReactElement;

const profile = (season: string, rainToday: boolean) => ({
  data: {
    profile: { currentDate: { year: 1, season, day: 3 }, rainToday },
  },
  isPending: false,
});

describe('Peixes route', () => {
  beforeEach(() => localStorage.clear());

  it('should show a skeleton while fish load', async () => {
    mocks.useMe.mockReturnValue(profile('spring', false));
    mocks.useFish.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderWithRouter(<Page />);
    expectLoading(await screen.findByText('Carregando peixes...'));
  });

  it('should show the error message when fish fail to load', async () => {
    mocks.useMe.mockReturnValue(profile('spring', false));
    mocks.useFish.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    renderWithRouter(<Page />);
    expect(
      await screen.findByText(
        'Não foi possível carregar os peixes. Recarregue a página.',
      ),
    ).toBeInTheDocument();
  });

  it('should start on the profile season and on Chuva when it rains', async () => {
    localStorage.setItem(
      'stardew.fishPrefs',
      JSON.stringify({ season: 'spring', weather: 'all', kind: 'all' }),
    );
    mocks.useMe.mockReturnValue(profile('winter', true));
    mocks.useFish.mockReturnValue({
      data: FISH,
      isPending: false,
      isError: false,
    });
    renderWithRouter(<Page />);
    expect(
      await screen.findByRole('button', { name: 'Chuva' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Caranguejo Teste')).toBeInTheDocument();
    expect(screen.queryByText('Duas Janelas')).not.toBeInTheDocument();
  });
});
