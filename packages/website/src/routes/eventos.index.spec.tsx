import { screen } from '@testing-library/react';
import { expectLoading } from '../components/expectLoading';
import { renderWithRouter } from '../components/renderWithRouter';
import { Route } from './eventos.index';

const mocks = vi.hoisted(() => ({ useFixedEvents: vi.fn() }));
vi.mock('../hooks/useGameData', () => mocks);

const Page = Route.options.component as () => React.ReactElement;

describe('Eventos route', () => {
  it('should show a skeleton while the events load', async () => {
    mocks.useFixedEvents.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderWithRouter(<Page />);
    expectLoading(await screen.findByText('Carregando eventos...'));
  });
});
