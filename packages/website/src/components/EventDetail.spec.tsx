import { screen } from '@testing-library/react';
import { buildEvents } from '../lib/events';
import { emptyTastes } from '../lib/gifts';
import { humanizeId } from '../lib/i18n';
import { iconUrl } from '../lib/icons';
import { EventDetail } from './EventDetail';
import { expectLoading } from './expectLoading';
import { renderWithRouter } from './renderWithRouter';
import {
  PLANTABLES,
  TEST_DEADLINE_PLANTABLE,
  TEST_FESTIVAL,
  TEST_FORAGING,
  TEST_VILLAGER,
} from './testData';

vi.mock('../hooks/useGameNames', () => ({
  useGameNames: () => ({
    nameOf: (id: string) =>
      id === 'test-wild-herb' ? 'Erva Selvagem Teste' : humanizeId(id),
  }),
}));

const lovedOf = (ids: string[]) => ({
  ...emptyTastes(),
  loves: ids.map((id) => ({ kind: 'item' as const, id, except: [] })),
});

const [festival, birthday, foraging, deadline] = [
  ...buildEvents({
    festivals: [TEST_FESTIVAL],
    villagers: [],
    foraging: [],
    plantables: [],
  }),
  ...buildEvents({
    festivals: [],
    villagers: [TEST_VILLAGER],
    foraging: [TEST_FORAGING],
    plantables: [TEST_DEADLINE_PLANTABLE],
  }),
];

const renderDetail = async (
  ...args: Parameters<typeof EventDetail> extends [infer P] ? [P] : never
) => {
  renderWithRouter(<EventDetail {...args[0]} />);
  await screen.findByRole('heading', { level: 1 });
};

describe('EventDetail', () => {
  it('should show a festival with its days and that shops close', async () => {
    await renderDetail({ event: festival, details: { shopsClosed: true } });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Festival Teste' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Festival')).toBeInTheDocument();
    expect(screen.getByText('Primavera 13–14')).toBeInTheDocument();
    expect(screen.getByText('Lojas fecham')).toBeInTheDocument();
  });

  it('should say shops stay open when the festival does not close them', async () => {
    await renderDetail({ event: festival, details: { shopsClosed: false } });
    expect(screen.getByText('Lojas abertas')).toBeInTheDocument();
  });

  it('should show the villager and humanized loved gifts for a birthday', async () => {
    await renderDetail({
      event: birthday,
      details: {
        gifts: {
          status: 'success',
          tastes: lovedOf(['test-golden-pumpkin', 'test-pearl']),
        },
      },
    });
    expect(screen.getByText('Aldeão Teste')).toBeInTheDocument();
    expect(screen.getByText('Primavera 5')).toBeInTheDocument();
    expect(screen.getByText('Test Golden Pumpkin')).toBeInTheDocument();
    expect(screen.getByText('Test Pearl')).toBeInTheDocument();
  });

  it('should show gift loading and error states', async () => {
    await renderDetail({
      event: birthday,
      details: { gifts: { status: 'pending', tastes: lovedOf([]) } },
    });
    expectLoading(screen.getByText('Carregando presentes...'));
  });

  it('should show an error when gifts fail to load', async () => {
    await renderDetail({
      event: birthday,
      details: { gifts: { status: 'error', tastes: lovedOf([]) } },
    });
    expect(
      screen.getByText('Não foi possível carregar os presentes.'),
    ).toBeInTheDocument();
  });

  it('should show growth days and the last planting day for a crop deadline', async () => {
    await renderDetail({
      event: deadline,
      details: { plantable: { ...PLANTABLES[0], lastPlantingDay: 18 } },
    });
    expect(screen.getByText('Prazo de plantio')).toBeInTheDocument();
    expect(screen.getByText('Primavera 20')).toBeInTheDocument();
    expect(screen.getByText('8 dias')).toBeInTheDocument();
    // 18 differs from the event's own day (20), so this proves the plantable is the source.
    expect(screen.getByText('Último dia de plantio')).toBeInTheDocument();
    expect(screen.getByText('Dia 18')).toBeInTheDocument();
  });

  it('should show the day window for a foraging event', async () => {
    await renderDetail({ event: foraging, details: {} });
    expect(screen.getByText('Coleta')).toBeInTheDocument();
    expect(screen.getByText('Primavera 20')).toBeInTheDocument();
  });

  it('should show the localized item of a foraging event', async () => {
    await renderDetail({
      event: { ...foraging, item: 'test-wild-herb' },
      details: {},
    });
    expect(screen.getByText('Item')).toBeInTheDocument();
    expect(screen.getByText('Erva Selvagem Teste')).toBeInTheDocument();
  });

  it('should hide the item row when the foraging event has no item', async () => {
    await renderDetail({ event: foraging, details: {} });
    expect(screen.queryByText('Item')).not.toBeInTheDocument();
  });

  it('should link back to the events list', async () => {
    await renderDetail({ event: foraging, details: {} });
    expect(
      screen.getByRole('link', { name: /Voltar para eventos/ }),
    ).toHaveAttribute('href', '/eventos');
  });

  it('should show the range for a multi-day foraging window', async () => {
    await renderDetail({
      event: { ...foraging, day: 8, endDay: 11 },
      details: {},
    });
    expect(screen.getByText('Primavera 8–11')).toBeInTheDocument();
    expect(screen.getByText('Dias')).toBeInTheDocument();
  });

  it.each([
    [true, 'Sim'],
    [false, 'Não'],
  ])(
    'should show marriageable=%s as %s for a birthday',
    async (value, text) => {
      await renderDetail({
        event: { ...birthday, marriageable: value },
        details: {},
      });
      expect(screen.getByText('Casável')).toBeInTheDocument();
      expect(screen.getByText(text)).toBeInTheDocument();
    },
  );

  it('should hide the marriageable row when the villager data does not say', async () => {
    await renderDetail({ event: birthday, details: {} });
    expect(screen.queryByText('Casável')).not.toBeInTheDocument();
  });

  it('should show the large villager portrait next to the title when it has an icon', async () => {
    await renderDetail({
      event: { ...birthday, refId: 'abigail' },
      details: {},
    });
    const img = screen.getByRole('heading', { level: 1 }).querySelector('img');
    expect(img).toHaveAttribute('src', iconUrl('abigail'));
    expect(img).toHaveClass('size-12');
  });

  it('should show the item sprite when the foraging item has one', async () => {
    await renderDetail({
      event: { ...foraging, item: 'salmonberry' },
      details: {},
    });
    const row = screen.getByText('Item').closest('div');
    expect(row?.querySelector('img')).toHaveAttribute(
      'src',
      iconUrl('salmonberry'),
    );
  });

  it('should show a sprite on each loved gift card when it has one', async () => {
    await renderDetail({
      event: birthday,
      details: {
        gifts: {
          status: 'success',
          tastes: lovedOf(['pearl', 'golden-pumpkin']),
        },
      },
    });
    const gift = screen.getByText('Pearl').closest('li');
    const img = gift?.querySelector('img');
    expect(img).toHaveAttribute('src', iconUrl('pearl'));
    expect(img).toHaveClass('size-6');
  });
});
