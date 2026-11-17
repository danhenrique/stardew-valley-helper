import { useParams } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildEvents } from '../lib/events';
import { EventDetailPage } from './EventDetailPage';
import { EventList } from './EventList';
import { expectLoading } from './expectLoading';
import { renderWithRouter } from './renderWithRouter';
import {
  PLANTABLES,
  TEST_DEADLINE_PLANTABLE,
  TEST_FESTIVAL,
  TEST_VILLAGER,
} from './testData';

const mocks = vi.hoisted(() => ({
  useFixedEvents: vi.fn(),
  usePlantables: vi.fn(),
  useVillagerGifts: vi.fn(),
  useFestivalShopsClosed: vi.fn(),
}));
vi.mock('../hooks/useGameData', () => mocks);
vi.mock('../hooks/useGameNames', async () => {
  const { humanizeId } = await import('../lib/i18n');
  return { useGameNames: () => ({ nameOf: humanizeId }) };
});

const EVENTS = buildEvents({
  festivals: [TEST_FESTIVAL],
  villagers: [TEST_VILLAGER],
  foraging: [],
  plantables: [TEST_DEADLINE_PLANTABLE],
});

const Page = () => {
  const { id } = useParams({ strict: false });
  return <EventDetailPage id={id ?? ''} />;
};
const detailRoute = { path: '/eventos/$id', component: Page };

const renderPage = (id: string) =>
  renderWithRouter(null, {
    initialPath: `/eventos/${encodeURIComponent(id)}`,
    pages: [detailRoute],
  });

beforeEach(() => {
  mocks.useFixedEvents.mockReturnValue({
    data: EVENTS,
    isPending: false,
    isError: false,
  });
  mocks.usePlantables.mockReturnValue({
    data: [...PLANTABLES, TEST_DEADLINE_PLANTABLE],
  });
  mocks.useVillagerGifts.mockReturnValue({
    status: 'success',
    tastes: {
      loves: [{ kind: 'item', id: 'test-golden-pumpkin', except: [] }],
      likes: [],
      neutral: [],
      dislikesOrHates: [],
    },
  });
  mocks.useFestivalShopsClosed.mockReturnValue(true);
});

describe('EventDetailPage', () => {
  it('should show not found with a link to the list when the id is unknown', async () => {
    renderPage('festival:test-unknown');
    expect(
      await screen.findByText('Evento não encontrado'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Voltar para eventos/ }),
    ).toHaveAttribute('href', '/calendario?aba=eventos');
  });

  it('should resolve an id that contains colons', async () => {
    renderPage('cropDeadline:test-deadline-seeds:spring');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sementes Prazo' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Primavera 20')).toBeInTheDocument();
  });

  it('should round-trip the id from a list link to the detail page', async () => {
    renderWithRouter(<EventList events={EVENTS} />, {
      pages: [detailRoute],
    });
    await userEvent.click(
      await screen.findByRole('link', { name: /Sementes Prazo/ }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sementes Prazo' }),
    ).toBeInTheDocument();
  });

  it('should show festival shop status and birthday gifts', async () => {
    renderPage('festival:test-festival');
    expect(await screen.findByText('Lojas fecham')).toBeInTheDocument();
  });

  it('should show loved gifts for a birthday', async () => {
    renderPage('birthday:test-villager');
    expect(await screen.findByText('Test Golden Pumpkin')).toBeInTheDocument();
  });

  it('should show loading and error states', async () => {
    mocks.useFixedEvents.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderPage('festival:test-festival');
    expectLoading(await screen.findByText('Carregando...'));
  });

  it('should show an error when events fail to load', async () => {
    mocks.useFixedEvents.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    renderPage('festival:test-festival');
    expect(
      await screen.findByText(
        'Não foi possível carregar o evento. Recarregue a página.',
      ),
    ).toBeInTheDocument();
  });
});
