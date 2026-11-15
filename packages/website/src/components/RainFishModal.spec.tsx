import { screen, within } from '@testing-library/react';
import { RainFishModal } from './RainFishModal';
import { renderWithRouter } from './renderWithRouter';
import { FISH } from './testData';

const mocks = vi.hoisted(() => ({ useFish: vi.fn() }));
vi.mock('../hooks/useGameData', () => mocks);

const renderModal = async () => {
  renderWithRouter(<RainFishModal open onClose={vi.fn()} season="spring" />);
  return screen.findByRole('dialog');
};

describe('RainFishModal', () => {
  it('should list rain-only fish first for the season when fish load', async () => {
    mocks.useFish.mockReturnValue({
      data: FISH,
      isPending: false,
      isError: false,
    });
    const dialog = await renderModal();
    const sections = within(dialog).getAllByRole('region');
    expect(sections.map((s) => s.getAttribute('aria-label'))).toEqual([
      'Só na chuva (2)',
      'Vara (1)',
      'Covo (1)',
    ]);
    expect(within(sections[0]).getByText('Lenda Teste')).toBeInTheDocument();
    expect(within(dialog).queryByText('Duas Janelas')).not.toBeInTheDocument();
  });

  it('should link to the fish page when rendered', async () => {
    mocks.useFish.mockReturnValue({
      data: FISH,
      isPending: false,
      isError: false,
    });
    const dialog = await renderModal();
    expect(
      within(dialog).getByRole('link', { name: 'Ver todos os peixes' }),
    ).toHaveAttribute('href', '/peixes');
  });

  it('should show the error message when fish fail to load', async () => {
    mocks.useFish.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    const dialog = await renderModal();
    expect(
      within(dialog).getByText('Não foi possível carregar os peixes.'),
    ).toBeInTheDocument();
  });
});
