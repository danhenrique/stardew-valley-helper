import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildEvents } from '../lib/events';
import { emptyTastes } from '../lib/gifts';
import { BirthdayGiftsModal } from './BirthdayGiftsModal';
import { expectLoading } from './expectLoading';
import { renderWithRouter } from './renderWithRouter';
import { TEST_VILLAGER } from './testData';

const mocks = vi.hoisted(() => ({ useVillagerGifts: vi.fn() }));
vi.mock('../hooks/useGameData', () => mocks);
vi.mock('../hooks/useGameNames', () => ({
  useGameNames: () => ({ nameOf: (id: string) => id }),
}));

const [birthday] = buildEvents({
  festivals: [],
  villagers: [TEST_VILLAGER],
  foraging: [],
  plantables: [],
});
const ALL_TIERS = {
  loves: [{ kind: 'item' as const, id: 'loved-item', except: [] }],
  likes: [{ kind: 'item' as const, id: 'liked-item', except: [] }],
  neutral: [{ kind: 'item' as const, id: 'neutral-item', except: [] }],
  dislikesOrHates: [{ kind: 'item' as const, id: 'hated-item', except: [] }],
};

const renderModal = async (open = true) => {
  renderWithRouter(
    <BirthdayGiftsModal event={birthday} open={open} onClose={() => {}} />,
  );
  if (open) await screen.findByRole('dialog');
};

beforeEach(() => vi.clearAllMocks());

describe('BirthdayGiftsModal', () => {
  it('should title the dialog with the villager and the date', async () => {
    mocks.useVillagerGifts.mockReturnValue({
      status: 'success',
      tastes: ALL_TIERS,
    });
    await renderModal();
    expect(
      screen.getByRole('dialog', { name: 'Aniversário de Aldeão Teste' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Primavera 5')).toBeInTheDocument();
  });

  it('should show loves and likes first and the other tiers on demand', async () => {
    mocks.useVillagerGifts.mockReturnValue({
      status: 'success',
      tastes: ALL_TIERS,
    });
    await renderModal();
    const tiers = () =>
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(tiers()).toEqual(['Ama', 'Gosta']);
    expect(screen.queryByText('hated-item')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Ver outras preferências (2)' }),
    );
    expect(tiers()).toEqual(['Ama', 'Gosta', 'Neutro', 'Não gosta ou odeia']);
    expect(screen.getByText('hated-item')).toBeInTheDocument();
  });

  it('should show the loading, error and empty states', async () => {
    mocks.useVillagerGifts.mockReturnValue({
      status: 'pending',
      tastes: emptyTastes(),
    });
    await renderModal();
    expectLoading(screen.getByText('Carregando presentes...'));
  });

  it('should show an error when the gifts fail to load', async () => {
    mocks.useVillagerGifts.mockReturnValue({
      status: 'error',
      tastes: emptyTastes(),
    });
    await renderModal();
    expect(
      screen.getByText('Não foi possível carregar os presentes.'),
    ).toBeInTheDocument();
  });

  it('should say when the villager has no gift tastes', async () => {
    mocks.useVillagerGifts.mockReturnValue({
      status: 'success',
      tastes: emptyTastes(),
    });
    await renderModal();
    expect(screen.getByText('Nenhum presente cadastrado.')).toBeInTheDocument();
  });

  it('should link to the event page', async () => {
    mocks.useVillagerGifts.mockReturnValue({
      status: 'success',
      tastes: ALL_TIERS,
    });
    await renderModal();
    expect(screen.getByRole('link', { name: 'Ver evento' })).toHaveAttribute(
      'href',
      expect.stringContaining('test-villager'),
    );
  });

  it('should not fetch the gifts while closed', async () => {
    mocks.useVillagerGifts.mockReturnValue({
      status: 'pending',
      tastes: emptyTastes(),
    });
    await renderModal(false);
    await waitFor(() =>
      expect(mocks.useVillagerGifts).toHaveBeenLastCalledWith(
        'test-villager',
        false,
      ),
    );
  });
});
