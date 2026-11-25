import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { iconUrl } from '../lib/icons';
import { PlantingList } from './PlantingList';
import { renderWithIntl } from './renderWithIntl';
import { BERRY_PLANTING, INVALID_PLANTING, NAMES } from './testData';

const renderList = (canReplant = true) => {
  const onEdit = vi.fn();
  const onRemove = vi.fn();
  const onReplant = vi.fn();
  renderWithIntl(
    <PlantingList
      plantings={[BERRY_PLANTING]}
      names={NAMES}
      onEdit={onEdit}
      onRemove={onRemove}
      onReplant={onReplant}
      canReplant={() => canReplant}
    />,
  );
  return { onEdit, onRemove, onReplant };
};

const openMenu = () =>
  userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));

describe('PlantingList', () => {
  it('should show seed name, quantity, status and next harvest when rendering a planting', () => {
    renderList();
    expect(screen.getByText('Sementes de Fruta')).toBeInTheDocument();
    expect(screen.getByText('Crescendo')).toBeInTheDocument();
    expect(screen.getByText(/3 unidades/)).toBeInTheDocument();
    expect(
      screen.getByText(/Plantado em Primavera 1, Ano 1/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Próxima colheita em 8 dias/)).toBeInTheDocument();
    expect(screen.getByText(/≈ 15,3 no total/)).toBeInTheDocument();
  });

  it('should list Editar, Replantar and Remover in the actions menu', async () => {
    renderList();
    await openMenu();
    const items = (await screen.findAllByRole('menuitem')).map(
      (item) => item.textContent,
    );
    expect(items).toEqual(['Editar', 'Replantar', 'Remover']);
  });

  it('should hide Replantar when the planting cannot be replanted', async () => {
    renderList(false);
    await openMenu();
    await screen.findByRole('menuitem', { name: 'Editar' });
    expect(
      screen.queryByRole('menuitem', { name: 'Replantar' }),
    ).not.toBeInTheDocument();
  });

  it('should call onEdit when Editar is chosen in the actions menu', async () => {
    const { onEdit } = renderList();
    await openMenu();
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Editar' }),
    );
    expect(onEdit).toHaveBeenCalledWith(BERRY_PLANTING);
  });

  it('should call onReplant when Replantar is chosen in the actions menu', async () => {
    const { onReplant } = renderList();
    await openMenu();
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Replantar' }),
    );
    expect(onReplant).toHaveBeenCalledWith(BERRY_PLANTING);
  });

  it('should call onRemove when Remover is chosen in the actions menu', async () => {
    const { onRemove } = renderList();
    await openMenu();
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Remover' }),
    );
    expect(onRemove).toHaveBeenCalledWith(BERRY_PLANTING);
  });

  it('should show the empty state when there are no plantings', () => {
    renderWithIntl(
      <PlantingList
        plantings={[]}
        names={NAMES}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onReplant={vi.fn()}
        canReplant={() => false}
      />,
    );
    expect(screen.getByText('Nenhum plantio ainda')).toBeInTheDocument();
    expect(
      screen.getByText('Adicione sua primeira semente.'),
    ).toBeInTheDocument();
  });

  it('should show the empty state action when one is given', async () => {
    const onClick = vi.fn();
    renderWithIntl(
      <PlantingList
        plantings={[]}
        names={NAMES}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onReplant={vi.fn()}
        canReplant={() => false}
        emptyAction={{ label: 'Adicionar primeiro plantio', onClick }}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Adicionar primeiro plantio' }),
    );
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should mark an invalid planting as Indisponível and offer only Editar and Remover', async () => {
    renderWithIntl(
      <PlantingList
        plantings={[INVALID_PLANTING, BERRY_PLANTING]}
        names={NAMES}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onReplant={vi.fn()}
        canReplant={() => true}
      />,
    );
    const row = screen
      .getByText('Canteiro sumido')
      .closest('li') as HTMLElement;
    expect(within(row).getByText('Indisponível')).toBeInTheDocument();
    expect(within(row).queryByText(/Próxima colheita/)).not.toBeInTheDocument();
    await userEvent.click(
      within(row).getByRole('button', { name: 'Mais ações' }),
    );
    const items = (await screen.findAllByRole('menuitem')).map(
      (item) => item.textContent,
    );
    expect(items).toEqual(['Editar', 'Remover']);
  });

  it('should show the seed sprite before the name when the seed has one', () => {
    renderWithIntl(
      <PlantingList
        plantings={[{ ...BERRY_PLANTING, seedId: 'parsnip-seeds' }]}
        names={{ 'parsnip-seeds': 'Sementes de Chirívia' }}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onReplant={vi.fn()}
        canReplant={() => true}
      />,
    );
    const row = screen.getByText('Sementes de Chirívia').closest('li');
    expect(row?.querySelector('img')).toHaveAttribute(
      'src',
      iconUrl('parsnip-seeds'),
    );
  });
});

describe('PlantingList in English', () => {
  const renderEnglish = (props: { canReplant?: boolean } = {}) =>
    renderWithIntl(
      <PlantingList
        plantings={[BERRY_PLANTING]}
        names={NAMES}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onReplant={vi.fn()}
        canReplant={() => props.canReplant ?? true}
      />,
      { locale: 'en' },
    );

  it('should show the quantity, start, next harvest and status in English', () => {
    renderEnglish();
    expect(screen.getByText('Growing')).toBeInTheDocument();
    expect(screen.getByText(/3 units/)).toBeInTheDocument();
    expect(screen.getByText(/Planted on Spring 1, Year 1/)).toBeInTheDocument();
    expect(screen.getByText(/Next harvest in 8 days/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Plantings' })).toBeInTheDocument();
  });

  it('should list Edit, Replant and Remove in the actions menu', async () => {
    renderEnglish();
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    const items = (await screen.findAllByRole('menuitem')).map(
      (item) => item.textContent,
    );
    expect(items).toEqual(['Edit', 'Replant', 'Remove']);
  });

  it('should show the empty state in English', () => {
    renderWithIntl(
      <PlantingList
        plantings={[]}
        names={NAMES}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onReplant={vi.fn()}
        canReplant={() => false}
      />,
      { locale: 'en' },
    );
    expect(screen.getByText('No plantings yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first seed.')).toBeInTheDocument();
  });
});
