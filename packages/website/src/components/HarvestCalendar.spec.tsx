import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { iconUrl } from '../lib/icons';
import { HarvestCalendar } from './HarvestCalendar';
import { renderWithIntl } from './renderWithIntl';
import { BERRY_PLANTING, INVALID_PLANTING, NAMES } from './testData';

const dayCell = (day: number) => screen.getByTestId(`calendar-day-${day}`);

describe('HarvestCalendar', () => {
  it('should mark every harvest day of the shown season', () => {
    renderWithIntl(
      <HarvestCalendar
        plantings={[BERRY_PLANTING]}
        names={NAMES}
        today={{ year: 1, season: 'spring', day: 1 }}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Primavera, Ano 1' }),
    ).toBeInTheDocument();
    for (const day of [9, 13, 17, 21, 25]) {
      expect(
        within(dayCell(day)).getByText('Sementes de Fruta'),
      ).toBeInTheDocument();
    }
    expect(
      within(dayCell(10)).queryByText('Sementes de Fruta'),
    ).not.toBeInTheDocument();
  });

  it('should show 28 days in 4 weeks', () => {
    renderWithIntl(
      <HarvestCalendar
        plantings={[]}
        names={NAMES}
        today={{ year: 1, season: 'spring', day: 1 }}
      />,
    );
    expect(screen.getAllByTestId(/calendar-day-/)).toHaveLength(28);
  });

  it('should highlight today', () => {
    renderWithIntl(
      <HarvestCalendar
        plantings={[]}
        names={NAMES}
        today={{ year: 1, season: 'spring', day: 5 }}
      />,
    );
    expect(dayCell(5)).toHaveAttribute('data-is-today');
  });

  it('should navigate seasons with the icon buttons', async () => {
    renderWithIntl(
      <HarvestCalendar
        plantings={[BERRY_PLANTING]}
        names={NAMES}
        today={{ year: 1, season: 'spring', day: 1 }}
      />,
    );
    const next = screen.getByRole('button', { name: 'Próxima estação' });
    expect(next).toHaveAttribute('title', 'Próxima estação');
    await userEvent.click(next);
    expect(
      screen.getByRole('heading', { name: 'Verão, Ano 1' }),
    ).toBeInTheDocument();
    expect(
      within(dayCell(9)).queryByText('Sementes de Fruta'),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Estação anterior' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Primavera, Ano 1' }),
    ).toBeInTheDocument();
  });

  it('should leave invalid plantings off the calendar', () => {
    renderWithIntl(
      <HarvestCalendar
        plantings={[INVALID_PLANTING, BERRY_PLANTING]}
        names={NAMES}
        today={{ year: 1, season: 'spring', day: 1 }}
      />,
    );
    expect(screen.queryByText('Canteiro sumido')).not.toBeInTheDocument();
    expect(
      within(dayCell(9)).getByText('Sementes de Fruta'),
    ).toBeInTheDocument();
  });

  it('should show the small seed sprite on a harvest day when the seed has one', () => {
    renderWithIntl(
      <HarvestCalendar
        plantings={[{ ...BERRY_PLANTING, seedId: 'parsnip-seeds' }]}
        names={NAMES}
        today={{ year: 1, season: 'spring', day: 1 }}
      />,
    );
    const img = dayCell(9).querySelector('img');
    expect(img).toHaveAttribute('src', iconUrl('parsnip-seeds'));
    expect(img).toHaveClass('size-4');
  });
});

describe('HarvestCalendar in English', () => {
  it('should show the season title, weekdays and navigation in English', () => {
    renderWithIntl(
      <HarvestCalendar
        plantings={[BERRY_PLANTING]}
        names={NAMES}
        today={{ year: 1, season: 'spring', day: 1 }}
      />,
      { locale: 'en' },
    );
    expect(
      screen.getByRole('heading', { name: 'Spring, Year 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Next season' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Previous season' }),
    ).toBeInTheDocument();
    expect(screen.getByText('on', { selector: 'span' })).toBeInTheDocument();
  });
});
