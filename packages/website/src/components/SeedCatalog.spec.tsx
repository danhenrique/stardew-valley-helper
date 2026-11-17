import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { iconUrl } from '../lib/icons';
import { SeedCatalog } from './SeedCatalog';
import { PLANTABLES, SEED_VALUES } from './testData';

const mocks = vi.hoisted(() => ({ useSeedValues: vi.fn() }));
vi.mock('../hooks/useGameData', () => mocks);

const loaded = { data: SEED_VALUES, isPending: false, isError: false };

const renderCatalog = (
  props: Partial<ComponentProps<typeof SeedCatalog>> = {},
) =>
  render(
    <SeedCatalog
      plantables={PLANTABLES}
      initialSeason="spring"
      currentSeason="spring"
      currentDay={10}
      agriculturist={false}
      artisan={false}
      {...props}
    />,
  );

const lastRequest = () => mocks.useSeedValues.mock.lastCall?.[0];

const cardNames = () =>
  screen
    .getAllByRole('listitem')
    .map((item) => item.querySelector('p')?.textContent);

const choose = async (label: string, option: string) => {
  await userEvent.click(
    screen.getByRole('button', { name: new RegExp(`^${label}`) }),
  );
  await userEvent.click(
    screen.getByRole('option', { name: new RegExp(option) }),
  );
};

describe('SeedCatalog', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.useSeedValues.mockReset();
    mocks.useSeedValues.mockReturnValue(loaded);
  });

  it('should show spring crops and saplings when the spring tab is selected', () => {
    renderCatalog();
    expect(screen.getByText('Sementes de Fruta')).toBeInTheDocument();
    expect(screen.getByText('Muda Teste')).toBeInTheDocument();
    expect(screen.queryByText('Sementes de Melão')).not.toBeInTheDocument();
  });

  it('should switch the list when another season tab is clicked', async () => {
    renderCatalog();
    await userEvent.click(screen.getByRole('button', { name: 'Verão' }));
    expect(screen.getByRole('button', { name: 'Verão' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('Sementes de Melão')).toBeInTheDocument();
    expect(screen.queryByText('Sementes de Fruta')).not.toBeInTheDocument();
  });

  it('should switch season when the mobile select changes', async () => {
    renderCatalog();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Escolher estação' }),
      'summer',
    );
    expect(screen.getByText('Sementes de Melão')).toBeInTheDocument();
  });

  it('should describe growth, regrowth and tree maturity when showing cards', () => {
    renderCatalog();
    expect(
      screen.getByText('Primavera · 8 dias · rebrota 4'),
    ).toBeInTheDocument();
    expect(screen.getByText('Outono · árvore: 28 dias')).toBeInTheDocument();
  });

  it('should show the seed sprite when the plantable has one', () => {
    renderCatalog({ plantables: [{ ...PLANTABLES[0], id: 'parsnip-seeds' }] });
    const item = screen.getByText('Sementes de Fruta').closest('li');
    expect(item?.querySelector('img')).toHaveAttribute(
      'src',
      iconUrl('parsnip-seeds'),
    );
  });

  it('should keep the initials when the plantable has no sprite', () => {
    renderCatalog();
    const item = screen.getByText('Sementes de Fruta').closest('li');
    expect(item?.querySelector('img')).toBeNull();
  });

  it('should keep each control in its own grid cell when the controls render', () => {
    renderCatalog();
    const grid = screen.getByTestId('seed-controls');
    expect(grid.children).toHaveLength(4);
    for (const label of ['Período', 'Fertilizante', 'Ordenar por']) {
      const cell = [...grid.children].find((child) =>
        child.textContent?.startsWith(label),
      );
      expect(cell?.querySelector('button')).not.toBeNull();
    }
  });

  it('should request values from today when the current season is shown', () => {
    renderCatalog();
    expect(lastRequest()).toEqual({
      season: 'spring',
      fromDay: 10,
      fertilizer: 'none',
      farmingLevel: 0,
      agriculturist: false,
      artisan: false,
    });
    expect(
      screen.getByRole('button', { name: 'A partir de hoje' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('should request the whole season and disable "A partir de hoje" when another season is shown', async () => {
    renderCatalog();
    await userEvent.click(screen.getByRole('button', { name: 'Verão' }));
    expect(lastRequest()).toMatchObject({ season: 'summer', fromDay: 1 });
    expect(
      screen.getByRole('button', { name: 'A partir de hoje' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Estação inteira' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('should restore today when returning to the current season', async () => {
    renderCatalog();
    await userEvent.click(screen.getByRole('button', { name: 'Verão' }));
    await userEvent.click(screen.getByRole('button', { name: 'Primavera' }));
    expect(lastRequest()).toMatchObject({ season: 'spring', fromDay: 10 });
  });

  it('should request the whole season when "Estação inteira" is chosen', async () => {
    renderCatalog();
    await userEvent.click(
      screen.getByRole('button', { name: 'Estação inteira' }),
    );
    expect(lastRequest()).toMatchObject({ fromDay: 1 });
  });

  it('should pass the artisan profession when the profile has it', () => {
    renderCatalog({ artisan: true });
    expect(lastRequest()).toMatchObject({ artisan: true });
  });

  it('should pass the agriculturist profession when the profile has it', () => {
    renderCatalog({ agriculturist: true });
    expect(lastRequest()).toMatchObject({ agriculturist: true });
  });

  it('should request and remember the fertilizer and farming level when they change', async () => {
    const { unmount } = renderCatalog();
    await choose('Fertilizante', 'Fertilizante de Qualidade');
    await userEvent.click(
      screen.getByRole('button', { name: 'Aumentar Nível de Agricultura' }),
    );
    expect(lastRequest()).toMatchObject({
      fertilizer: 'quality',
      farmingLevel: 1,
    });
    unmount();
    mocks.useSeedValues.mockClear();
    renderCatalog();
    expect(mocks.useSeedValues.mock.calls[0][0]).toMatchObject({
      fertilizer: 'quality',
      farmingLevel: 1,
    });
  });

  it('should show gold per day and gold total when a seed has a value', () => {
    renderCatalog();
    const card = screen.getByText('Sementes de Fruta').closest('li');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('15,7 g/dia')).toBeVisible();
    expect(
      within(card as HTMLElement).getByText('440 g · 4 colheitas'),
    ).toBeVisible();
  });

  it('should show the other groups after the valued seeds when sorting by gold per day', () => {
    renderCatalog();
    expect(cardNames()).toEqual([
      'Sementes de Fruta',
      'Flower Seeds',
      'Muda Teste',
    ]);
    const flower = screen.getByText('Flower Seeds').closest('li');
    expect(
      within(flower as HTMLElement).getByText('Não amadurece a tempo'),
    ).toBeVisible();
    const sapling = screen.getByText('Muda Teste').closest('li');
    expect(within(sapling as HTMLElement).getByText('—')).toBeVisible();
  });

  it('should order cards by name when "Nome" is chosen', async () => {
    renderCatalog();
    await choose('Ordenar por', 'Nome');
    expect(cardNames()).toEqual([
      'Flower Seeds',
      'Muda Teste',
      'Sementes de Fruta',
    ]);
  });

  it('should show a skeleton in the value slot when values are loading', () => {
    mocks.useSeedValues.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderCatalog();
    expect(screen.getAllByTestId('seed-value-skeleton')).toHaveLength(3);
    expect(screen.queryByText('15,7 g/dia')).not.toBeInTheDocument();
  });

  it('should show the notice and order by name when values fail', () => {
    mocks.useSeedValues.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    renderCatalog();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível calcular os valores.',
    );
    expect(cardNames()).toEqual([
      'Flower Seeds',
      'Muda Teste',
      'Sementes de Fruta',
    ]);
  });
});
