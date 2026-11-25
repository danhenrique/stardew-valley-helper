import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildEvents } from '../lib/events';
import { iconUrl } from '../lib/icons';
import { EventCalendar } from './EventCalendar';
import { renderWithRouter } from './renderWithRouter';
import {
  BERRY_PLANTING,
  INVALID_MACHINE,
  INVALID_PLANTING,
  MACHINE_SCHEDULE,
  MACHINES,
  machineBatch,
  NAMES,
  TEST_DEADLINE_PLANTABLE,
  TEST_FESTIVAL,
  TEST_FORAGING,
  TEST_VILLAGER,
} from './testData';

const EVENTS = buildEvents({
  festivals: [TEST_FESTIVAL],
  villagers: [TEST_VILLAGER],
  foraging: [TEST_FORAGING],
  plantables: [TEST_DEADLINE_PLANTABLE],
});
const TODAY = { year: 1, season: 'spring', day: 1 } as const;
const dayCell = (day: number) => screen.getByTestId(`calendar-day-${day}`);
const KEG = machineBatch({
  schedule: {
    ...MACHINE_SCHEDULE,
    readyOn: { year: 1, season: 'spring', day: 3 },
  },
});
const CASK = machineBatch({
  id: 'm-cask',
  machineId: 'cask',
  outputId: 'test-aged',
  startQuality: 'normal',
  label: 'Adega',
  schedule: {
    ...MACHINE_SCHEDULE,
    readyOn: null,
    milestones: [
      { quality: 'silver', on: { year: 1, season: 'spring', day: 15 } },
      { quality: 'gold', on: { year: 1, season: 'spring', day: 28 } },
    ],
    status: 'aging',
    daysUntilNext: 14,
  },
});

const renderCalendar = async (
  events = EVENTS,
  plantings = [BERRY_PLANTING],
) => {
  renderWithRouter(
    <EventCalendar
      events={events}
      plantings={plantings}
      names={NAMES}
      today={TODAY}
      machines={[KEG, CASK]}
      machineCatalog={MACHINES}
    />,
  );
  await screen.findByRole('heading', { name: 'Primavera, Ano 1' });
};

describe('EventCalendar', () => {
  it('should show the season title and markers on their days', async () => {
    await renderCalendar();
    expect(
      screen.getByRole('heading', { name: 'Primavera, Ano 1' }),
    ).toBeInTheDocument();
    expect(within(dayCell(13)).getByText('Festival Teste')).toBeInTheDocument();
    expect(within(dayCell(14)).getByText('Festival Teste')).toBeInTheDocument();
    expect(within(dayCell(5)).getByText('Aldeão Teste')).toBeInTheDocument();
    expect(within(dayCell(20)).getByText('Coleta Teste')).toBeInTheDocument();
    expect(within(dayCell(20)).getByText('Sementes Prazo')).toBeInTheDocument();
  });

  it('should show the player harvests on their day', async () => {
    await renderCalendar();
    expect(
      within(dayCell(9)).getByText('Sementes de Fruta'),
    ).toBeInTheDocument();
  });

  it('should change season with the icon buttons', async () => {
    await renderCalendar();
    await userEvent.click(
      screen.getByRole('button', { name: 'Próxima estação' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Verão, Ano 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Nenhum evento nesta estação.'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Estação anterior' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Primavera, Ano 1' }),
    ).toBeInTheDocument();
  });

  it('should hide a kind when its filter is unchecked', async () => {
    await renderCalendar();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Festival' }));
    expect(
      within(dayCell(13)).queryByText('Festival Teste'),
    ).not.toBeInTheDocument();
    expect(within(dayCell(5)).getByText('Aldeão Teste')).toBeInTheDocument();
  });

  it('should list the events of the selected day with a link to each', async () => {
    await renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'Dia 20' }));
    const panel = screen.getByRole('region', { name: 'Eventos do dia 20' });
    expect(
      within(panel).getByRole('link', { name: /Coleta Teste/ }),
    ).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/events\/foraging(:|%3A)test-foraging$/),
    );
    expect(
      within(panel).getByRole('link', { name: /Sementes Prazo/ }),
    ).toHaveAttribute(
      'href',
      expect.stringMatching(
        /^\/events\/cropDeadline(:|%3A)test-deadline-seeds(:|%3A)spring$/,
      ),
    );
  });

  it('should list the harvests of the selected day instead of saying there are no events', async () => {
    await renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'Dia 9' }));
    const panel = screen.getByRole('region', { name: 'Eventos do dia 9' });
    expect(within(panel).getByText('Sementes de Fruta')).toBeInTheDocument();
    expect(
      within(panel).queryByText('Nenhum evento neste dia.'),
    ).not.toBeInTheDocument();
  });

  it('should say there are no events only when the day has neither events nor harvests', async () => {
    await renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'Dia 2' }));
    expect(screen.getByText('Nenhum evento neste dia.')).toBeInTheDocument();
  });

  it.each([
    ['Festival', 13, 'Festival Teste'],
    ['Aniversário', 5, 'Aldeão Teste'],
    ['Coleta', 20, 'Coleta Teste'],
    ['Prazo de plantio', 20, 'Sementes Prazo'],
  ])(
    'should mark %s events with an icon and a screen reader kind',
    async (kindLabel, day, name) => {
      await renderCalendar();
      const marker = within(dayCell(day)).getByText(name).closest('li');
      expect(marker?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(marker).toHaveTextContent(`${kindLabel}: ${name}`);
      expect(
        within(marker as HTMLElement).getByText(`${kindLabel}:`),
      ).toHaveClass('sr-only');
    },
  );

  it('should tell screen readers that a marker is a harvest', async () => {
    await renderCalendar();
    const marker = within(dayCell(9))
      .getByText('Sementes de Fruta')
      .closest('li');
    expect(marker).toHaveTextContent('Colheita: Sementes de Fruta');
  });

  it('should show the kind icon and colour next to each filter', async () => {
    await renderCalendar();
    const label = screen.getByText('Festival', { selector: 'label' });
    expect(label.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Festival' })).toBeChecked();
  });

  it('should mark a cask silver milestone as Barril de Madeira', async () => {
    await renderCalendar();
    const marker = within(dayCell(15)).getByText('Adega · Prata').closest('li');
    expect(marker?.querySelector('img')).toHaveAttribute(
      'src',
      iconUrl('cask'),
    );
    expect(marker).toHaveTextContent('Barril de Madeira: Adega · Prata');
    expect(
      within(marker as HTMLElement).getByText('Barril de Madeira:'),
    ).toHaveClass('sr-only');
  });

  it('should mark a machine ready day with the machine kind', async () => {
    await renderCalendar();
    const marker = within(dayCell(3))
      .getByText('Vinho Teste · Pronto')
      .closest('li');
    expect(marker?.querySelector('img')).toHaveAttribute('src', iconUrl('keg'));
    expect(marker).toHaveTextContent('Máquina: Vinho Teste · Pronto');
  });

  it('should list the machine dates of the selected day', async () => {
    await renderCalendar();
    await userEvent.click(screen.getByRole('button', { name: 'Dia 3' }));
    const panel = screen.getByRole('region', { name: 'Eventos do dia 3' });
    expect(within(panel).getByText('Vinho Teste · Pronto')).toBeInTheDocument();
    expect(within(panel).getByText('Máquina')).toBeInTheDocument();
    expect(
      within(panel).queryByText('Nenhum evento neste dia.'),
    ).not.toBeInTheDocument();
  });

  it('should leave invalid plantings and machines off the calendar', async () => {
    renderWithRouter(
      <EventCalendar
        events={EVENTS}
        plantings={[INVALID_PLANTING, BERRY_PLANTING]}
        names={NAMES}
        today={TODAY}
        machines={[INVALID_MACHINE, KEG]}
        machineCatalog={MACHINES}
      />,
    );
    await screen.findByRole('heading', { name: 'Primavera, Ano 1' });
    expect(screen.queryByText(/Canteiro sumido/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Barril sumido/)).not.toBeInTheDocument();
    expect(
      within(dayCell(9)).getByText('Sementes de Fruta'),
    ).toBeInTheDocument();
    expect(within(dayCell(3)).getByText(/Vinho Teste/)).toBeInTheDocument();
  });

  it('should show the small villager portrait in the day cell when it has an icon', async () => {
    await renderCalendar(
      buildEvents({
        festivals: [],
        villagers: [{ ...TEST_VILLAGER, id: 'abigail' }],
        foraging: [],
        plantables: [],
      }),
    );
    const img = dayCell(5).querySelector('img');
    expect(img).toHaveAttribute('src', iconUrl('abigail'));
    expect(img).toHaveClass('size-4');
  });

  it('should show the small seed sprite on a harvest marker when the seed has one', async () => {
    await renderCalendar(EVENTS, [
      { ...BERRY_PLANTING, seedId: 'parsnip-seeds' },
    ]);
    expect(dayCell(9).querySelector('img')).toHaveAttribute(
      'src',
      iconUrl('parsnip-seeds'),
    );
  });

  it('should show every marker of a busy day', async () => {
    const villagers = ['Um', 'Dois', 'Três', 'Quatro', 'Cinco'].map((name) => ({
      ...TEST_VILLAGER,
      id: `test-villager-${name}`,
      name: { en: name, ptBr: name },
    }));
    await renderCalendar(
      buildEvents({ festivals: [], villagers, foraging: [], plantables: [] }),
    );
    for (const name of ['Um', 'Dois', 'Três', 'Quatro', 'Cinco']) {
      expect(within(dayCell(5)).getByText(name)).toBeInTheDocument();
    }
    expect(within(dayCell(5)).queryByText(/^\+/)).not.toBeInTheDocument();
  });

  describe('in English', () => {
    it('should show English headers, filters, day panel and marker kinds', async () => {
      renderWithRouter(
        <EventCalendar
          events={EVENTS}
          plantings={[BERRY_PLANTING]}
          names={NAMES}
          today={TODAY}
        />,
        { locale: 'en' },
      );
      await screen.findByRole('heading', { name: 'Spring, Year 1' });
      // Each header is split into its first letter and the rest.
      expect(screen.getByText('ue')).toBeInTheDocument();
      expect(screen.getByText('un')).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: 'Birthday' }),
      ).toBeInTheDocument();
      expect(
        within(dayCell(13)).getByText('Test Festival'),
      ).toBeInTheDocument();
      expect(
        within(dayCell(13)).getByText('Festival:', { exact: false }),
      ).toHaveClass('sr-only');
      await userEvent.click(screen.getByRole('button', { name: 'Day 2' }));
      expect(
        screen.getByRole('region', { name: 'Events on day 2' }),
      ).toBeInTheDocument();
      expect(screen.getByText('No events on this day.')).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'Next season' }),
      );
      expect(screen.getByText('No events this season.')).toBeInTheDocument();
    });
  });
});
