import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameEntityOut } from '../generated/stardew-valley-api/types.gen';
import { buildEvents } from '../lib/events';
import { buildShops } from '../lib/shops';
import { expectLoading } from './expectLoading';
import { OpenShops } from './OpenShops';
import { renderWithRouter } from './renderWithRouter';
import { TEST_FESTIVAL } from './testData';

const mocks = vi.hoisted(() => ({ useShopOffers: vi.fn() }));
vi.mock('../hooks/useGameData', () => mocks);
vi.mock('../hooks/useGameNames', () => ({
  useGameNames: () => ({ nameOf: (id: string) => id }),
}));

const text = (s: string) => ({ en: s, ptBr: s });
const shop = (
  id: string,
  name: string,
  schedule: Record<string, unknown>,
): GameEntityOut => ({
  type: 'lojas',
  id,
  name: text(name),
  attributes: { schedule, scheduleText: {} },
});
const HOURS = { open: '09:00', close: '17:00' };
const SHOPS = buildShops([
  shop('test-store', 'Armazém Teste', { hours: HOURS, closedIfRain: true }),
  shop('test-wednesday', 'Fecha Quarta', { hours: HOURS, closedDays: ['wed'] }),
  shop('test-summer', 'Só Verão', { hours: HOURS, openSeasons: ['summer'] }),
  shop('test-festival-shop', 'Fecha no Festival', {
    hours: HOURS,
    festivalClosure: 'all',
  }),
  shop('museum', 'Museu', { hours: HOURS }),
  shop('traveling-cart', 'Carroça', { hours: HOURS }),
  { type: 'lojas', id: 'test-no-schedule', name: text('Sem Horário'), attributes: {} },
]);
// Day 3 is a Wednesday.
const WEDNESDAY = { year: 1, season: 'spring', day: 3 } as const;
const FESTIVAL_DAY = { year: 1, season: 'spring', day: 13 } as const;
const FESTIVALS = buildEvents({
  festivals: [
    {
      ...TEST_FESTIVAL,
      attributes: { ...TEST_FESTIVAL.attributes, shopsClosed: true },
    },
  ],
  villagers: [],
  foraging: [],
  plantables: [],
});

const renderShops = async (
  props: Partial<Parameters<typeof OpenShops>[0]> = {},
) => {
  renderWithRouter(
    <OpenShops
      shops={SHOPS}
      today={WEDNESDAY}
      events={[]}
      progress={{}}
      status="success"
      {...props}
    />,
  );
  await screen.findByRole('heading', { name: 'Lojas abertas hoje' });
};

beforeEach(() => {
  mocks.useShopOffers.mockReturnValue({ status: 'success', offers: [] });
});

describe('OpenShops', () => {
  it('should list only the shops open today', async () => {
    await renderShops();
    expect(screen.getByText('Armazém Teste')).toBeInTheDocument();
    expect(screen.queryByText('Fecha Quarta')).not.toBeInTheDocument();
    expect(screen.queryByText('Só Verão')).not.toBeInTheDocument();
    expect(screen.queryByText('Sem Horário')).not.toBeInTheDocument();
  });

  it('should hide the shops a festival closes when it is a festival day', async () => {
    await renderShops({ today: FESTIVAL_DAY, events: FESTIVALS });
    expect(screen.queryByText('Fecha no Festival')).not.toBeInTheDocument();
    expect(screen.getByText('Armazém Teste')).toBeInTheDocument();
  });

  it('should wait for the events before listing shops when the events are not loaded', async () => {
    await renderShops({ eventsStatus: 'pending' });
    expectLoading(screen.getByText('Carregando lojas...'));
    expect(screen.queryByText('Armazém Teste')).not.toBeInTheDocument();
  });

  it('should show the error when the events fail to load', async () => {
    await renderShops({ eventsStatus: 'error' });
    expect(
      screen.getByText('Não foi possível carregar as lojas.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Armazém Teste')).not.toBeInTheDocument();
  });

  it('should show when an open shop closes on its tile', async () => {
    await renderShops();
    const tile = screen.getByRole('button', { name: /Armazém Teste/ });
    expect(within(tile).getByText('até 17:00')).toBeInTheDocument();
    expect(within(tile).queryByText('9:00–17:00')).not.toBeInTheDocument();
  });

  it('should show the closing time of the last range when a shop has several', async () => {
    await renderShops({
      shops: buildShops([
        shop('test-split', 'Dois Turnos', {
          hours: HOURS,
          hoursWithKeyToTown: [
            { open: '06:00', close: '12:00' },
            { open: '14:00', close: '23:00' },
          ],
        }),
      ]),
      progress: { keyToTown: true },
    });
    const tile = screen.getByRole('button', { name: /Dois Turnos/ });
    expect(within(tile).getByText('até 23:00')).toBeInTheDocument();
  });

  it('should keep the notes of a shop out of sight but readable', async () => {
    await renderShops();
    const tile = screen.getByRole('button', { name: /Armazém Teste/ });
    expect(tile).toHaveAccessibleName(/Fecha se chover/);
    expect(within(tile).getByText('Fecha se chover')).toHaveClass('sr-only');
    expect(tile).toHaveAttribute(
      'title',
      'Armazém Teste · 9:00–17:00 · Fecha se chover',
    );
  });

  it('should show the notes of a shop in its catalog modal', async () => {
    await renderShops();
    await userEvent.click(
      screen.getByRole('button', { name: /Armazém Teste/ }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Armazém Teste' });
    expect(
      within(dialog).getByText('9:00–17:00 · Fecha se chover'),
    ).toBeInTheDocument();
  });

  it('should open the catalog modal when a shop is clicked', async () => {
    await renderShops();
    await userEvent.click(
      screen.getByRole('button', { name: /Armazém Teste/ }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Armazém Teste' }),
    ).toBeInTheDocument();
  });

  it('should not make shops without a catalog clickable', async () => {
    await renderShops();
    expect(screen.getByText('Museu')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Museu/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Carroça/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Estoque aleatório')).toHaveClass('sr-only');
  });

  it('should lay the open shops out as a grid of tiles', async () => {
    await renderShops();
    const grid = screen.getByRole('list');
    expect(grid).toHaveClass('grid');
    expect(within(grid).getAllByRole('listitem')).toHaveLength(4);
  });

  it('should link to every shop', async () => {
    await renderShops();
    expect(
      screen.getByRole('link', { name: 'Ver todas as lojas' }),
    ).toHaveAttribute('href', '/lojas');
  });

  it('should show the loading, error and empty states', async () => {
    await renderShops({ status: 'pending' });
    expectLoading(screen.getByText('Carregando lojas...'));
  });

  it('should show an error when the shops fail to load', async () => {
    await renderShops({ status: 'error' });
    expect(
      screen.getByText('Não foi possível carregar as lojas.'),
    ).toBeInTheDocument();
  });

  it('should say no shop is open when every shop is closed', async () => {
    await renderShops({
      shops: SHOPS.filter((s) => s.id === 'test-wednesday'),
    });
    expect(screen.getByText('Nenhuma loja aberta hoje.')).toBeInTheDocument();
  });
});
