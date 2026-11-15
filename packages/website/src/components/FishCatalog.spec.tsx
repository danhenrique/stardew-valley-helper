import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FishCatalog } from './FishCatalog';
import { FISH } from './testData';

const PREFS = { season: 'spring', weather: 'all', kind: 'all' } as const;

describe('FishCatalog', () => {
  beforeEach(() => localStorage.clear());

  it('should show the unverified locations notice and the grouped fish when rendered', () => {
    render(<FishCatalog fish={FISH} initialPrefs={PREFS} />);
    expect(
      screen.getByText('Locais ainda não verificados com o jogo.'),
    ).toBeInTheDocument();
    const vara = screen.getByRole('region', { name: 'Vara (2)' });
    expect(within(vara).getByText('Peixe Teste')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Covo (1)' }),
    ).toBeInTheDocument();
  });

  it('should filter by weather and kind and persist the choice when filters change', async () => {
    render(<FishCatalog fish={FISH} initialPrefs={PREFS} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sol' }));
    expect(screen.queryByText('Lenda Teste')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Covo' }));
    expect(screen.queryByText('Peixe Teste')).not.toBeInTheDocument();
    expect(screen.getByText('Caranguejo Teste')).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem('stardew.fishPrefs') ?? '{}'),
    ).toEqual({ kind: 'crab-pot' });
  });

  it('should show the empty message when no fish match', async () => {
    render(<FishCatalog fish={FISH} initialPrefs={PREFS} />);
    await userEvent.type(screen.getByLabelText('Buscar peixe'), 'zzz');
    expect(
      screen.getByText('Nenhum peixe com esses filtros.'),
    ).toBeInTheDocument();
  });

  it('should open the drawer with the full location when a card is clicked', async () => {
    render(<FishCatalog fish={FISH} initialPrefs={PREFS} />);
    await userEvent.click(screen.getByRole('button', { name: /Lenda Teste/ }));
    const drawer = await screen.findByRole('dialog');
    expect(
      within(drawer).getByText(
        'Lago da montanha, perto do tronco. Nível de pesca 10 necessário.',
      ),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('Lendário · Vara')).toBeInTheDocument();
  });
});
