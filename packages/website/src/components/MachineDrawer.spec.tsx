import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { summarizeMachineSchedule } from '../lib/machines';
import { MachineDrawer } from './MachineDrawer';
import { MACHINE_SCHEDULE, MACHINES, machineBatch, SPRING_1 } from './testData';

const mocks = vi.hoisted(() => ({
  useMachines: vi.fn(),
  useCreateMachineBatch: vi.fn(),
  useUpdateMachineBatch: vi.fn(),
  useMachineSchedulePreview: vi.fn(),
}));
vi.mock('../hooks/useGameData', () => mocks);

const BATCH = machineBatch();
const PROFILE = {
  currentDate: SPRING_1,
  agriculturist: false,
} as Parameters<typeof MachineDrawer>[0]['profile'];

const create = vi.fn();
const update = vi.fn();
const previewMutate = vi.fn();
vi.mock('./Notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./Notifications')>()),
  useNotifications: () => ({ notifyError: vi.fn(), notifyUndo: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useMachines.mockReturnValue({ data: MACHINES });
  mocks.useCreateMachineBatch.mockReturnValue({
    mutate: create,
    isPending: false,
  });
  mocks.useUpdateMachineBatch.mockReturnValue({
    mutate: update,
    isPending: false,
  });
  mocks.useMachineSchedulePreview.mockReturnValue({
    mutate: previewMutate,
    isPending: false,
  });
  previewMutate.mockImplementation((_body, options) =>
    options.onSuccess(MACHINE_SCHEDULE),
  );
  create.mockImplementation((_body, options) => options.onSuccess());
  update.mockImplementation((_body, options) => options.onSuccess());
});

const renderDrawer = (
  editing: Parameters<typeof MachineDrawer>[0]['editing'] = null,
) => {
  const onClose = vi.fn();
  render(
    <MachineDrawer
      open
      editing={editing}
      profile={PROFILE}
      onClose={onClose}
    />,
  );
  return onClose;
};

const pickKegWine = async () => {
  await userEvent.click(screen.getByRole('button', { name: /^Máquina/ }));
  await userEvent.click(screen.getByRole('option', { name: /^Barril$/ }));
  await userEvent.click(screen.getByRole('button', { name: /^Produto/ }));
  await userEvent.click(screen.getByRole('option', { name: /^Vinho Teste/ }));
};

describe('MachineDrawer', () => {
  it('should disable Salvar while no machine is chosen', () => {
    renderDrawer();
    expect(
      screen.getByRole('dialog', { name: 'Adicionar máquina' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(
      screen.getByText('Escolha uma máquina para ver a previsão'),
    ).toBeInTheDocument();
  });

  it('should ask for a product in the footer once a machine is chosen', async () => {
    renderDrawer();
    await userEvent.click(screen.getByRole('button', { name: /^Máquina/ }));
    await userEvent.click(screen.getByRole('option', { name: /^Barril$/ }));
    expect(
      screen.getByText('Escolha um produto para ver a previsão'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Escolha uma máquina para ver a previsão'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('should show the schedule summary in the footer once the preview resolves', async () => {
    renderDrawer();
    await pickKegWine();
    expect(
      await screen.findByText(
        summarizeMachineSchedule('batch', 7, MACHINE_SCHEDULE),
      ),
    ).toBeInTheDocument();
    expect(previewMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        machineId: 'keg',
        outputId: 'test-wine',
        today: SPRING_1,
      }),
      expect.anything(),
    );
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('should list every date under Ver detalhes', async () => {
    renderDrawer();
    await pickKegWine();
    await screen.findByText(
      summarizeMachineSchedule('batch', 7, MACHINE_SCHEDULE),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    expect(
      screen.getByRole('list', { name: 'Datas previstas' }),
    ).toHaveTextContent('Pronto: Verão 3, Ano 1');
  });

  it('should warn that the time is approximate for an approximate product', async () => {
    previewMutate.mockImplementation((_body, options) =>
      options.onSuccess({ ...MACHINE_SCHEDULE, approximate: true }),
    );
    renderDrawer();
    await pickKegWine();
    await screen.findByText(
      summarizeMachineSchedule('batch', 7, MACHINE_SCHEDULE),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    expect(
      screen.getByText('Tempo aproximado para este produto.'),
    ).toBeInTheDocument();
  });

  it('should keep the stored start date when editing', () => {
    renderDrawer(BATCH);
    expect(screen.queryByText(/^Hoje \(/)).not.toBeInTheDocument();
  });

  it('should create the batch and close when saved', async () => {
    const onClose = renderDrawer();
    await pickKegWine();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        machineId: 'keg',
        outputId: 'test-wine',
        quantity: 1,
      }),
      expect.anything(),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should update the batch by id when editing', async () => {
    const onClose = renderDrawer(BATCH);
    expect(
      screen.getByRole('dialog', { name: 'Editar máquina' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        machineBatchId: BATCH.id,
        machineId: 'keg',
        outputId: 'test-wine',
      }),
      expect.anything(),
    );
    expect(create).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
