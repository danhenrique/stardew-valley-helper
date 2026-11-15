import {
  FERTILIZER_SPEED_LABELS,
  formatGameDate,
  humanizeId,
  LOCATION_LABELS,
  localizedName,
  NO_FERTILIZER_LABEL,
  SEASON_LABELS,
  STATUS_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
} from './i18n';

describe('i18n', () => {
  it('should use pt-BR name when it exists', () => {
    expect(localizedName({ en: 'Strawberry', ptBr: 'Morango' })).toBe(
      'Morango',
    );
  });

  it('should fall back to English when pt-BR is null', () => {
    expect(localizedName({ en: 'Strawberry', ptBr: null })).toBe('Strawberry');
  });

  it('should return empty text when name is missing', () => {
    expect(localizedName(null)).toBe('');
  });

  it('should format a game date in Portuguese when given season, day and year', () => {
    expect(formatGameDate({ year: 1, season: 'spring', day: 9 })).toBe(
      'Primavera 9, Ano 1',
    );
  });

  it('should label every season, fertilizer, location and status in Portuguese', () => {
    expect(SEASON_LABELS).toEqual({
      spring: 'Primavera',
      summer: 'Verão',
      fall: 'Outono',
      winter: 'Inverno',
    });
    expect(NO_FERTILIZER_LABEL).toBe('Nenhum');
    expect(FERTILIZER_SPEED_LABELS['hyper-speed-gro']).toBe('−33%');
    expect(LOCATION_LABELS).toEqual({
      farm: 'Fazenda',
      greenhouse: 'Estufa',
      'ginger-island': 'Ilha Gengibre',
    });
    expect(STATUS_LABELS).toEqual({
      growing: 'Crescendo',
      ready: 'Pronta',
      regrowing: 'Rebrotando',
      finished: 'Finalizada',
      dead: 'Morta',
    });
  });
});

describe('humanizeId', () => {
  it('should turn a kebab-case id into capitalized words', () => {
    expect(humanizeId('golden-pumpkin')).toBe('Golden Pumpkin');
  });

  it('should label every weekday in pt-BR', () => {
    expect(Object.values(WEEKDAY_LABELS)).toEqual([
      'seg',
      'ter',
      'qua',
      'qui',
      'sex',
      'sáb',
      'dom',
    ]);
    expect(WEEKDAY_NAMES.mon).toBe('segundas');
    expect(WEEKDAY_NAMES.sat).toBe('sábados');
    expect(Object.keys(WEEKDAY_NAMES)).toEqual(Object.keys(WEEKDAY_LABELS));
  });
});
