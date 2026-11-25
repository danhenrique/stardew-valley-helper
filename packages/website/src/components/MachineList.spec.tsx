import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MachineBatchOut } from '../generated/stardew-valley-api/types.gen';
import { iconUrl } from '../lib/icons';
import { MachineList } from './MachineList';
import { renderWithIntl } from './renderWithIntl';
import {
  INVALID_MACHINE,
  MACHINE_SCHEDULE,
  MACHINES,
  machineBatch,
} from './testData';

const SUMMER_1 = { year: 1, season: 'summer', day: 1 } as const;
const KEG = machineBatch({ quantity: 3 });
const HONEY = machineBatch({
  id: 'm-honey',
  machineId: 'bee-house',
  outputId: 'test-honey',
  schedule: {
    ...MACHINE_SCHEDULE,
    readyOn: null,
    collections: [{ year: 1, season: 'summer', day: 1 }],
    status: 'ready',
    daysUntilNext: 0,
  },
});
const CASK = machineBatch({
  id: 'm-cask',
  machineId: 'cask',
  outputId: 'test-aged',
  startQuality: 'normal',
  schedule: { ...MACHINE_SCHEDULE, status: 'aging', daysUntilNext: 14 },
});

const renderList = (batches: MachineBatchOut[] = [KEG, HONEY, CASK]) => {
  const handlers = {
    onEdit: vi.fn(),
    onRecollect: vi.fn(),
    onRemove: vi.fn(),
    onAdd: vi.fn(),
  };
  renderWithIntl(
    <MachineList
      batches={batches}
      machines={MACHINES}
      today={SUMMER_1}
      {...handlers}
    />,
  );
  return handlers;
};

const rows = () =>
  within(screen.getByRole('list', { name: 'Máquinas' })).getAllByRole(
    'listitem',
  );

const openMenu = async (row: HTMLElement) => {
  await userEvent.click(
    within(row).getByRole('button', { name: 'Mais ações' }),
  );
  return (await screen.findAllByRole('menuitem')).map(
    (item) => item.textContent,
  );
};

describe('MachineList', () => {
  it('should show the tabs with counts and filter the rows', async () => {
    renderList();
    expect(screen.getByRole('button', { name: /^Todas/ })).toHaveTextContent(
      '3',
    );
    expect(screen.getByRole('button', { name: /^Prontas/ })).toHaveTextContent(
      '1',
    );
    expect(
      screen.getByRole('button', { name: /^Em andamento/ }),
    ).toHaveTextContent('2');
    expect(rows()).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: /^Prontas/ }));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('Colmeia → Mel Teste');
    await userEvent.click(
      screen.getByRole('button', { name: /^Em andamento/ }),
    );
    expect(rows()).toHaveLength(2);
  });

  it('should show machine → product, quantity, status and next date', () => {
    renderList([KEG]);
    const [row] = rows();
    expect(row).toHaveTextContent('Barril → Vinho Teste');
    expect(row).toHaveTextContent('3 máquinas');
    expect(within(row).getByText('Processando')).toBeInTheDocument();
    expect(row).toHaveTextContent('Pronto em 2 dias (Verão 3, Ano 1)');
  });

  it('should show the next cask milestone date, skipping the ones already reached', () => {
    renderList([
      machineBatch({
        ...CASK,
        schedule: {
          ...MACHINE_SCHEDULE,
          status: 'aging',
          readyOn: null,
          milestones: [
            { quality: 'silver', on: { year: 1, season: 'spring', day: 15 } },
            { quality: 'gold', on: { year: 1, season: 'summer', day: 10 } },
            { quality: 'iridium', on: { year: 1, season: 'fall', day: 1 } },
          ],
          daysUntilNext: 9,
        },
      }),
    ]);
    expect(rows()[0]).toHaveTextContent(
      'Próxima qualidade em 9 dias (Verão 10, Ano 1)',
    );
  });

  it('should offer Recolocar only for batch machines', async () => {
    renderList([KEG, CASK]);
    expect(await openMenu(rows()[0])).toEqual([
      'Editar',
      'Recolocar',
      'Esvaziar',
    ]);
    await userEvent.keyboard('{Escape}');
    expect(await openMenu(rows()[1])).toEqual(['Editar', 'Esvaziar']);
  });

  it('should call the handlers from the actions menu', async () => {
    const { onEdit, onRecollect, onRemove } = renderList([KEG]);
    await openMenu(rows()[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(onEdit).toHaveBeenCalledWith(KEG);
    await openMenu(rows()[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Recolocar' }));
    expect(onRecollect).toHaveBeenCalledWith(KEG);
    await openMenu(rows()[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Esvaziar' }));
    expect(onRemove).toHaveBeenCalledWith(KEG);
  });

  it('should show the empty state with a button to add a machine', async () => {
    const { onAdd } = renderList([]);
    expect(screen.getByText('Nenhuma máquina ainda')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Nova máquina' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('should mark an invalid batch as Indisponível, list it only under Todas and offer only Editar and Esvaziar', async () => {
    renderList([KEG, INVALID_MACHINE]);
    const row = rows()[1];
    expect(row).toHaveTextContent('Barril sumido');
    expect(within(row).getByText('Indisponível')).toBeInTheDocument();
    expect(await openMenu(row)).toEqual(['Editar', 'Esvaziar']);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /^Todas/ })).toHaveTextContent(
      '2',
    );
    expect(screen.getByRole('button', { name: /^Prontas/ })).toHaveTextContent(
      '0',
    );
    expect(
      screen.getByRole('button', { name: /^Em andamento/ }),
    ).toHaveTextContent('1');
    await userEvent.click(
      screen.getByRole('button', { name: /^Em andamento/ }),
    );
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).not.toHaveTextContent('Barril sumido');
  });

  it('should show the machine sprite before the name when the machine has one', () => {
    renderList([KEG]);
    const row = screen.getAllByRole('listitem')[0];
    expect(row.querySelector('img')).toHaveAttribute('src', iconUrl('keg'));
  });
});

describe('MachineList in English', () => {
  const renderEnglish = (batches: MachineBatchOut[] = [KEG, HONEY, CASK]) =>
    renderWithIntl(
      <MachineList
        batches={batches}
        machines={MACHINES}
        today={SUMMER_1}
        onEdit={vi.fn()}
        onRecollect={vi.fn()}
        onRemove={vi.fn()}
        onAdd={vi.fn()}
      />,
      { locale: 'en' },
    );

  it('should show the tabs with counts and the rows in English', () => {
    renderEnglish();
    expect(screen.getByRole('button', { name: /^All/ })).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: /^Ready/ })).toHaveTextContent(
      '1',
    );
    expect(
      screen.getByRole('button', { name: /^In progress/ }),
    ).toHaveTextContent('2');
    const list = screen.getByRole('list', { name: 'Machines' });
    expect(within(list).getByText(/3 machines/)).toBeInTheDocument();
    expect(
      within(list).getAllByText(/Started on Summer 1, Year 1/),
    ).toHaveLength(3);
    expect(within(list).getByText('Ready to collect')).toBeInTheDocument();
  });

  it('should show a machine status through the labels in English', () => {
    renderEnglish();
    expect(screen.getByText('Aging')).toBeInTheDocument();
    expect(screen.getAllByText('Processing').length).toBeGreaterThan(0);
  });

  it('should list Edit, Refill and Empty in the actions menu', async () => {
    renderEnglish([KEG]);
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(
      (await screen.findAllByRole('menuitem')).map((item) => item.textContent),
    ).toEqual(['Edit', 'Refill', 'Empty']);
  });

  it('should show the empty state in English', () => {
    renderEnglish([]);
    expect(screen.getByText('No machines yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first machine.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'New machine' }),
    ).toBeInTheDocument();
  });
});
