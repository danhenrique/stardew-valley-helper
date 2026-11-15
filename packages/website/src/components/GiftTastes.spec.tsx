import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyTastes, type GiftTastes as Tastes } from '../lib/gifts';
import { GiftTastes } from './GiftTastes';

vi.mock('../hooks/useGameNames', () => ({
  useGameNames: () => ({
    nameOf: (id: string) =>
      ({
        'test-flowers': 'Flores',
        'test-poppy': 'Papoula',
        'test-pearl': 'Pérola',
        'test-rock': 'Pedra',
        'test-trash': 'Lixo',
      })[id] ?? id,
  }),
}));

const TASTES: Tastes = {
  ...emptyTastes(),
  loves: [{ kind: 'item', id: 'test-pearl', except: [] }],
  likes: [{ kind: 'category', id: 'test-flowers', except: ['test-poppy'] }],
};
const WITH_OTHERS: Tastes = {
  ...TASTES,
  neutral: [{ kind: 'item', id: 'test-rock', except: [] }],
  dislikesOrHates: [{ kind: 'item', id: 'test-trash', except: [] }],
};

const headings = () => screen.getAllByRole('heading').map((h) => h.textContent);

describe('GiftTastes', () => {
  it('should show loves before likes and skip empty tiers', () => {
    render(<GiftTastes tastes={TASTES} />);
    expect(headings()).toEqual(['Ama', 'Gosta']);
    expect(screen.getByText('Pérola')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Ver outras preferências/ }),
    ).not.toBeInTheDocument();
  });

  it('should show each gift as a card in a list', () => {
    render(<GiftTastes tastes={TASTES} />);
    const [loves] = screen.getAllByRole('list');
    expect(loves).toHaveAccessibleName('Ama');
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Pérola');
  });

  it('should show a category with its exceptions', () => {
    render(<GiftTastes tastes={TASTES} />);
    expect(screen.getByText('Flores')).toBeInTheDocument();
    expect(screen.getByText('exceto Papoula')).toBeInTheDocument();
  });

  it('should hide neutral and disliked gifts until asked', async () => {
    render(<GiftTastes tastes={WITH_OTHERS} />);
    expect(screen.queryByText('Pedra')).not.toBeInTheDocument();
    expect(screen.queryByText('Lixo')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Ver outras preferências (2)' }),
    );
    expect(headings()).toEqual([
      'Ama',
      'Gosta',
      'Neutro',
      'Não gosta ou odeia',
    ]);
    expect(screen.getByText('Pedra')).toBeInTheDocument();
    expect(screen.getByText('Lixo')).toBeInTheDocument();
  });

  it('should show only the requested tiers', () => {
    render(<GiftTastes tastes={WITH_OTHERS} tiers={['loves']} />);
    expect(screen.queryByText('Flores')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Ver outras preferências/ }),
    ).not.toBeInTheDocument();
    // A single tier is already named by its context, so it gets no heading.
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Pérola')).toBeInTheDocument();
  });
});
