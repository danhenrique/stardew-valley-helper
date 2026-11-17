import { render, screen, within } from '@testing-library/react';
import type { ShopOffer } from '../lib/shopCatalog';
import { ShopCatalog } from './ShopCatalog';

vi.mock('../hooks/useGameNames', () => ({
  useGameNames: () => ({
    nameOf: (id: string) =>
      ({
        'test-seed': 'Semente Teste',
        'copper-bar': 'Barra de Cobre',
        'test-tool': 'Ferramenta Teste',
        'test-geode': 'Geodo Teste',
      })[id] ?? id,
  }),
}));

const DATE = { year: 1, season: 'spring' as const, day: 1 };
const renderCatalog = (offers: ShopOffer[]) =>
  render(<ShopCatalog offers={offers} date={DATE} />);

describe('ShopCatalog', () => {
  it('should show each offer with its localized name, price and tags', () => {
    renderCatalog([{ itemId: 'test-seed', price: 250, recipe: true }]);
    const row = screen.getByRole('listitem');
    expect(within(row).getByText('Semente Teste')).toBeInTheDocument();
    expect(within(row).getByText('250g')).toBeInTheDocument();
    expect(within(row).getByText('Receita')).toBeInTheDocument();
  });

  it('should show materials with their quantity', () => {
    renderCatalog([
      {
        itemId: 'test-tool',
        price: 2000,
        materials: [{ item: 'copper-bar', qty: 5 }],
      },
    ]);
    expect(screen.getByText('5× Barra de Cobre')).toBeInTheDocument();
  });

  it('should show gold and a currency together', () => {
    renderCatalog([
      { itemId: 'test-seed', price: 500, currency: { qiGems: 10 } },
    ]);
    expect(screen.getByText('500g')).toBeInTheDocument();
    expect(screen.getByText('10 gemas Qi')).toBeInTheDocument();
  });

  it('should group offers by section in order of first appearance', () => {
    renderCatalog([
      { itemId: 'test-tool', price: 2000, section: 'upgrade' },
      { itemId: 'test-geode', price: 25, section: 'geode' },
    ]);
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(['Melhorias', 'Geodos']);
  });

  it('should not show section headings when no offer has a section', () => {
    renderCatalog([{ itemId: 'test-seed', price: 20 }]);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('should warn that part of a rotating stock is random', () => {
    renderCatalog([{ itemId: 'test-seed', price: 20, rotating: true }]);
    expect(
      screen.getByText('Parte do estoque é sorteada pelo jogo'),
    ).toBeInTheDocument();
  });

  it('should say nothing is on sale when there are no offers', () => {
    renderCatalog([]);
    expect(screen.getByText('Nada à venda neste dia.')).toBeInTheDocument();
  });
});

describe('ShopCatalog quantities', () => {
  it('should show a quantity stepper only on offers that cost something', () => {
    render(
      <ShopCatalog
        offers={[
          { itemId: 'test-seed', price: 20 },
          {
            itemId: 'test-gift',
            special: 'onlyOneAtMaxKrobusFriendshipWhileSingle',
          },
        ]}
        date={DATE}
        quantities={[0, 0]}
        onQuantityChange={() => {}}
      />,
    );
    expect(
      screen.getByLabelText('Quantidade de Semente Teste'),
    ).toHaveAttribute('max', '999');
    expect(
      screen.queryByLabelText('Quantidade de test-gift'),
    ).not.toBeInTheDocument();
  });

  it('should show no stepper without quantities', () => {
    renderCatalog([{ itemId: 'test-seed', price: 20 }]);
    expect(
      screen.queryByLabelText('Quantidade de Semente Teste'),
    ).not.toBeInTheDocument();
  });
});

describe('ShopCatalog free offers', () => {
  it('should say a free offer is free instead of 0g', () => {
    renderCatalog([{ itemId: 'test-seed', price: 0 }]);
    expect(screen.getByText('Grátis')).toBeInTheDocument();
    expect(screen.queryByText('0g')).not.toBeInTheDocument();
  });
});
