import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameEntityOut } from '../generated/stardew-valley-api/types.gen';
import { buildShops } from '../lib/shops';
import { expectLoading } from './expectLoading';
import { renderWithRouter } from './renderWithRouter';
import { ShopCatalogPage } from './ShopCatalogPage';

const mocks = vi.hoisted(() => ({
  useMe: vi.fn(),
  useShops: vi.fn(),
  useFixedEvents: vi.fn(),
  useShopOffers: vi.fn(),
}));
vi.mock('../hooks/useGameData', () => mocks);
vi.mock('../hooks/useGameNames', () => ({
  useGameNames: () => ({ nameOf: (id: string) => id }),
}));

const text = (s: string) => ({ en: s, ptBr: s });
const SHOP: GameEntityOut = {
  type: 'lojas',
  id: 'test-store',
  name: text('Armazém Teste'),
  attributes: {
    schedule: { hours: { open: '09:00', close: '17:00' }, closedDays: ['wed'] },
    scheduleText: {},
  },
};
// Day 1 is a Monday.
const MONDAY = { year: 1, season: 'spring', day: 1 } as const;
const OFFERS = [
  { itemId: 'every-day-item', price: 10 },
  { itemId: 'tuesday-item', price: 10, availability: 'tue' },
  { itemId: 'year-two-item', price: 10, fromYear: 2 },
];

const renderPage = async (shopId = 'test-store') => {
  renderWithRouter(<ShopCatalogPage shopId={shopId} />);
  await screen.findByRole('heading', { level: 1 });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useMe.mockReturnValue({
    data: { profile: { currentDate: MONDAY } },
    isPending: false,
    isError: false,
  });
  mocks.useShops.mockReturnValue({
    data: buildShops([SHOP]),
    isPending: false,
    isError: false,
  });
  mocks.useFixedEvents.mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
  });
  mocks.useShopOffers.mockReturnValue({ status: 'success', offers: OFFERS });
});

describe('ShopCatalogPage', () => {
  it('should open on the current game date with the shop status', async () => {
    await renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Armazém Teste' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Aberta · 9:00–17:00')).toBeInTheDocument();
    expect(screen.getByText('every-day-item')).toBeInTheDocument();
    expect(screen.queryByText('tuesday-item')).not.toBeInTheDocument();
  });

  it('should show the offers of another day when the day changes', async () => {
    await renderPage();
    await userEvent.selectOptions(screen.getByLabelText('Dia'), '2');
    expect(screen.getByText('tuesday-item')).toBeInTheDocument();
  });

  it('should show why the shop is closed on the chosen day', async () => {
    await renderPage();
    await userEvent.selectOptions(screen.getByLabelText('Dia'), '3');
    expect(screen.getByText('Fechada · Fecha às quartas')).toBeInTheDocument();
  });

  it('should apply the rain only to the current game date when another day is chosen', async () => {
    const rainShop = {
      ...SHOP,
      attributes: {
        ...SHOP.attributes,
        schedule: {
          hours: { open: '09:00', close: '17:00' },
          closedIfRain: true,
        },
      },
    };
    mocks.useShops.mockReturnValue({
      data: buildShops([rainShop]),
      isPending: false,
      isError: false,
    });
    mocks.useMe.mockReturnValue({
      data: { profile: { currentDate: MONDAY, rainToday: true } },
      isPending: false,
      isError: false,
    });
    await renderPage();
    expect(screen.getByText('Fechada · Chuva')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Dia'), '2');
    expect(screen.getByText('Aberta · 9:00–17:00')).toBeInTheDocument();
  });

  it('should show later-year offers when the year changes', async () => {
    await renderPage();
    const year = screen.getByLabelText('Ano');
    await userEvent.clear(year);
    await userEvent.type(year, '2');
    expect(screen.getByText('year-two-item')).toBeInTheDocument();
  });

  it('should say the shop does not exist for an unknown id', async () => {
    renderWithRouter(<ShopCatalogPage shopId="missing" />);
    expect(await screen.findByText('Loja não encontrada')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver todas as lojas' }),
    ).toHaveAttribute('href', '/lojas');
  });

  it('should keep the header when the offers fail to load', async () => {
    mocks.useShopOffers.mockReturnValue({ status: 'error', offers: [] });
    await renderPage();
    expect(screen.getByText('Aberta · 9:00–17:00')).toBeInTheDocument();
    expect(
      screen.getByText('Não foi possível carregar o catálogo.'),
    ).toBeInTheDocument();
  });

  it('should show a skeleton while the shop loads', async () => {
    mocks.useMe.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderWithRouter(<ShopCatalogPage shopId="test-store" />);
    expectLoading(await screen.findByText('Carregando loja...'));
  });

  it('should show a list skeleton while the offers load', async () => {
    mocks.useShopOffers.mockReturnValue({ status: 'pending', offers: [] });
    await renderPage();
    expectLoading(screen.getByText('Carregando catálogo...'));
  });
});
