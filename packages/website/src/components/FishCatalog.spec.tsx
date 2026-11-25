import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FishCatalog } from './FishCatalog';
import { renderWithIntl } from './renderWithIntl';
import { FISH } from './testData';

const PREFS = { season: 'spring', weather: 'all', kind: 'all' } as const;

describe('FishCatalog', () => {
  beforeEach(() => localStorage.clear());

  it('should show the unverified locations notice and the grouped fish when rendered', () => {
    renderWithIntl(<FishCatalog fish={FISH} initialPrefs={PREFS} />);
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
    renderWithIntl(<FishCatalog fish={FISH} initialPrefs={PREFS} />);
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
    renderWithIntl(<FishCatalog fish={FISH} initialPrefs={PREFS} />);
    await userEvent.type(screen.getByLabelText('Buscar peixe'), 'zzz');
    expect(
      screen.getByText('Nenhum peixe com esses filtros.'),
    ).toBeInTheDocument();
  });

  it('should open the drawer with the full location when a card is clicked', async () => {
    renderWithIntl(<FishCatalog fish={FISH} initialPrefs={PREFS} />);
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

describe('FishCatalog in English', () => {
  beforeEach(() => localStorage.clear());

  it('should show English filters, notice, sections and empty text', async () => {
    renderWithIntl(<FishCatalog fish={FISH} initialPrefs={PREFS} />, {
      locale: 'en',
    });
    expect(
      screen.getByText('Locations not yet verified in the game.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sun' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Crab Pot' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Rod (2)' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Search fish'), 'zzz');
    expect(
      screen.getByText('No fish match these filters.'),
    ).toBeInTheDocument();
  });

  it('should show the English drawer labels and the localized location', async () => {
    renderWithIntl(<FishCatalog fish={FISH} initialPrefs={PREFS} />, {
      locale: 'en',
    });
    await userEvent.click(screen.getByRole('button', { name: /Lenda Teste/ }));
    const drawer = await screen.findByRole('dialog');
    expect(
      within(drawer).getByText('Mountain lake, near the log.'),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByText('Legendary Fish · Rod'),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('Rain only')).toBeInTheDocument();
    expect(within(drawer).getByText('Hours')).toBeInTheDocument();
    expect(
      within(drawer).getAllByRole('button', { name: 'Close' }),
    ).not.toHaveLength(0);
  });
});
