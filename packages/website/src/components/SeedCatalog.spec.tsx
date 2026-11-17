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

  it('should compare selling raw, the jar and the keg on each card', () => {
    mocks.useSeedValues.mockReturnValue({
      ...loaded,
      data: [
        {
          ...SEED_VALUES[0],
          prices: { normal: 120, silver: 150, gold: 180, iridium: 240 },
          jar: { item: 'jelly', price: 290 },
          keg: { item: 'wine', price: 360 },
          jarGoldPerDayTenths: 414,
          kegGoldPerDayTenths: 514,
        },
        SEED_VALUES[1],
      ],
    });
    renderCatalog();
    const card = screen
      .getByText('Sementes de Fruta')
      .closest('li') as HTMLElement;
    expect(within(card).getByText('Base 120g')).toBeInTheDocument();
    expect(within(card).getByText('Prata 150g')).toBeInTheDocument();
    expect(within(card).getByText('Ouro 180g')).toBeInTheDocument();
    expect(within(card).getByText('Irídio 240g')).toBeInTheDocument();
    expect(within(card).getByText('Jarra · Geleia 290g')).toBeInTheDocument();
    const keg = within(card).getByText('Barril · Vinho 360g');
    expect(keg.closest('div')).toHaveClass('text-green-700');
    expect(within(card).getByText('51,4 g/dia')).toBeInTheDocument();
    expect(within(card).getByText('41,4 g/dia')).toBeInTheDocument();
  });

  it('should show a dash on jar and keg when the seed has no product', () => {
    mocks.useSeedValues.mockReturnValue({
      ...loaded,
      data: [
        {
          ...SEED_VALUES[0],
          prices: { normal: 30, silver: 37, gold: 45, iridium: 60 },
          jar: null,
          keg: null,
          jarGoldPerDayTenths: null,
          kegGoldPerDayTenths: null,
        },
        SEED_VALUES[1],
      ],
    });
    renderCatalog();
    const card = screen
      .getByText('Sementes de Fruta')
      .closest('li') as HTMLElement;
    expect(within(card).getByText('Jarra · —')).toBeInTheDocument();
    expect(within(card).getByText('Barril · —')).toBeInTheDocument();
  });

  it('should reveal the quality prices on mobile behind an icon button', async () => {
    mocks.useSeedValues.mockReturnValue({
      ...loaded,
      data: [
        {
          ...SEED_VALUES[0],
          prices: { normal: 120, silver: 150, gold: 180, iridium: 240 },
        },
        SEED_VALUES[1],
      ],
    });
    renderCatalog();
    const card = screen
      .getByText('Sementes de Fruta')
      .closest('li') as HTMLElement;
    const toggle = within(card).getByRole('button', { name: 'Ver preços' });
    expect(toggle).toHaveAttribute('title', 'Ver preços');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(card).getByText('Base 120g').parentElement).toHaveClass(
      'hidden',
    );
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(card).getByText('Base 120g').parentElement).not.toHaveClass(
      'hidden',
    );
  });

  it('should say jar and keg assume enough machines', () => {
    renderCatalog();
    expect(
      screen.getByText(
        'Jarra e barril supõem máquinas suficientes para toda a colheita.',
      ),
    ).toBeInTheDocument();
  });

  it('should sort by the best gold per day when chosen', async () => {
    renderCatalog();
    await choose('Ordenar por', 'Melhor g/dia');
    expect(
      screen.getByRole('button', { name: /^Ordenar por/ }),
    ).toHaveTextContent('Melhor g/dia');
  });

  it('should name green tea from the keg', () => {
    mocks.useSeedValues.mockReturnValue({
      ...loaded,
      data: [
        {
          ...SEED_VALUES[0],
          prices: { normal: 50, silver: 62, gold: 75, iridium: 100 },
          keg: { item: 'green-tea', price: 100 },
          kegGoldPerDayTenths: 10,
        },
        SEED_VALUES[1],
      ],
    });
    renderCatalog();
    expect(screen.getByText('Barril · Chá Verde 100g')).toBeInTheDocument();
  });

  it('should name coffee from the keg', () => {
    mocks.useSeedValues.mockReturnValue({
      ...loaded,
      data: [
        {
          ...SEED_VALUES[0],
          prices: { normal: 15, silver: 18, gold: 22, iridium: 30 },
          keg: { item: 'coffee', price: 30 },
          kegGoldPerDayTenths: 10,
        },
        SEED_VALUES[1],
      ],
    });
    renderCatalog();
    expect(screen.getByText('Barril · Café 30g')).toBeInTheDocument();
  });
});
