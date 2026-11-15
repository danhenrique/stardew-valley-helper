import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { summarizeSchedule } from '../lib/plantings';
import { PlantingDrawer } from './PlantingDrawer';
import {
  BERRY_PLANTING,
  BERRY_SCHEDULE,
  FERTILIZERS,
  PLANTABLES,
  SPRING_1,
} from './testData';

const mocks = vi.hoisted(() => ({
  usePlantables: vi.fn(),
  useFertilizers: vi.fn(),
  useCreatePlanting: vi.fn(),
  useUpdatePlanting: vi.fn(),
  useSchedulePreview: vi.fn(),
}));
vi.mock('../hooks/useGameData', () => mocks);

const SCHEDULE = BERRY_SCHEDULE;
const PROFILE = {
  currentDate: SPRING_1,
  agriculturist: false,
} as Parameters<typeof PlantingDrawer>[0]['profile'];

const create = vi.fn();
const update = vi.fn();
const previewMutate = vi.fn();
const notifyError = vi.fn();
vi.mock('./Notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./Notifications')>()),
  useNotifications: () => ({ notifyError, notifyUndo: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.usePlantables.mockReturnValue({ data: PLANTABLES });
  mocks.useFertilizers.mockReturnValue({ data: FERTILIZERS });
  mocks.useCreatePlanting.mockReturnValue({ mutate: create, isPending: false });
  mocks.useUpdatePlanting.mockReturnValue({ mutate: update, isPending: false });
  mocks.useSchedulePreview.mockReturnValue({
    mutate: previewMutate,
    isPending: false,
  });
  previewMutate.mockImplementation((_body, options) =>
    options.onSuccess(SCHEDULE),
  );
  create.mockImplementation((_body, options) => options.onSuccess());
  update.mockImplementation((_body, options) => options.onSuccess());
});

const renderDrawer = (
  editing: Parameters<typeof PlantingDrawer>[0]['editing'] = null,
) => {
  const onClose = vi.fn();
  render(
    <PlantingDrawer
      open
      editing={editing}
      profile={PROFILE}
      onClose={onClose}
    />,
  );
  return onClose;
};

const pickBerry = async () => {
  await userEvent.click(
    screen.getByRole('button', { name: /Mostrar sementes/ }),
  );
  await userEvent.click(
    screen.getByRole('option', { name: /Sementes de Fruta/ }),
  );
};

describe('PlantingDrawer', () => {
  it('should disable Salvar while no seed is chosen', () => {
    renderDrawer();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(
      screen.getByText('Escolha uma semente para ver a previsão'),
    ).toBeInTheDocument();
  });

  it('should show the schedule summary in the footer once the preview resolves', async () => {
    renderDrawer();
    await pickBerry();
    expect(
      await screen.findByText(summarizeSchedule(SCHEDULE, SPRING_1)),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('should highlight the first harvest next to the date when the preview resolves', async () => {
    renderDrawer();
    await pickBerry();
    const hint = await screen.findByRole('status', {
      name: 'Primeira colheita',
    });
    expect(hint).toHaveTextContent(
      'Primeira colheita: Primavera 9, Ano 1 (daqui a 8 dias)',
    );
  });

  it('should warn next to the date when the crop never matures', async () => {
    previewMutate.mockImplementation((_body, options) =>
      options.onSuccess({ ...SCHEDULE, firstHarvest: null }),
    );
    renderDrawer();
    await pickBerry();
    expect(
      await screen.findByRole('status', { name: 'Primeira colheita' }),
    ).toHaveTextContent('Não amadurece antes do fim da estação');
  });

  it('should create the planting and close when saved', async () => {
    const onClose = renderDrawer();
    expect(screen.getByText('Adicionar plantio')).toBeInTheDocument();
    await pickBerry();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ seedId: 'test-berry-seeds', quantity: 1 }),
      expect.anything(),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should update the planting by id when editing', async () => {
    const onClose = renderDrawer(BERRY_PLANTING);
    expect(screen.getByText('Editar plantio')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        plantingId: BERRY_PLANTING.id,
        seedId: 'test-berry-seeds',
      }),
      expect.anything(),
    );
    expect(create).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should start empty when reopened after a draft was filled', async () => {
    const onClose = vi.fn();
    const view = render(
      <PlantingDrawer
        open
        editing={null}
        profile={PROFILE}
        onClose={onClose}
      />,
    );
    await pickBerry();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    view.rerender(
      <PlantingDrawer
        open={false}
        editing={null}
        profile={PROFILE}
        onClose={onClose}
      />,
    );
    view.rerender(
      <PlantingDrawer
        open
        editing={null}
        profile={PROFILE}
        onClose={onClose}
      />,
    );
    expect(
      await screen.findByText('Escolha uma semente para ver a previsão'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });
});
