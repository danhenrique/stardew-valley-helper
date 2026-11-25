import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  MachineBatchOut,
  PlantingOut,
} from '../generated/stardew-valley-api/types.gen';
import type { FixedEvent } from '../lib/events';
import { iconUrl } from '../lib/icons';
import { expectLoading } from './expectLoading';
import type { MachineCatalogStatus } from './MachineCatalogNotice';
import { NotificationsProvider } from './Notifications';
import { renderWithIntl } from './renderWithIntl';
import { renderWithRouter } from './renderWithRouter';
import { TodayList } from './TodayList';
import {
  BERRY_PLANTING,
  BERRY_SCHEDULE,
  FERTILIZERS,
  INVALID_MACHINE,
  INVALID_PLANTING,
  MACHINE_SCHEDULE,
  MACHINES,
  machineBatch,
  NAMES,
  PLANTABLES,
  SPRING_1,
} from './testData';

const mocks = vi.hoisted(() => ({
  useCreatePlanting: vi.fn(),
  useUpdatePlanting: vi.fn(),
  useDeletePlanting: vi.fn(),
  useMachines: vi.fn(),
  useCreateMachineBatch: vi.fn(),
  useUpdateMachineBatch: vi.fn(),
  useDeleteMachineBatch: vi.fn(),
  useMachineSchedulePreview: vi.fn(),
  useVillagerGifts: vi.fn(),
  usePlantables: vi.fn(),
  useFertilizers: vi.fn(),
  useSchedulePreview: vi.fn(),
}));
vi.mock('../hooks/useGameData', () => mocks);
vi.mock('../hooks/useGameNames', () => ({
  useGameNames: () => ({ nameOf: (id: string) => id }),
}));

const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const createMachine = vi.fn();
const updateMachine = vi.fn();
const removeMachine = vi.fn();

const FLOWER_READY = {
  ...BERRY_PLANTING,
  id: 'p-flower',
  seedId: 'test-flower-seeds',
  quantity: 2,
  schedule: { ...BERRY_SCHEDULE, status: 'ready', daysUntilNext: 0 },
} as unknown as PlantingOut;

const BERRY_READY = {
  ...BERRY_PLANTING,
  id: 'p-berry-ready',
  schedule: { ...BERRY_SCHEDULE, status: 'ready', daysUntilNext: 0 },
} as unknown as PlantingOut;

const BERRY_GROWING_2 = {
  ...BERRY_PLANTING,
  id: 'p-berry-soon',
  schedule: {
    ...BERRY_SCHEDULE,
    status: 'regrowing',
    daysUntilNext: 2,
  },
} as unknown as PlantingOut;

const MELON_GROWING_5 = {
  ...BERRY_PLANTING,
  id: 'p-melon-later',
  seedId: 'test-melon-seeds',
  schedule: { ...BERRY_SCHEDULE, status: 'growing', daysUntilNext: 5 },
} as unknown as PlantingOut;

const ALL_NAMES = { ...NAMES, 'test-flower-seeds': 'Flower Seeds' };

const KEG_READY = machineBatch({
  id: 'm-keg-ready',
  quantity: 2,
  label: 'Adega',
  startedOn: { year: 1, season: 'winter', day: 22 },
  schedule: {
    ...MACHINE_SCHEDULE,
    readyOn: SPRING_1,
    status: 'ready',
    daysUntilNext: 0,
  },
});

const HONEY_READY = machineBatch({
  id: 'm-honey-ready',
  machineId: 'bee-house',
  outputId: 'test-honey',
  schedule: {
    ...MACHINE_SCHEDULE,
    readyOn: null,
    collections: [SPRING_1],
    status: 'ready',
    daysUntilNext: 0,
  },
});

const CASK_IRIDIUM = machineBatch({
  id: 'm-cask-iridium',
  machineId: 'cask',
  outputId: 'test-aged',
  startQuality: 'normal',
  schedule: {
    ...MACHINE_SCHEDULE,
    readyOn: null,
    milestones: [{ quality: 'iridium', on: SPRING_1 }],
    status: 'iridium',
    daysUntilNext: null,
  },
});

const KEG_PROCESSING = machineBatch({ id: 'm-keg-processing' });

const renderList = (
  plantings: PlantingOut[],
  machines: MachineBatchOut[] = [],
) =>
  renderWithIntl(
    <NotificationsProvider>
      <TodayList
        plantings={plantings}
        plantables={PLANTABLES}
        names={ALL_NAMES}
        today={SPRING_1}
        machines={machines}
        machineCatalog={MACHINES}
        onAddPlanting={vi.fn()}
        onAddMachine={vi.fn()}
      />
    </NotificationsProvider>,
  );

const event = (
  kind: FixedEvent['kind'],
  id: string,
  ptBr: string,
  extra: Partial<FixedEvent> = {},
): FixedEvent => ({
  id: `${kind}:${id}`,
  kind,
  refId: id,
  season: 'spring',
  day: 1,
  name: { en: ptBr, ptBr },
  ...extra,
});

const TODAY_EVENTS: FixedEvent[] = [
  event('birthday', 'test-villager', 'Aldeão Teste'),
  event('foraging', 'test-foraging', 'Coleta Teste', { endDay: 4 }),
  event('festival', 'test-festival', 'Festival Teste'),
  event('festival', 'test-later', 'Festival Tardio', { day: 9 }),
  event('cropDeadline', 'test-deadline', 'Prazo Teste'),
];

const renderWithEvents = (
  events: FixedEvent[],
  options: {
    plantings?: PlantingOut[];
    machines?: MachineBatchOut[];
    eventsStatus?: MachineCatalogStatus;
  } = {},
) =>
  renderWithRouter(
    <NotificationsProvider>
      <TodayList
        plantings={options.plantings ?? []}
        plantables={PLANTABLES}
        names={ALL_NAMES}
        today={SPRING_1}
        machines={options.machines ?? []}
        machineCatalog={MACHINES}
        events={events}
        eventsStatus={options.eventsStatus}
        onAddPlanting={vi.fn()}
        onAddMachine={vi.fn()}
      />
    </NotificationsProvider>,
  );

const CASK_SILVER_TODAY = machineBatch({
  id: 'm-cask-silver',
  machineId: 'cask',
  outputId: 'test-aged',
  startQuality: 'normal',
  schedule: {
    ...MACHINE_SCHEDULE,
    readyOn: null,
    milestones: [
      { quality: 'silver', on: SPRING_1 },
      { quality: 'gold', on: { year: 1, season: 'spring', day: 15 } },
    ],
    status: 'aging',
    daysUntilNext: 14,
  },
});

const machineRow = (text: string) =>
  within(screen.getByRole('list', { name: 'Máquinas' }))
    .getByText(text)
    .closest('li') as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useCreatePlanting.mockReturnValue({ mutateAsync: create });
  mocks.useUpdatePlanting.mockReturnValue({ mutateAsync: update });
  mocks.useDeletePlanting.mockReturnValue({ mutateAsync: remove });
  create.mockResolvedValue(undefined);
  update.mockResolvedValue(undefined);
  remove.mockResolvedValue(undefined);
  mocks.useMachines.mockReturnValue({ data: MACHINES });
  mocks.usePlantables.mockReturnValue({ data: PLANTABLES });
  mocks.useFertilizers.mockReturnValue({ data: FERTILIZERS });
  mocks.useSchedulePreview.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });
  mocks.useVillagerGifts.mockReturnValue({
    status: 'pending',
    tastes: { loves: [], likes: [], neutral: [], dislikesOrHates: [] },
  });
  mocks.useCreateMachineBatch.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: createMachine,
    isPending: false,
  });
  mocks.useUpdateMachineBatch.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: updateMachine,
    isPending: false,
  });
  mocks.useDeleteMachineBatch.mockReturnValue({
    mutateAsync: removeMachine,
  });
  mocks.useMachineSchedulePreview.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });
  createMachine.mockResolvedValue(undefined);
  updateMachine.mockResolvedValue(undefined);
  removeMachine.mockResolvedValue(undefined);
});

describe('TodayList', () => {
  it('should list only ready plantings under the Plantios heading', () => {
    renderList([FLOWER_READY, MELON_GROWING_5]);
    const group = screen.getByRole('list', { name: 'Plantios' });
    expect(within(group).getByText('Flower Seeds')).toBeInTheDocument();
    expect(
      within(group).queryByText('Sementes de Melão'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Plantios' }),
    ).toBeInTheDocument();
    expect(within(group).getByText('Fazenda')).toBeInTheDocument();
    expect(within(group).getByText(/2 unidades/)).toBeInTheDocument();
  });

  it('should offer Replantar and Remover for a ready in-season non-regrowing planting', () => {
    renderList([FLOWER_READY]);
    expect(
      screen.getByRole('button', { name: 'Replantar' }),
    ).toBeInTheDocument();
    const trash = screen.getByRole('button', { name: 'Remover' });
    expect(trash).toHaveAttribute('title', 'Remover');
  });

  it('should offer only Editar and Remover for a ready regrowing planting', () => {
    renderList([BERRY_READY]);
    expect(screen.getByText('Sementes de Fruta')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Replantar' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toHaveAttribute(
      'title',
      'Editar',
    );
    expect(screen.getByRole('button', { name: 'Remover' })).toHaveAttribute(
      'title',
      'Remover',
    );
  });

  it('should offer Editar for a ready non-regrowing planting', () => {
    renderList([FLOWER_READY]);
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('should open the planting edit drawer on Editar', async () => {
    renderList([BERRY_READY]);
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(
      await screen.findByRole('dialog', { name: 'Editar plantio' }),
    ).toBeInTheDocument();
  });

  it('should delete a regrowing planting on Remover', async () => {
    renderList([BERRY_READY]);
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(remove).toHaveBeenCalled();
  });

  it('should show the empty state with the next harvest when nothing is ready', () => {
    renderList([MELON_GROWING_5, BERRY_GROWING_2]);
    expect(screen.getByText('Nada para coletar hoje')).toBeInTheDocument();
    expect(
      screen.getByText('Próximo: Sementes de Fruta em 2 dias'),
    ).toBeInTheDocument();
  });

  it('should replant with today as the planting date', async () => {
    renderList([FLOWER_READY]);
    await userEvent.click(screen.getByRole('button', { name: 'Replantar' }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        plantingId: 'p-flower',
        seedId: 'test-flower-seeds',
        anchor: 'planted',
        plantedOn: SPRING_1,
        quantity: 2,
      }),
    );
    expect(await screen.findByText('Plantio replantado')).toBeInTheDocument();
  });

  it('should replant from today on Replantar and restore the original fields on Desfazer', async () => {
    const spring10 = { year: 1, season: 'spring', day: 10 } as const;
    const harvested: PlantingOut = {
      ...FLOWER_READY,
      anchor: 'harvested',
      plantedOn: SPRING_1,
      lastHarvestOn: { year: 1, season: 'spring', day: 6 },
      fertilizer: 'speed-gro',
      label: 'Canteiro',
    };
    renderWithIntl(
      <NotificationsProvider>
        <TodayList
          plantings={[harvested]}
          plantables={PLANTABLES}
          names={ALL_NAMES}
          today={spring10}
          machines={[]}
          machineCatalog={MACHINES}
          onAddPlanting={vi.fn()}
          onAddMachine={vi.fn()}
        />
      </NotificationsProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Replantar' }));
    expect(update).toHaveBeenCalledWith({
      plantingId: 'p-flower',
      seedId: 'test-flower-seeds',
      anchor: 'planted',
      plantedOn: spring10,
      lastHarvestOn: null,
      fertilizer: 'speed-gro',
      location: 'farm',
      quantity: 2,
      label: 'Canteiro',
    });
    expect(await screen.findByText('Plantio replantado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith({
      plantingId: 'p-flower',
      seedId: 'test-flower-seeds',
      anchor: 'harvested',
      plantedOn: SPRING_1,
      lastHarvestOn: { year: 1, season: 'spring', day: 6 },
      fertilizer: 'speed-gro',
      location: 'farm',
      quantity: 2,
      label: 'Canteiro',
    });
  });

  it('should delete on Remover and recreate the planting on Desfazer', async () => {
    renderList([FLOWER_READY]);
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(remove).toHaveBeenCalledWith({ plantingId: 'p-flower' });
    expect(await screen.findByText('Plantio removido')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        seedId: 'test-flower-seeds',
        quantity: 2,
        location: 'farm',
        plantedOn: FLOWER_READY.plantedOn,
      }),
    );
    expect(create.mock.calls[0][0]).not.toHaveProperty('id');
  });

  it('should hide the row while removing and bring it back with an error when the delete fails', async () => {
    let reject: (error: unknown) => void = () => undefined;
    remove.mockReturnValue(
      new Promise((_resolve, rejectFn) => {
        reject = rejectFn;
      }),
    );
    renderList([FLOWER_READY]);
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(screen.queryByText('Flower Seeds')).not.toBeInTheDocument();
    reject({ error: { detail: 'Planting not found' } });
    expect(
      await screen.findByText('Plantio não encontrado.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Flower Seeds')).toBeInTheDocument();
  });

  it('should list ready and iridium machines under the Máquinas heading', () => {
    renderList([], [KEG_READY, HONEY_READY, CASK_IRIDIUM, KEG_PROCESSING]);
    expect(
      screen.getByRole('heading', { name: 'Máquinas' }),
    ).toBeInTheDocument();
    const group = screen.getByRole('list', { name: 'Máquinas' });
    expect(within(group).getAllByRole('listitem')).toHaveLength(3);
    expect(within(group).getByText('Adega')).toBeInTheDocument();
    expect(within(group).getByText('Colmeia → Mel Teste')).toBeInTheDocument();
    expect(
      within(group).getByText('Barril de Envelhecimento → Envelhecido Teste'),
    ).toBeInTheDocument();
    expect(machineRow('Adega')).toHaveTextContent('2 máquinas');
    expect(
      screen.queryByRole('list', { name: 'Plantios' }),
    ).not.toBeInTheDocument();
  });

  it('should offer Recolocar, Trocar produto, Editar and Esvaziar for a ready batch machine', () => {
    renderList([], [KEG_READY]);
    const row = machineRow('Adega');
    expect(
      within(row).getByRole('button', { name: 'Recolocar' }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: 'Trocar produto' }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: 'Editar' }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: 'Esvaziar' }),
    ).toHaveAttribute('title', 'Esvaziar');
  });

  it('should offer only Editar and Remover for a ready continuous machine', () => {
    renderList([], [HONEY_READY]);
    const row = machineRow('Colmeia → Mel Teste');
    expect(within(row).getAllByRole('button')).toHaveLength(2);
    expect(
      within(row).getByRole('button', { name: 'Editar' }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: 'Remover' }),
    ).toHaveAttribute('title', 'Remover');
  });

  it('should offer only Editar and Retirar for a cask at iridium quality', () => {
    renderList([], [CASK_IRIDIUM]);
    const row = machineRow('Barril de Envelhecimento → Envelhecido Teste');
    expect(within(row).getAllByRole('button')).toHaveLength(2);
    expect(
      within(row).getByRole('button', { name: 'Editar' }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: 'Retirar' }),
    ).toHaveAttribute('title', 'Retirar');
  });

  it('should open the edit drawer pre-filled on Trocar produto', async () => {
    renderList([], [KEG_READY]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Trocar produto' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar máquina',
    });
    expect(
      within(dialog).getByRole('button', { name: /^Máquina/ }),
    ).toHaveTextContent('Barril');
    expect(
      within(dialog).getByRole('button', { name: /^Produto/ }),
    ).toHaveTextContent('Vinho Teste');
  });

  it('should start the drawer from today on Trocar produto and save with today', async () => {
    const saveFromDrawer = vi.fn();
    mocks.useUpdateMachineBatch.mockReturnValue({
      mutate: saveFromDrawer,
      mutateAsync: updateMachine,
      isPending: false,
    });
    renderList([], [KEG_READY]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Trocar produto' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar máquina',
    });
    expect(
      within(dialog).getByText('Hoje (Primavera 1, Ano 1)'),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );
    expect(saveFromDrawer).toHaveBeenCalledWith(
      expect.objectContaining({
        machineBatchId: 'm-keg-ready',
        outputId: 'test-wine',
        startedOn: SPRING_1,
      }),
      expect.anything(),
    );
  });

  it('should keep the original start date on Editar for a machine', async () => {
    const saveFromDrawer = vi.fn();
    mocks.useUpdateMachineBatch.mockReturnValue({
      mutate: saveFromDrawer,
      mutateAsync: updateMachine,
      isPending: false,
    });
    renderList([], [KEG_READY]);
    await userEvent.click(
      within(machineRow('Adega')).getByRole('button', { name: 'Editar' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar máquina',
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    );
    expect(saveFromDrawer).toHaveBeenCalledWith(
      expect.objectContaining({
        machineBatchId: 'm-keg-ready',
        startedOn: { year: 1, season: 'winter', day: 22 },
      }),
      expect.anything(),
    );
  });

  it('should show the location only for bee houses', () => {
    renderList([], [KEG_READY, HONEY_READY]);
    expect(machineRow('Adega')).not.toHaveTextContent('Fazenda');
    expect(machineRow('Colmeia → Mel Teste')).toHaveTextContent('Fazenda');
  });

  it('should restart the batch today on Recolocar and restore it on Desfazer', async () => {
    renderList([], [KEG_READY]);
    await userEvent.click(screen.getByRole('button', { name: 'Recolocar' }));
    expect(updateMachine).toHaveBeenCalledWith({
      machineBatchId: 'm-keg-ready',
      machineId: 'keg',
      outputId: 'test-wine',
      startedOn: SPRING_1,
      quantity: 2,
      location: 'farm',
      label: 'Adega',
    });
    expect(await screen.findByText('Máquina recolocada')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(updateMachine).toHaveBeenLastCalledWith({
      machineBatchId: 'm-keg-ready',
      machineId: 'keg',
      outputId: 'test-wine',
      startedOn: KEG_READY.startedOn,
      quantity: 2,
      location: 'farm',
      label: 'Adega',
    });
  });

  it('should delete the batch on Esvaziar', async () => {
    renderList([], [KEG_READY]);
    await userEvent.click(screen.getByRole('button', { name: 'Esvaziar' }));
    expect(removeMachine).toHaveBeenCalledWith({
      machineBatchId: 'm-keg-ready',
    });
    expect(await screen.findByText('Máquina esvaziada')).toBeInTheDocument();
  });

  it('should consider machines for the next item in the empty state', () => {
    renderList([MELON_GROWING_5], [KEG_PROCESSING]);
    expect(screen.getByText('Nada para coletar hoje')).toBeInTheDocument();
    expect(
      screen.getByText('Próximo: Vinho Teste em 2 dias'),
    ).toBeInTheDocument();
  });

  it('should leave invalid plantings and machines out of the to-do list and the next item', () => {
    renderList(
      [FLOWER_READY, INVALID_PLANTING],
      [KEG_READY, KEG_PROCESSING, INVALID_MACHINE],
    );
    expect(screen.queryByText('Canteiro sumido')).not.toBeInTheDocument();
    expect(screen.queryByText('Barril sumido')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Plantios' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(1);
    expect(
      within(screen.getByRole('list', { name: 'Máquinas' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(1);
  });

  it('should show the next valid item when only invalid records are left', () => {
    renderList([MELON_GROWING_5, INVALID_PLANTING], [INVALID_MACHINE]);
    expect(screen.getByText('Nada para coletar hoje')).toBeInTheDocument();
    expect(
      screen.getByText('Próximo: Sementes de Melão em 5 dias'),
    ).toBeInTheDocument();
  });

  it('should be titled Hoje', () => {
    renderList([]);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Hoje' }),
    ).toBeInTheDocument();
  });

  it('should list the events of today first, as festival, foraging, birthday', async () => {
    renderWithEvents(TODAY_EVENTS, { plantings: [FLOWER_READY] });
    const group = await screen.findByRole('list', { name: 'Eventos' });
    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(['Eventos', 'Plantios']);
    expect(
      within(group)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Festival Teste'),
      expect.stringContaining('Coleta Teste'),
      expect.stringContaining('Aldeão Teste'),
    ]);
    expect(
      within(group).queryByText(/Festival Tardio/),
    ).not.toBeInTheDocument();
    expect(within(group).queryByText(/Prazo Teste/)).not.toBeInTheDocument();
  });

  it('should show each event with its kind and until when a multi-day event lasts', async () => {
    renderWithEvents(TODAY_EVENTS);
    const group = await screen.findByRole('list', { name: 'Eventos' });
    const [festival, foraging, birthday] =
      within(group).getAllByRole('listitem');
    expect(within(festival).getByText('Festival')).toBeInTheDocument();
    expect(foraging).toHaveTextContent('Até o dia 4');
    expect(within(foraging).getByText('Coleta')).toBeInTheDocument();
    expect(within(birthday).getByText('Aniversário')).toBeInTheDocument();
    expect(festival).not.toHaveTextContent('até o dia');
  });

  it('should link each event of today to its detail page', async () => {
    renderWithEvents(TODAY_EVENTS);
    const link = await screen.findByRole('link', { name: /Festival Teste/ });
    expect(link).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/events\/festival(:|%3A)test-festival$/),
    );
  });

  it('should keep the empty to-do message below the events of today', async () => {
    renderWithEvents(TODAY_EVENTS, { plantings: [MELON_GROWING_5] });
    await screen.findByRole('list', { name: 'Eventos' });
    expect(screen.getByText('Nada para coletar hoje')).toBeInTheDocument();
    expect(
      screen.getByText('Próximo: Sementes de Melão em 5 dias'),
    ).toBeInTheDocument();
  });

  it('should not show the Eventos group when nothing happens today', async () => {
    renderWithEvents([
      event('festival', 'later', 'Festival Tardio', { day: 9 }),
    ]);
    await screen.findByText('Nada para coletar hoje');
    expect(
      screen.queryByRole('heading', { name: 'Eventos' }),
    ).not.toBeInTheDocument();
  });

  it('should show a loading notice in the Eventos group while events load', async () => {
    renderWithEvents([], {
      plantings: [FLOWER_READY],
      eventsStatus: 'pending',
    });
    expectLoading(await screen.findByText('Carregando eventos...'));
    expect(
      screen.getByRole('heading', { name: 'Eventos' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Plantios' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(1);
  });

  it('should show an error notice in the Eventos group when events fail', async () => {
    renderWithEvents([], { eventsStatus: 'error' });
    expect(
      await screen.findByText('Não foi possível carregar os eventos.'),
    ).toBeInTheDocument();
  });

  it('should show a cask reaching a milestone today as an informational machine row', () => {
    renderList([], [CASK_SILVER_TODAY]);
    const row = machineRow('Barril de Envelhecimento → Envelhecido Teste');
    expect(row).toHaveTextContent('Qualidade prata alcançada');
    expect(within(row).getAllByRole('button')).toHaveLength(2);
    expect(
      within(row).getByRole('button', { name: 'Editar' }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: 'Retirar' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Nada para coletar hoje'),
    ).not.toBeInTheDocument();
  });

  it('should not show a cask whose next milestone is not today', () => {
    renderList(
      [],
      [
        machineBatch({
          ...CASK_SILVER_TODAY,
          schedule: {
            ...CASK_SILVER_TODAY.schedule!,
            milestones: [
              { quality: 'gold', on: { year: 1, season: 'spring', day: 15 } },
            ],
          },
        }),
      ],
    );
    expect(screen.getByText('Nada para coletar hoje')).toBeInTheDocument();
  });
});

describe('TodayList heading actions and birthdays', () => {
  const FRIDAY = { year: 1, season: 'spring', day: 5 } as const;
  const renderToday = (
    props: {
      events?: FixedEvent[];
      onAddPlanting?: () => void;
      onAddMachine?: () => void;
    } = {},
  ) =>
    renderWithRouter(
      <NotificationsProvider>
        <TodayList
          plantings={[FLOWER_READY]}
          plantables={PLANTABLES}
          names={ALL_NAMES}
          today={FRIDAY}
          machines={[]}
          machineCatalog={MACHINES}
          onAddPlanting={vi.fn()}
          onAddMachine={vi.fn()}
          {...props}
        />
      </NotificationsProvider>,
    );
  const srcOf = (row: Element | null) =>
    row?.querySelector('img')?.getAttribute('src');

  it('should put the add buttons in the Hoje heading when rendered', async () => {
    const onAddPlanting = vi.fn();
    const onAddMachine = vi.fn();
    renderToday({ onAddPlanting, onAddMachine });
    const card = (
      await screen.findByRole('heading', { level: 2, name: 'Hoje' })
    ).closest('section') as HTMLElement;
    await userEvent.click(
      within(card).getByRole('button', { name: 'Adicionar plantio' }),
    );
    await userEvent.click(
      within(card).getByRole('button', { name: 'Adicionar máquina' }),
    );
    expect(onAddPlanting).toHaveBeenCalled();
    expect(onAddMachine).toHaveBeenCalled();
  });

  it('should not show reminders or closed shops when rendered', async () => {
    renderToday();
    await screen.findByRole('heading', { name: 'Plantios' });
    expect(
      screen.queryByRole('heading', { name: 'Lembretes' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Fechadas hoje/)).not.toBeInTheDocument();
  });

  it('should open the gifts modal when a birthday of today is clicked', async () => {
    renderToday({
      events: [event('birthday', 'test-villager', 'Aldeão Teste', { day: 5 })],
    });
    await userEvent.click(
      await screen.findByRole('button', { name: /Aldeão Teste/ }),
    );
    expect(
      await screen.findByRole('dialog', {
        name: 'Aniversário de Aldeão Teste',
      }),
    ).toBeInTheDocument();
  });

  describe('game icons', () => {
    it('should show the villager portrait when today has a birthday', async () => {
      renderToday({
        events: [event('birthday', 'abigail', 'Abigail', { day: 5 })],
      });
      const row = await screen.findByRole('button', { name: /Abigail/ });
      expect(srcOf(row)).toBe(iconUrl('abigail'));
    });

    it('should show the seed sprite when a ready planting has one', async () => {
      renderList([{ ...FLOWER_READY, seedId: 'parsnip-seeds' } as PlantingOut]);
      const group = screen.getByRole('list', { name: 'Plantios' });
      expect(srcOf(within(group).getAllByRole('listitem')[0])).toBe(
        iconUrl('parsnip-seeds'),
      );
    });

    it('should show the machine sprite when a machine is ready', () => {
      renderList([], [KEG_READY]);
      expect(srcOf(machineRow('Adega'))).toBe(iconUrl('keg'));
    });
  });
});

describe('TodayList in English', () => {
  const renderEnglish = (
    plantings: PlantingOut[],
    machines: MachineBatchOut[] = [],
    events: FixedEvent[] = [],
  ) =>
    renderWithRouter(
      <NotificationsProvider>
        <TodayList
          plantings={plantings}
          plantables={PLANTABLES}
          names={ALL_NAMES}
          today={SPRING_1}
          machines={machines}
          machineCatalog={MACHINES}
          events={events}
          onAddPlanting={vi.fn()}
          onAddMachine={vi.fn()}
        />
      </NotificationsProvider>,
      { locale: 'en' },
    );

  it('should show the heading, the groups and the row actions in English', async () => {
    renderEnglish([FLOWER_READY], [KEG_READY, CASK_IRIDIUM]);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Today' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add planting' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add machine' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Plantings' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Machines' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replant' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refill' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Change product' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take out' })).toHaveAttribute(
      'title',
      'Take out',
    );
    expect(screen.getAllByRole('button', { name: 'Edit' }).length).toBe(3);
    expect(screen.getByText(/2 units · Ready to harvest/)).toBeInTheDocument();
    expect(
      screen.getByText(/2 machines · Ready to collect/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /1 machine · Iridium quality reached|1 machine · iridium quality reached/,
      ),
    ).toBeInTheDocument();
  });

  it('should show the empty state with the next harvest in English', async () => {
    renderEnglish([BERRY_GROWING_2]);
    expect(
      await screen.findByText('Nothing to collect today'),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Next: .+ in 2 days$/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add your first seed' }),
    ).not.toBeInTheDocument();
  });

  it('should show the events of today in English', async () => {
    renderEnglish([], [], TODAY_EVENTS);
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Events' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Until day 4')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add your first seed' }),
    ).toBeInTheDocument();
  });
});
