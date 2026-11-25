import { screen, within } from '@testing-library/react';
import { expectLoading } from '../../components/expectLoading';
import { renderWithRouter } from '../../components/renderWithRouter';
import type { GameEntityOut } from '../../generated/stardew-valley-api/types.gen';
import { iconUrl } from '../../lib/icons';
import { buildShops } from '../../lib/shops';
import { Route } from './shops.index';

const mocks = vi.hoisted(() => ({
  useMe: vi.fn(),
  useShops: vi.fn(),
  useFixedEvents: vi.fn(),
}));
vi.mock('../../hooks/useGameData', () => mocks);

const Page = Route.options.component as () => React.ReactElement;
const WEDNESDAY = { year: 1, season: 'spring', day: 3 } as const;
const text = (s: string) => ({ en: s, ptBr: s });
const shopEntity = (
  id: string,
  name: string,
  schedule?: Record<string, unknown>,
  note?: string,
): GameEntityOut => ({
  type: 'shops',
  id,
  name: text(name),
  attributes: schedule
    ? { schedule, scheduleText: note ? { note: text(note) } : {} }
    : {},
});
const SHOPS = buildShops(
  [
    shopEntity('test-store', 'Armazém Teste', {
      hours: { open: '09:00', close: '17:00' },
      closedDaysBeforeCC: ['wed'],
      closedDaysAfterCC: [],
    }),
    shopEntity('test-fixed', 'Loja Fixa', {
      hours: { open: '10:00', close: '15:00' },
      closedDays: ['sat', 'sun'],
    }),
    shopEntity(
      'test-note',
      'Loja Nota',
      { hours: { open: '09:00', close: '17:00' } },
      'Nota teste',
    ),
    shopEntity('test-none', 'Sem Horário'),
  ],
  'pt-BR',
);

const mockMe = (profile: Record<string, unknown> = {}) =>
  mocks.useMe.mockReturnValue({
    data: { profile: { currentDate: WEDNESDAY, ...profile } },
    isPending: false,
    isError: false,
  });

const renderPage = (initialPath = '/shops') =>
  renderWithRouter(null, {
    initialPath,
    pages: [{ path: '/{-$locale}/shops', component: Page }],
  });

const cardOf = (name: string) =>
  screen.getByText(name).closest('li') as HTMLElement;
const findCard = async (name: string) => {
  await screen.findByText(name);
  return cardOf(name);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMe();
  mocks.useShops.mockReturnValue({
    data: SHOPS,
    isPending: false,
    isError: false,
  });
  mocks.useFixedEvents.mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
  });
});

describe('/shops page', () => {
  it('should show the shop closed on a Wednesday with the reason', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Lojas' });
    const card = cardOf('Armazém Teste');
    expect(within(card).getByText('Fechada')).toBeInTheDocument();
    expect(within(card).getByText('Fecha às quartas')).toBeInTheDocument();
    expect(within(card).getByText('Fecha: qua')).toBeInTheDocument();
  });

  it('should show the shop open once the Community Center is restored', async () => {
    mockMe({ communityCenterRestored: true });
    renderPage();
    const card = await findCard('Armazém Teste');
    expect(within(card).getByText('Aberta')).toBeInTheDocument();
    expect(within(card).getByText('9:00–17:00')).toBeInTheDocument();
  });

  it('should list the fixed closed weekdays', async () => {
    renderPage();
    const card = await findCard('Loja Fixa');
    expect(within(card).getByText('Fecha: sáb, dom')).toBeInTheDocument();
  });

  it('should show the schedule note in the observations', async () => {
    renderPage();
    const card = await findCard('Loja Nota');
    expect(within(card).getByText('Nota teste')).toBeInTheDocument();
  });

  it('should show no closed-days line when there are no fixed closed days', async () => {
    renderPage();
    const card = await findCard('Loja Nota');
    expect(within(card).queryByText(/^Fecha:/)).not.toBeInTheDocument();
  });

  it('should list a shop without a schedule', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Lojas' });
    expect(screen.getByText('Sem Horário')).toBeInTheDocument();
  });

  it('should show a loading notice', async () => {
    mocks.useShops.mockReturnValue({ isPending: true, isError: false });
    renderPage();
    expectLoading(await screen.findByText('Carregando lojas...'));
  });

  it('should show an error notice', async () => {
    mocks.useShops.mockReturnValue({ isPending: false, isError: true });
    renderPage();
    expect(
      await screen.findByText('Não foi possível carregar as lojas.'),
    ).toBeInTheDocument();
  });

  it('should show the shop sprite before the name when the shop has one', async () => {
    mocks.useShops.mockReturnValue({
      data: buildShops(
        [
          shopEntity('pierre', 'Armazém do Pierre', {
            hours: { open: '09:00', close: '17:00' },
          }),
        ],
        'pt-BR',
      ),
      isPending: false,
      isError: false,
    });
    renderPage();
    const card = await findCard('Armazém do Pierre');
    expect(card.querySelector('img')).toHaveAttribute('src', iconUrl('pierre'));
  });
});

describe('/shops page links', () => {
  it('should link each shop name to its catalog page', async () => {
    renderPage();
    const card = await findCard('Loja Fixa');
    expect(within(card).getByRole('link')).toHaveAttribute(
      'href',
      '/shops/test-fixed',
    );
  });

  it('should keep the en prefix in the catalog links under /en/shops', async () => {
    renderPage('/en/shops');
    const card = await findCard('Loja Fixa');
    expect(within(card).getByRole('link')).toHaveAttribute(
      'href',
      '/en/shops/test-fixed',
    );
  });
});

describe('Shops route in English', () => {
  it('should show the English heading, badges and closed days under /en/shops', async () => {
    mockMe();
    mocks.useShops.mockReturnValue({
      data: SHOPS,
      isPending: false,
      isError: false,
    });
    mocks.useFixedEvents.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    renderPage('/en/shops');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Shops' }),
    ).toBeInTheDocument();
    const fixed = cardOf('Loja Fixa');
    expect(within(fixed).getByText('Open')).toBeInTheDocument();
    expect(within(fixed).getByText('Closed: Sat, Sun')).toBeInTheDocument();
    expect(
      within(cardOf('Sem Horário')).getByText('No fixed hours'),
    ).toBeInTheDocument();
  });

  it('should show the error text in English when the shops fail to load', async () => {
    mockMe();
    mocks.useShops.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    mocks.useFixedEvents.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    renderPage('/en/shops');
    expect(
      await screen.findByText('Could not load the shops.'),
    ).toBeInTheDocument();
  });
});
