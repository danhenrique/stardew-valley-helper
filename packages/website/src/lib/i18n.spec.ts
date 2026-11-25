import {
  eventDaysMessage,
  expectedYieldMessage,
  formatAmount,
  gameDateMessage,
  humanizeId,
  localizedName,
  locationMessage,
  qualityMessage,
  seasonMessage,
} from './i18n';
import { textOf } from './messageText.spec-helpers';

describe('i18n', () => {
  it('should use pt-BR name when it exists', () => {
    expect(localizedName({ en: 'Strawberry', ptBr: 'Morango' }, 'pt-BR')).toBe(
      'Morango',
    );
  });

  it('should fall back to English when pt-BR is null', () => {
    expect(localizedName({ en: 'Strawberry', ptBr: null }, 'pt-BR')).toBe(
      'Strawberry',
    );
  });

  it('should return empty text when name is missing', () => {
    expect(localizedName(null, 'pt-BR')).toBe('');
  });

  it('should reference the game date message with nested season when given season, day and year', () => {
    expect(gameDateMessage({ year: 1, season: 'spring', day: 9 })).toEqual({
      key: 'labels.gameDate',
      values: { season: { key: 'labels.season.spring' }, day: 9, year: 1 },
    });
    expect(textOf(gameDateMessage({ year: 1, season: 'spring', day: 9 }))).toBe(
      'Primavera 9, Ano 1',
    );
  });

  it('should reference season, location and quality labels by key', () => {
    expect(seasonMessage('fall')).toEqual({ key: 'labels.season.fall' });
    expect(locationMessage('ginger-island')).toEqual({
      key: 'labels.location.ginger-island',
    });
    expect(qualityMessage('iridium')).toEqual({
      key: 'labels.quality.iridium',
    });
  });

  it('should reference event days with an end day only for multi-day events', () => {
    expect(eventDaysMessage({ season: 'spring', day: 9 }).key).toBe(
      'labels.eventDay',
    );
    expect(
      textOf(eventDaysMessage({ season: 'spring', day: 9, endDay: 10 })),
    ).toBe('Primavera 9–10');
  });
});

describe('humanizeId', () => {
  it('should turn a kebab-case id into capitalized words', () => {
    expect(humanizeId('golden-pumpkin')).toBe('Golden Pumpkin');
  });
});

describe('i18n in the active locale', () => {
  it('should pick the name of the locale, falling back to English', () => {
    expect(localizedName({ en: 'Strawberry', ptBr: 'Morango' }, 'en')).toBe(
      'Strawberry',
    );
    expect(localizedName({ en: 'Strawberry', ptBr: '' }, 'pt-BR')).toBe(
      'Strawberry',
    );
    expect(localizedName(null, 'en')).toBe('');
  });

  it('should format amounts with the locale separators', () => {
    expect(formatAmount(1234.5, 'pt-BR')).toBe('1.234,5');
    expect(formatAmount(1234.5, 'en')).toBe('1,234.5');
    expect(textOf(expectedYieldMessage(20.4, 40.8, 'en'), 'en')).toContain(
      '40.8',
    );
    expect(textOf(expectedYieldMessage(20.4, null, 'pt-BR'))).toBe(
      '≈ 20,4 por colheita',
    );
  });
});
