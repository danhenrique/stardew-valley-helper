import { screen } from '@testing-library/react';
import type { ScheduleOut } from '../generated/stardew-valley-api/types.gen';
import { renderWithIntl } from './renderWithIntl';
import { SchedulePreview } from './SchedulePreview';

const BASE: ScheduleOut = {
  firstHarvest: { year: 1, season: 'spring', day: 9 },
  harvests: [
    { year: 1, season: 'spring', day: 9 },
    { year: 1, season: 'spring', day: 13 },
  ],
  totalHarvests: 2,
  infinite: false,
  diesOn: { year: 1, season: 'summer', day: 1 },
  status: 'growing',
  daysUntilNext: 8,
  approximate: false,
  warnings: [],
  yieldPerHarvest: 20.4,
  expectedTotalYield: 40.8,
};

describe('SchedulePreview', () => {
  it('should show first harvest, count and death date when schedule is finite', () => {
    renderWithIntl(<SchedulePreview schedule={{ ...BASE, warnings: [] }} />);
    expect(screen.getByText('Primavera 9, Ano 1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Verão 1, Ano 1')).toBeInTheDocument();
  });

  it('should show yield per harvest and total when schedule is finite', () => {
    renderWithIntl(<SchedulePreview schedule={{ ...BASE, warnings: [] }} />);
    expect(
      screen.getByText('≈ 40,8 no total (20,4 por colheita)'),
    ).toBeInTheDocument();
  });

  it('should show only yield per harvest when schedule is infinite', () => {
    renderWithIntl(
      <SchedulePreview
        schedule={{
          ...BASE,
          infinite: true,
          diesOn: null,
          expectedTotalYield: null,
          warnings: [],
        }}
      />,
    );
    expect(screen.getByText('≈ 20,4 por colheita')).toBeInTheDocument();
  });

  it('should show the will not mature warning when the API returns it', () => {
    renderWithIntl(
      <SchedulePreview
        schedule={{
          ...BASE,
          harvests: [],
          firstHarvest: null,
          warnings: ['will_not_mature'],
        }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não amadurece antes do fim da estação.',
    );
  });

  it('should say harvests keep going when schedule is infinite', () => {
    renderWithIntl(
      <SchedulePreview
        schedule={{ ...BASE, infinite: true, diesOn: null, warnings: [] }}
      />,
    );
    expect(screen.getByText('Contínuas (próximas 10)')).toBeInTheDocument();
  });

  it('should show a hint when there is no schedule yet', () => {
    renderWithIntl(<SchedulePreview schedule={null} />);
    expect(
      screen.getByText('Escolha uma semente para ver a previsão.'),
    ).toBeInTheDocument();
  });
});

describe('SchedulePreview in English', () => {
  it('should show the forecast terms in English', () => {
    renderWithIntl(<SchedulePreview schedule={BASE} />, { locale: 'en' });
    expect(screen.getByText('Forecast')).toBeInTheDocument();
    expect(screen.getByText('First harvest')).toBeInTheDocument();
    expect(screen.getByText('Spring 9, Year 1')).toBeInTheDocument();
    expect(screen.getByText('Regrows every')).toBeInTheDocument();
    expect(screen.getByText('4 days')).toBeInTheDocument();
    expect(screen.getByText('Dies on')).toBeInTheDocument();
    expect(screen.getByText('Summer 1, Year 1')).toBeInTheDocument();
  });

  it('should show the continuous harvests, no regrowth and the empty prompt in English', () => {
    const { rerender } = renderWithIntl(
      <SchedulePreview
        schedule={{
          ...BASE,
          infinite: true,
          diesOn: null,
          harvests: [BASE.harvests[0]],
        }}
      />,
      { locale: 'en' },
    );
    expect(screen.getByText('Continuous (next 10)')).toBeInTheDocument();
    expect(screen.getByText('Does not regrow')).toBeInTheDocument();
    expect(
      screen.getByText('Does not die when the season changes'),
    ).toBeInTheDocument();
    rerender(<SchedulePreview schedule={null} />);
    expect(
      screen.getByText('Choose a seed to see the forecast.'),
    ).toBeInTheDocument();
  });
});
