import { screen, waitFor } from '@testing-library/react';
import type { Shop, ShopStatus } from '../lib/shops';
import { expectLoading } from './expectLoading';
import { renderWithRouter } from './renderWithRouter';
import { ShopCatalogModal } from './ShopCatalogModal';

const mocks = vi.hoisted(() => ({ useShopOffers: vi.fn() }));
vi.mock('../hooks/useGameData', () => mocks);
vi.mock('../hooks/useGameNames', () => ({
  useGameNames: () => ({ nameOf: (id: string) => id }),
}));

const SHOP: Shop = {
  id: 'test-shop',
  name: { en: 'Test Shop', ptBr: 'Loja Teste' },
  schedule: {},
  notes: {},
};
const STATUS: ShopStatus = { status: 'open', hours: ['9:00–17:00'], notes: [] };
// Day 1 is a Monday.
const TODAY = { year: 1, season: 'spring' as const, day: 1 };

const renderModal = async (open = true) => {
  renderWithRouter(
    <ShopCatalogModal
      shop={SHOP}
      status={STATUS}
      today={TODAY}
      open={open}
      onClose={() => {}}
    />,
  );
  if (open) await screen.findByRole('dialog');
};

describe('ShopCatalogModal', () => {
  it('should title the dialog with the shop and its hours today', async () => {
    mocks.useShopOffers.mockReturnValue({ status: 'success', offers: [] });
    await renderModal();
    expect(
      screen.getByRole('dialog', { name: 'Loja Teste' }),
    ).toBeInTheDocument();
    expect(screen.getByText('9:00–17:00')).toBeInTheDocument();
  });

  it('should show the notes of the shop next to its hours', async () => {
    mocks.useShopOffers.mockReturnValue({ status: 'success', offers: [] });
    renderWithRouter(
      <ShopCatalogModal
        shop={SHOP}
        status={{ ...STATUS, notes: ['Fecha se chover'] }}
        today={TODAY}
        open
        onClose={() => {}}
      />,
    );
    expect(
      await screen.findByText('9:00–17:00 · Fecha se chover'),
    ).toBeInTheDocument();
  });

  it('should show only the offers on sale today', async () => {
    mocks.useShopOffers.mockReturnValue({
      status: 'success',
      offers: [
        { itemId: 'monday-item', price: 10, availability: 'mon' },
        { itemId: 'tuesday-item', price: 10, availability: 'tue' },
      ],
    });
    await renderModal();
    expect(screen.getByText('monday-item')).toBeInTheDocument();
    expect(screen.queryByText('tuesday-item')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Quantidade de monday-item'),
    ).not.toBeInTheDocument();
  });

  it('should show the loading and error states', async () => {
    mocks.useShopOffers.mockReturnValue({ status: 'pending', offers: [] });
    await renderModal();
    expectLoading(screen.getByText('Carregando catálogo...'));
  });

  it('should show an error when the catalog fails to load', async () => {
    mocks.useShopOffers.mockReturnValue({ status: 'error', offers: [] });
    await renderModal();
    expect(
      screen.getByText('Não foi possível carregar o catálogo.'),
    ).toBeInTheDocument();
  });

  it('should link to the full catalog page', async () => {
    mocks.useShopOffers.mockReturnValue({ status: 'success', offers: [] });
    await renderModal();
    expect(
      screen.getByRole('link', { name: 'Ver catálogo completo' }),
    ).toHaveAttribute('href', '/lojas/test-shop');
  });

  it('should fetch the offers only while open', async () => {
    mocks.useShopOffers.mockClear();
    mocks.useShopOffers.mockReturnValue({ status: 'pending', offers: [] });
    renderWithRouter(
      <ShopCatalogModal
        shop={SHOP}
        status={STATUS}
        today={TODAY}
        open={false}
        onClose={() => {}}
      />,
    );
    await waitFor(() =>
      expect(mocks.useShopOffers).toHaveBeenLastCalledWith('test-shop', false),
    );
  });
});
