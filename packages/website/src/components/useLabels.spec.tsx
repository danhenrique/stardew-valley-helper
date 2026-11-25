import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Locale } from '../lib/locale';
import { message } from '../lib/message';
import { IntlTestProvider } from './renderWithIntl';
import { useLabels } from './useLabels';

const labelsIn = (locale: Locale) =>
  renderHook(() => useLabels(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <IntlTestProvider locale={locale}>{children}</IntlTestProvider>
    ),
  }).result.current;

describe('useLabels', () => {
  it('should label every season, weekday, location and quality in Portuguese', () => {
    const labels = labelsIn('pt-BR');
    expect(
      (['spring', 'summer', 'fall', 'winter'] as const).map(labels.season),
    ).toEqual(['Primavera', 'Verão', 'Outono', 'Inverno']);
    expect(
      (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map(
        labels.weekday,
      ),
    ).toEqual(['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']);
    expect(labels.weekdayPlural('mon')).toBe('segundas');
    expect(labels.weekdayPlural('sat')).toBe('sábados');
    expect(
      (['farm', 'greenhouse', 'ginger-island'] as const).map(labels.location),
    ).toEqual(['Fazenda', 'Estufa', 'Ilha Gengibre']);
    expect(
      (['normal', 'silver', 'gold', 'iridium'] as const).map(labels.quality),
    ).toEqual(['Normal', 'Prata', 'Ouro', 'Irídio']);
  });

  it('should use the game English terms in English', () => {
    const labels = labelsIn('en');
    expect(labels.season('fall')).toBe('Fall');
    expect(
      (['spring', 'summer', 'fall', 'winter'] as const).map(labels.season),
    ).toEqual(['Spring', 'Summer', 'Fall', 'Winter']);
    expect(labels.quality('iridium')).toBe('Iridium');
    expect(
      (['normal', 'silver', 'gold', 'iridium'] as const).map(labels.quality),
    ).toEqual(['Normal', 'Silver', 'Gold', 'Iridium']);
    expect(labels.location('greenhouse')).toBe('Greenhouse');
    expect(labels.location('ginger-island')).toBe('Ginger Island');
    expect(labels.fertilizerSpeed('deluxe-speed-gro')).toBe('−25%');
  });

  it('should label planting and machine statuses', () => {
    const pt = labelsIn('pt-BR');
    expect(
      (['growing', 'ready', 'regrowing', 'finished', 'dead'] as const).map(
        pt.plantingStatus,
      ),
    ).toEqual(['Crescendo', 'Pronta', 'Rebrotando', 'Finalizada', 'Morta']);
    expect(
      (['processing', 'ready', 'aging', 'iridium'] as const).map(
        pt.machineStatus,
      ),
    ).toEqual(['Processando', 'Pronto', 'Envelhecendo', 'Irídio']);
    const en = labelsIn('en');
    expect(en.plantingStatus('regrowing')).toBe('Regrowing');
    expect(en.machineStatus('aging')).toBe('Aging');
  });

  it('should label fertilizer speeds, the empty fertilizer and warnings', () => {
    const pt = labelsIn('pt-BR');
    expect(pt.noFertilizer).toBe('Nenhum');
    expect(pt.fertilizerSpeed('none')).toBe('Sem bônus');
    expect(pt.fertilizerSpeed('hyper-speed-gro')).toBe('−33%');
    expect(pt.warning('will_not_mature')).toBe(
      'Não amadurece antes do fim da estação.',
    );
    expect(pt.warning('approximate')).toBe(
      'Cálculo aproximado para esta semente.',
    );
    expect(pt.warning('something_new')).toBe('something_new');
    const en = labelsIn('en');
    expect(en.noFertilizer).toBe('None');
    expect(en.fertilizerSpeed('none')).toBe('No bonus');
    expect(en.warning('approximate')).toBe(
      'Approximate calculation for this seed.',
    );
  });

  it('should label event kinds, marker kinds and gift tiers', () => {
    const pt = labelsIn('pt-BR');
    expect(
      (['festival', 'birthday', 'cropDeadline', 'foraging'] as const).map(
        pt.eventKind,
      ),
    ).toEqual(['Festival', 'Aniversário', 'Prazo de plantio', 'Coleta']);
    expect(pt.machineMarker('caskMilestone')).toBe('Barril de Madeira');
    expect(pt.giftTier('dislikesOrHates')).toBe('Não gosta ou odeia');
    const en = labelsIn('en');
    expect(en.eventKind('cropDeadline')).toBe('Crop deadline');
    expect(en.machineMarker('caskMilestone')).toBe('Cask');
    expect(en.giftTier('loves')).toBe('Loves');
  });

  it('should format game dates and event days in the active locale', () => {
    const pt = labelsIn('pt-BR');
    expect(pt.gameDate({ year: 1, season: 'spring', day: 9 })).toBe(
      'Primavera 9, Ano 1',
    );
    expect(pt.eventDays({ season: 'spring', day: 9 })).toBe('Primavera 9');
    expect(pt.eventDays({ season: 'spring', day: 9, endDay: 10 })).toBe(
      'Primavera 9–10',
    );
    const en = labelsIn('en');
    expect(en.gameDate({ year: 2, season: 'fall', day: 16 })).toBe(
      'Fall 16, Year 2',
    );
  });

  it('should format the expected yield with the locale separators', () => {
    expect(labelsIn('pt-BR').expectedYield(20.4, 40.8)).toBe(
      '≈ 40,8 no total (20,4 por colheita)',
    );
    expect(labelsIn('pt-BR').expectedYield(20.4, null)).toBe(
      '≈ 20,4 por colheita',
    );
    expect(labelsIn('en').expectedYield(20.4, 40.8)).toBe(
      '≈ 40.8 total (20.4 per harvest)',
    );
  });

  it('should translate message references, including nested ones and lists', () => {
    const pt = labelsIn('pt-BR');
    expect(pt.text('Plain text')).toBe('Plain text');
    expect(
      pt.text(
        message('labels.gameDate', {
          season: message('labels.season.winter'),
          day: 3,
          year: 2,
        }),
      ),
    ).toBe('Inverno 3, Ano 2');
    expect(
      pt.text(
        message('labels.plantable.crop', {
          seasons: [
            message('labels.season.spring'),
            message('labels.season.summer'),
          ],
          days: 8,
        }),
      ),
    ).toBe('Primavera, Verão · 8 dias');
  });
});
