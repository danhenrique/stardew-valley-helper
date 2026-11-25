import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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
  type: 'shops',
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

const renderPage = async (shopId = 'test-store', initialPath?: string) => {
  if (initialPath)
    renderWithRouter(null, {
      initialPath,
      pages: [
        {
          path: '/{-$locale}/shops/$id',
          component: () => <ShopCatalogPage shopId={shopId} />,
        },
      ],
    });
  else renderWithRouter(<ShopCatalogPage shopId={shopId} />);
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
    data: buildShops([SHOP], 'pt-BR'),
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
      data: buildShops([rainShop], 'pt-BR'),
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

  it('should render the shop under /en/shops/<id> and keep the prefix in the back link', async () => {
    await renderPage('test-store', '/en/shops/test-store');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Armazém Teste' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View all shops' }),
    ).toHaveAttribute('href', '/en/shops');
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
    ).toHaveAttribute('href', '/shops');
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

  it('should add up the purchase in the footer', async () => {
    mocks.useShopOffers.mockReturnValue({
      status: 'success',
      offers: [
        { itemId: 'a-item', price: 50 },
        { itemId: 'b-item', price: 30 },
        { itemId: 'gem-item', price: 0, currency: { qiGems: 2 } },
        {
          itemId: 'wood-item',
          price: 0,
          materials: [{ item: 'wood', qty: 10 }],
        },
      ],
    });
    await renderPage();
    expect(screen.queryByText(/^Total:/)).not.toBeInTheDocument();
    const more = (item: string) =>
      userEvent.click(screen.getByLabelText(`Aumentar Quantidade de ${item}`));
    await more('a-item');
    await more('a-item');
    await more('b-item');
    expect(screen.getByText('Total: 130g')).toBeInTheDocument();
    await more('gem-item');
    await more('gem-item');
    await more('gem-item');
    expect(screen.getByText('6 gemas Qi')).toBeInTheDocument();
    await more('wood-item');
    await more('wood-item');
    expect(screen.getByText('20× wood')).toBeInTheDocument();
  });

  it('should clear the purchase', async () => {
    await renderPage();
    await userEvent.click(
      screen.getByLabelText('Aumentar Quantidade de every-day-item'),
    );
    const clear = screen.getByRole('button', { name: 'Limpar compra' });
    expect(clear).toHaveAttribute('title', 'Limpar compra');
    await userEvent.click(clear);
    expect(screen.queryByText(/^Total:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Quantidade de every-day-item')).toHaveValue(
      0,
    );
  });

  it('should clear the purchase when the date changes', async () => {
    await renderPage();
    await userEvent.click(
      screen.getByLabelText('Aumentar Quantidade de every-day-item'),
    );
    expect(screen.getByText('Total: 10g')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Dia'), '2');
    expect(screen.queryByText(/^Total:/)).not.toBeInTheDocument();
  });

  it('should clear the purchase when the game day moves on', async () => {
    // Re-renders the page on demand, as a profile refetch would.
    const Harness = () => {
      const [, setTick] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            refetch
          </button>
          <ShopCatalogPage shopId="test-store" />
        </>
      );
    };
    renderWithRouter(<Harness />);
    await screen.findByRole('heading', { level: 1 });
    await userEvent.click(
      screen.getByLabelText('Aumentar Quantidade de every-day-item'),
    );
    expect(screen.getByText('Total: 10g')).toBeInTheDocument();
    mocks.useMe.mockReturnValue({
      data: { profile: { currentDate: { ...MONDAY, day: 2 } } },
      isPending: false,
      isError: false,
    });
    await userEvent.click(screen.getByRole('button', { name: 'refetch' }));
    expect(await screen.findByText('tuesday-item')).toBeInTheDocument();
    expect(screen.queryByText(/^Total:/)).not.toBeInTheDocument();
  });
});

describe('ShopCatalogPage in English', () => {
  it('should show the English status, closed reason and back link', async () => {
    await renderPage('test-store', '/en/shops/test-store');
    expect(screen.getByText('Open · 9:00–17:00')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View all shops' }),
    ).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Day'), '3');
    expect(
      screen.getByText('Closed · Closed on Wednesdays'),
    ).toBeInTheDocument();
  });

  it('should say the shop was not found in English', async () => {
    renderWithRouter(<ShopCatalogPage shopId="missing" />, { locale: 'en' });
    expect(await screen.findByText('Shop not found')).toBeInTheDocument();
  });
});
