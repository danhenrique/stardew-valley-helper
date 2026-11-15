import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildEvents } from '../lib/events';
import { iconUrl } from '../lib/icons';
import { EventList } from './EventList';
import { renderWithRouter } from './renderWithRouter';
import {
  TEST_ACCENT_VILLAGER,
  TEST_DEADLINE_PLANTABLE,
  TEST_FESTIVAL,
  TEST_FORAGING,
  TEST_SUMMER_FESTIVAL,
  TEST_VILLAGER,
} from './testData';

const EVENTS = buildEvents({
  festivals: [TEST_SUMMER_FESTIVAL, TEST_FESTIVAL],
  villagers: [TEST_ACCENT_VILLAGER, TEST_VILLAGER],
  foraging: [TEST_FORAGING],
  plantables: [TEST_DEADLINE_PLANTABLE],
});

const renderList = async () => {
  renderWithRouter(<EventList events={EVENTS} />);
  await screen.findByRole('heading', { name: 'Primavera' });
};

describe('EventList', () => {
  it('should group events by season in game order and by day inside a season', async () => {
    await renderList();
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual(['Primavera', 'Verão', 'Outono']);
    const spring = screen.getByRole('region', { name: 'Primavera' });
    expect(
      within(spring)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual([
      expect.stringContaining('Aldeão Teste'),
      expect.stringContaining('Festival Teste'),
      expect.stringContaining('Coleta Teste'),
      expect.stringContaining('Sementes Prazo'),
    ]);
  });

  it('should show the day or day range and kind of each event', async () => {
    await renderList();
    const spring = screen.getByRole('region', { name: 'Primavera' });
    expect(within(spring).getByText('Primavera 13–14')).toBeInTheDocument();
    expect(within(spring).getByText('Primavera 5')).toBeInTheDocument();
    expect(within(spring).getByText('Aniversário')).toBeInTheDocument();
  });

  it('should link each event with an encoded id', async () => {
    await renderList();
    expect(
      screen.getByRole('link', { name: /Sementes Prazo/ }),
    ).toHaveAttribute(
      'href',
      expect.stringMatching(
        /^\/eventos\/cropDeadline(:|%3A)test-deadline-seeds(:|%3A)spring$/,
      ),
    );
  });

  it('should filter by kind', async () => {
    await renderList();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo de evento' }),
      'birthday',
    );
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.queryByText(/Festival Teste/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Verão' }),
    ).not.toBeInTheDocument();
  });

  it('should filter by name ignoring case and accents', async () => {
    await renderList();
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Buscar evento' }),
      'TESTE ACAI',
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent('Têste Açaí');
  });

  it('should say when nothing matches', async () => {
    await renderList();
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Buscar evento' }),
      'zzz',
    );
    expect(screen.getByText('Nenhum evento encontrado.')).toBeInTheDocument();
  });

  it('should show the villager portrait when the birthday has an icon', async () => {
    renderWithRouter(
      <EventList
        events={buildEvents({
          festivals: [],
          villagers: [{ ...TEST_VILLAGER, id: 'abigail' }],
          foraging: [],
          plantables: [],
        })}
      />,
    );
    const link = await screen.findByRole('link', { name: /Aldeão Teste/ });
    expect(link.querySelector('img')).toHaveAttribute(
      'src',
      iconUrl('abigail'),
    );
  });

  it('should keep the kind icon when the event has no game icon', async () => {
    await renderList();
    const link = screen.getAllByRole('link', { name: /Aldeão Teste/ })[0];
    expect(link.querySelector('img')).toBeNull();
    expect(link.querySelector('svg')).toBeInTheDocument();
  });
});
