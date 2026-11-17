import { screen, within } from '@testing-library/react';
import { expectLoading } from '../components/expectLoading';
import { renderWithRouter } from '../components/renderWithRouter';
import type { GameEntityOut } from '../generated/stardew-valley-api/types.gen';
import { iconUrl } from '../lib/icons';
import { buildShops } from '../lib/shops';
import { Route } from './lojas.index';

const mocks = vi.hoisted(() => ({
  useMe: vi.fn(),
  useShops: vi.fn(),
  useFixedEvents: vi.fn(),
}));
vi.mock('../hooks/useGameData', () => mocks);

const Page = Route.options.component as () => React.ReactElement;
const WEDNESDAY = { year: 1, season: 'spring', day: 3 } as const;
const text = (s: string) => ({ en: s, ptBr: s });
const shopEntity = (
  id: string,
  name: string,
  schedule?: Record<string, unknown>,
  note?: string,
): GameEntityOut => ({
  type: 'lojas',
  id,
  name: text(name),
  attributes: schedule
    ? { schedule, scheduleText: note ? { note: text(note) } : {} }
    : {},
});
const SHOPS = buildShops([
  shopEntity('test-store', 'Armazém Teste', {
    hours: { open: '09:00', close: '17:00' },
    closedDaysBeforeCC: ['wed'],
    closedDaysAfterCC: [],
  }),
  shopEntity('test-fixed', 'Loja Fixa', {
    hours: { open: '10:00', close: '15:00' },
    closedDays: ['sat', 'sun'],
  }),
  shopEntity(
    'test-note',
    'Loja Nota',
    { hours: { open: '09:00', close: '17:00' } },
    'Nota teste',
  ),
  shopEntity('test-none', 'Sem Horário'),
]);

const mockMe = (profile: Record<string, unknown> = {}) =>
  mocks.useMe.mockReturnValue({
    data: { profile: { currentDate: WEDNESDAY, ...profile } },
    isPending: false,
    isError: false,
  });

const renderPage = () =>
  renderWithRouter(null, {
    initialPath: '/lojas',
    pages: [{ path: '/lojas', component: Page }],
  });

const rowOf = (name: string) =>
  screen.getByRole('row', { name: new RegExp(name) });

beforeEach(() => {
  vi.clearAllMocks();
  mockMe();
  mocks.useShops.mockReturnValue({
    data: SHOPS,
    isPending: false,
    isError: false,
  });
  mocks.useFixedEvents.mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
  });
});

describe('/lojas page', () => {
  it('should show the shop closed on a Wednesday with the reason', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Lojas' });
    const row = rowOf('Armazém Teste');
    expect(within(row).getByText('Fechada')).toBeInTheDocument();
    expect(within(row).getByText('Fecha às quartas')).toBeInTheDocument();
    expect(within(row).getByText('Fecha: qua')).toBeInTheDocument();
    expect(within(row).getByText('qua')).toBeInTheDocument();
  });

  it('should show the shop open once the Community Center is restored', async () => {
    mockMe({ communityCenterRestored: true });
    renderPage();
    const row = await screen.findByRole('row', { name: /Armazém Teste/ });
    expect(within(row).getByText('Aberta')).toBeInTheDocument();
    expect(within(row).getByText('9:00–17:00')).toBeInTheDocument();
  });

  it('should list the fixed closed weekdays', async () => {
    renderPage();
    const row = await screen.findByRole('row', { name: /Loja Fixa/ });
    expect(within(row).getByText('Fecha: sáb, dom')).toBeInTheDocument();
    expect(within(row).getByText('sáb, dom')).toBeInTheDocument();
  });

  it('should show the schedule note in the observations', async () => {
    renderPage();
    const row = await screen.findByRole('row', { name: /Loja Nota/ });
    expect(within(row).getAllByText('Nota teste')).toHaveLength(2);
  });

  it('should show no mobile closed-days line when there are no fixed closed days', async () => {
    renderPage();
    const row = await screen.findByRole('row', { name: /Loja Nota/ });
    expect(within(row).queryByText(/^Fecha:/)).not.toBeInTheDocument();
  });

  it('should list a shop without a schedule', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Lojas' });
    expect(screen.getByText('Sem Horário')).toBeInTheDocument();
  });

  it('should show a loading notice', async () => {
    mocks.useShops.mockReturnValue({ isPending: true, isError: false });
    renderPage();
    expectLoading(await screen.findByText('Carregando lojas...'));
  });

  it('should show an error notice', async () => {
    mocks.useShops.mockReturnValue({ isPending: false, isError: true });
    renderPage();
    expect(
      await screen.findByText('Não foi possível carregar as lojas.'),
    ).toBeInTheDocument();
  });

  it('should show the shop sprite before the name when the shop has one', async () => {
    mocks.useShops.mockReturnValue({
      data: buildShops([
        shopEntity('pierre', 'Armazém do Pierre', {
          hours: { open: '09:00', close: '17:00' },
        }),
      ]),
      isPending: false,
      isError: false,
    });
    renderPage();
    const row = await screen.findByRole('row', { name: /Armazém do Pierre/ });
    expect(row.querySelector('img')).toHaveAttribute('src', iconUrl('pierre'));
  });
});

describe('/lojas page links', () => {
  it('should link each shop name to its catalog page', async () => {
    renderPage();
    const row = await screen.findByRole('row', { name: /Loja Fixa/ });
    expect(
      within(row).getByRole('link', { name: /Loja Fixa/ }),
    ).toHaveAttribute('href', '/lojas/test-fixed');
  });
});
