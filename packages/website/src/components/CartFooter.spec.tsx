import { screen } from '@testing-library/react';
import { CartFooter } from './CartFooter';
import { renderWithIntl } from './renderWithIntl';

vi.mock('../hooks/useGameNames', () => ({
  useGameNames: () => ({ nameOf: (id: string) => id }),
}));

const TOTALS = {
  gold: 300,
  currencies: { qiGems: 5 },
  materials: [{ item: 'copper-bar', qty: 2 }],
};

describe('CartFooter', () => {
  it('should show the total, currencies, materials and the clear button in Portuguese', () => {
    renderWithIntl(<CartFooter totals={TOTALS} onClear={() => {}} />);
    expect(screen.getByText('Total: 300g')).toBeInTheDocument();
    expect(screen.getByText('5 gemas Qi')).toBeInTheDocument();
    expect(screen.getByText('2× copper-bar')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Limpar compra' }),
    ).toHaveAttribute('title', 'Limpar compra');
  });

  it('should show the total and the clear button in English', () => {
    renderWithIntl(<CartFooter totals={TOTALS} onClear={() => {}} />, {
      locale: 'en',
    });
    expect(screen.getByText('Total: 300g')).toBeInTheDocument();
    expect(screen.getByText('5 Qi Gems')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear purchase' }),
    ).toHaveAttribute('title', 'Clear purchase');
  });

  it('should render nothing when the cart is empty', () => {
    const { container } = renderWithIntl(
      <CartFooter
        totals={{ gold: 0, currencies: {}, materials: [] }}
        onClear={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
