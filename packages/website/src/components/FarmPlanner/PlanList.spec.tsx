import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FarmPlanSummaryOut } from '../../generated/stardew-valley-api/types.gen';
import type { Locale } from '../../lib/locale';
import { NotificationsProvider } from '../Notifications';
import { renderWithRouter } from '../renderWithRouter';
import { PlanList } from './PlanList';

const mocks = vi.hoisted(() => ({
  useFarmPlans: vi.fn(),
  useFarms: vi.fn(),
  useCreateFarmPlan: vi.fn(),
  useDeleteFarmPlan: vi.fn(),
  useRenameFarmPlan: vi.fn(),
  farmBackgroundUrl: (id: string) => `/farms/${id}.webp`,
}));
vi.mock('../../hooks/useFarmPlans', () => mocks);

const plan = (n: number, overrides: Partial<FarmPlanSummaryOut> = {}) => ({
  id: `plan-${n}`,
  name: `Plano ${n}`,
  farmId: 'standard',
  version: 1,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-02T10:00:00Z',
  ...overrides,
});

const FARMS = [
  {
    type: 'farms',
    id: 'standard',
    name: { en: 'Standard', ptBr: 'Fazenda Padrão' },
  },
  {
    type: 'farms',
    id: 'forest',
    name: { en: 'Forest', ptBr: 'Fazenda da Floresta' },
  },
];

const create = vi.fn();
const del = vi.fn();
const rename = vi.fn();

const setup = (
  plans: FarmPlanSummaryOut[],
  initialPath?: string,
  locale?: Locale,
) => {
  mocks.useFarmPlans.mockReturnValue({
    data: plans,
    isPending: false,
    isError: false,
  });
  mocks.useFarms.mockReturnValue({
    data: FARMS,
    isPending: false,
    isError: false,
  });
  mocks.useCreateFarmPlan.mockReturnValue({
    mutateAsync: create,
    isPending: false,
  });
  mocks.useDeleteFarmPlan.mockReturnValue({
    mutateAsync: del,
    isPending: false,
  });
  mocks.useRenameFarmPlan.mockReturnValue({
    mutateAsync: rename,
    isPending: false,
  });
  const list = (
    <NotificationsProvider>
      <PlanList />
    </NotificationsProvider>
  );
  const editor = {
    path: '/{-$locale}/farm/$id',
    component: () => <p>editor</p>,
  };
  if (initialPath)
    return renderWithRouter(null, {
      initialPath,
      locale,
      pages: [{ path: '/{-$locale}/farm', component: () => list }, editor],
    });
  return renderWithRouter(list, { pages: [editor], locale });
};

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue(plan(9, { id: 'new-id' }));
  del.mockResolvedValue(undefined);
  rename.mockResolvedValue(undefined);
});

describe('PlanList', () => {
  it('should format the plan date and farm name in the English locale', async () => {
    setup([plan(1, { updatedAt: '2026-11-23T10:00:00Z' })], undefined, 'en');
    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]).getByText(/11\/23\/2026/)).toBeInTheDocument();
    expect(within(items[0]).getByText('Standard')).toBeInTheDocument();
  });

  it('should translate the list, the card actions and the delete dialog in English', async () => {
    setup([plan(1)], undefined, 'en');
    expect(
      await screen.findByRole('button', { name: 'New plan' }),
    ).toBeInTheDocument();
    const item = (await screen.findAllByRole('listitem'))[0];
    expect(within(item).getByText(/Updated on/)).toBeInTheDocument();
    expect(
      within(item).getByRole('button', { name: 'Rename Plano 1' }),
    ).toBeInTheDocument();
    expect(
      within(item).getByRole('button', { name: 'Duplicate Plano 1' }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(item).getByRole('button', { name: 'Delete Plano 1' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Delete "Plano 1"? This cannot be undone.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeInTheDocument();
  });

  it('should name a duplicated plan with the English copy suffix', async () => {
    setup([plan(1)], undefined, 'en');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Duplicate Plano 1' }),
    );
    expect(create).toHaveBeenCalledWith({
      name: 'Plano 1 (copy)',
      copyFrom: 'plan-1',
    });
  });

  it('should render each plan as a card with thumbnail, name, farm and date', async () => {
    setup([plan(1), plan(2, { farmId: 'forest' })]);
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Plano 1')).toBeInTheDocument();
    expect(within(items[0]).getByText('Fazenda Padrão')).toBeInTheDocument();
    expect(within(items[0]).getByText(/02\/03\/2026/)).toBeInTheDocument();
    expect(items[0].querySelector('img')).toHaveAttribute(
      'src',
      '/farms/standard.webp',
    );
    expect(
      within(items[1]).getByText('Fazenda da Floresta'),
    ).toBeInTheDocument();
  });

  it('should create a plan from the dialog and open it', async () => {
    setup([plan(1)]);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Novo plano' }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Ano 1');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Criar' }),
    );
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        name: 'Ano 1',
        farmId: 'standard',
      }),
    );
    expect(await screen.findByText('editor')).toBeInTheDocument();
  });

  it('should disable Novo plano at 20 plans and show the limit hint', async () => {
    setup(Array.from({ length: 20 }, (_, i) => plan(i + 1)));
    expect(
      await screen.findByRole('button', { name: 'Novo plano' }),
    ).toBeDisabled();
    expect(screen.getByText('Limite de 20 planos')).toBeInTheDocument();
  });

  it('should list the plans under /en/farm and open a plan keeping the prefix', async () => {
    const router = setup([plan(1)], '/en/farm');
    await userEvent.click(await screen.findByRole('link', { name: /Plano 1/ }));
    expect(await screen.findByText('editor')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/en/farm/plan-1');
  });

  it('should duplicate a plan with copyFrom', async () => {
    setup([plan(1)]);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Duplicar Plano 1' }),
    );
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        name: 'Plano 1 (cópia)',
        copyFrom: 'plan-1',
      }),
    );
  });

  it('should ask for confirmation before deleting', async () => {
    setup([plan(1)]);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Excluir Plano 1' }),
    );
    expect(del).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Excluir' }),
    );
    await waitFor(() => expect(del).toHaveBeenCalledWith({ planId: 'plan-1' }));
  });

  it('should keep the card and notify when the delete fails', async () => {
    del.mockRejectedValue({ error: { detail: 'x' } });
    setup([plan(1)]);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Excluir Plano 1' }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Excluir' }),
    );
    expect(
      await screen.findByText('Não foi possível salvar. Tente novamente.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Plano 1')).toBeInTheDocument();
  });

  it('should rename inline with Enter', async () => {
    setup([plan(1)]);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Renomear Plano 1' }),
    );
    const input = screen.getByRole('textbox', { name: 'Nome do plano' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Novo nome{Enter}');
    await waitFor(() =>
      expect(rename).toHaveBeenCalledWith({
        planId: 'plan-1',
        name: 'Novo nome',
      }),
    );
  });

  it('should show an error notification when the rename conflicts', async () => {
    rename.mockRejectedValue({ error: { detail: 'x' } });
    setup([plan(1)]);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Renomear Plano 1' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Nome do plano' }),
      'a{Enter}',
    );
    expect(
      await screen.findByText('Não foi possível salvar. Tente novamente.'),
    ).toBeInTheDocument();
  });

  it('should show an empty state without plans', async () => {
    setup([]);
    expect(await screen.findByText('Nenhum plano ainda')).toBeInTheDocument();
  });
});
