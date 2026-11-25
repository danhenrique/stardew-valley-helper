import { screen, within } from '@testing-library/react';
import type { GameEntityOut } from '../generated/stardew-valley-api/types.gen';
import { buildShops } from '../lib/shops';
import { renderWithRouter } from './renderWithRouter';
import { ShopGrid } from './ShopGrid';

const text = (s: string) => ({ en: s, ptBr: s });
const HOURS = { open: '09:00', close: '17:00' };
const entity = (
  id: string,
  name: string,
  attributes: Record<string, unknown>,
): GameEntityOut => ({ type: 'shops', id, name: text(name), attributes });
// Day 3 is a Wednesday.
const WEDNESDAY = { year: 1, season: 'spring', day: 3 } as const;
const SHOPS = buildShops(
  [
    entity('test-krobus', 'Krobus', {
      access: { en: 'Rusty Key', ptBr: 'Requer Chave Enferrujada' },
    }),
    entity('test-zeta', 'Zeta Aberta', { schedule: { hours: HOURS } }),
    entity('test-wed', 'Fecha Quarta', {
      schedule: { hours: HOURS, closedDays: ['wed'] },
    }),
    entity('test-alfa', 'Alfa Aberta', {
      schedule: { hours: HOURS },
      scheduleText: { note: text('Nota teste') },
    }),
    entity('museum', 'Museu', { schedule: { hours: HOURS } }),
  ],
  'pt-BR',
);

const renderGrid = async () => {
  renderWithRouter(
    <ShopGrid shops={SHOPS} today={WEDNESDAY} events={[]} progress={{}} />,
  );
  return screen.findAllByRole('listitem');
};
const cardOf = (name: string) =>
  screen.getByText(name).closest('li') as HTMLElement;

describe('ShopGrid', () => {
  it('should order open, closed, then shops without schedule, by name in each group', async () => {
    const cards = await renderGrid();
    expect(
      cards.map((card) => within(card).getAllByText(/\S/)[0].textContent),
    ).toEqual([
      'Alfa Aberta',
      'Museu',
      'Zeta Aberta',
      'Fecha Quarta',
      'Krobus',
    ]);
  });

  it('should show the badge, hours and notes of an open shop', async () => {
    await renderGrid();
    const card = cardOf('Alfa Aberta');
    expect(within(card).getByText('Aberta')).toBeInTheDocument();
    expect(within(card).getByText('9:00–17:00')).toBeInTheDocument();
    expect(within(card).getByText('Nota teste')).toBeInTheDocument();
  });

  it('should dim a closed shop and show its reason and closed days', async () => {
    await renderGrid();
    const card = cardOf('Fecha Quarta');
    expect(within(card).getByText('Fechada')).toBeInTheDocument();
    expect(within(card).getByText('Fecha às quartas')).toBeInTheDocument();
    expect(within(card).getByText('Fecha: qua')).toBeInTheDocument();
    expect(card.firstElementChild).toHaveClass('opacity-60');
  });

  it('should show a shop without schedule with its access requirement', async () => {
    await renderGrid();
    const card = cardOf('Krobus');
    expect(within(card).getByText('Sem horário fixo')).toBeInTheDocument();
    expect(
      within(card).getByText('Requer Chave Enferrujada'),
    ).toBeInTheDocument();
  });

  it('should link shops with a catalog and not the ones without', async () => {
    await renderGrid();
    expect(within(cardOf('Krobus')).getByRole('link')).toHaveAttribute(
      'href',
      '/shops/test-krobus',
    );
    expect(within(cardOf('Museu')).queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('ShopGrid hour ranges', () => {
  const TWO = {
    ...SHOPS[1],
    id: 'test-two',
    schedule: {
      hours: { open: '09:00', close: '17:00' },
      hoursWithKeyToTown: [
        { open: '06:00', close: '07:00' },
        { open: '08:30', close: '17:00' },
      ],
    },
  };
  const hoursText = async (locale: 'pt-BR' | 'en', progress = {}) => {
    renderWithRouter(
      <ShopGrid
        shops={[TWO]}
        today={WEDNESDAY}
        events={[]}
        progress={progress}
      />,
      { locale },
    );
    return (await screen.findByRole('listitem')).textContent;
  };

  it('should show one range as is', async () => {
    expect(await hoursText('pt-BR')).toContain('9:00–17:00');
  });

  it('should join two ranges with "e" in Portuguese', async () => {
    expect(await hoursText('pt-BR', { keyToTown: true })).toContain(
      '6:00–7:00 e 8:30–17:00',
    );
  });

  it('should join two ranges with "and" in English', async () => {
    expect(await hoursText('en', { keyToTown: true })).toContain(
      '6:00–7:00 and 8:30–17:00',
    );
  });

  it('should show one range as is in English', async () => {
    expect(await hoursText('en')).toContain('9:00–17:00');
  });

  it('should nest the conjunction for three ranges in Portuguese', async () => {
    const three = {
      ...TWO,
      schedule: {
        hours: { open: '09:00', close: '17:00' },
        hoursWithKeyToTown: [
          { open: '06:00', close: '07:00' },
          { open: '08:30', close: '12:00' },
          { open: '13:00', close: '17:00' },
        ],
      },
    };
    renderWithRouter(
      <ShopGrid
        shops={[three]}
        today={WEDNESDAY}
        events={[]}
        progress={{ keyToTown: true }}
      />,
      { locale: 'pt-BR' },
    );
    expect((await screen.findByRole('listitem')).textContent).toContain(
      '6:00–7:00 e 8:30–12:00 e 13:00–17:00',
    );
  });

  it('should nest the conjunction for three ranges in English', async () => {
    const three = {
      ...TWO,
      schedule: {
        hours: { open: '09:00', close: '17:00' },
        hoursWithKeyToTown: [
          { open: '06:00', close: '07:00' },
          { open: '08:30', close: '12:00' },
          { open: '13:00', close: '17:00' },
        ],
      },
    };
    renderWithRouter(
      <ShopGrid
        shops={[three]}
        today={WEDNESDAY}
        events={[]}
        progress={{ keyToTown: true }}
      />,
      { locale: 'en' },
    );
    expect((await screen.findByRole('listitem')).textContent).toContain(
      '6:00–7:00 and 8:30–12:00 and 13:00–17:00',
    );
  });
});
