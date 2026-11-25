import type { GameDateIn } from '../generated/stardew-valley-api/types.gen';
import {
  clampDay,
  clampYear,
  DAYS,
  MAX_YEAR,
  nextDates,
  sameDate,
  shiftDay,
  shiftSeason,
  weekdayOf,
} from './gameDate';

describe('gameDate', () => {
  it('should offer days 1 to 28 when building day options', () => {
    expect(DAYS[0]).toBe(1);
    expect(DAYS.at(-1)).toBe(28);
    expect(DAYS).toHaveLength(28);
  });

  it('should move to next year when shifting forward from winter', () => {
    expect(shiftSeason({ year: 1, season: 'winter' }, 1)).toEqual({
      year: 2,
      season: 'spring',
    });
  });

  it('should move to previous year when shifting back from spring', () => {
    expect(shiftSeason({ year: 2, season: 'spring' }, -1)).toEqual({
      year: 1,
      season: 'winter',
    });
  });

  it('should not go before year 1 when shifting back from the first season', () => {
    expect(shiftSeason({ year: 1, season: 'spring' }, -1)).toEqual({
      year: 1,
      season: 'spring',
    });
  });

  it('should compare dates by value when checking equality', () => {
    expect(
      sameDate(
        { year: 1, season: 'fall', day: 3 },
        { year: 1, season: 'fall', day: 3 },
      ),
    ).toBe(true);
    expect(
      sameDate(
        { year: 1, season: 'fall', day: 3 },
        { year: 2, season: 'fall', day: 3 },
      ),
    ).toBe(false);
  });

  it('should roll over to next season when shifting forward from day 28', () => {
    expect(shiftDay({ year: 1, season: 'spring', day: 28 }, 1)).toEqual({
      year: 1,
      season: 'summer',
      day: 1,
    });
  });

  it('should roll over to next year when shifting forward from winter 28', () => {
    expect(shiftDay({ year: 1, season: 'winter', day: 28 }, 1)).toEqual({
      year: 2,
      season: 'spring',
      day: 1,
    });
  });

  it('should roll back to previous year when shifting back from spring 1', () => {
    expect(shiftDay({ year: 2, season: 'spring', day: 1 }, -1)).toEqual({
      year: 1,
      season: 'winter',
      day: 28,
    });
  });

  it('should keep the date when shifting back from year 1 spring 1', () => {
    const date = { year: 1, season: 'spring' as const, day: 1 };
    expect(shiftDay(date, -1)).toEqual(date);
  });

  it('should clamp day and year into their valid ranges', () => {
    expect(clampDay(0)).toBe(1);
    expect(clampDay(40)).toBe(28);
    expect(clampYear(0)).toBe(1);
    expect(clampYear(1000)).toBe(999);
  });

  it('should keep the date when shifting forward from the last day of the last year', () => {
    const date = { year: MAX_YEAR, season: 'winter' as const, day: 28 };
    expect(shiftDay(date, 1)).toEqual(date);
  });

  it('should map days to weekdays starting on Monday', () => {
    expect([1, 3, 7, 8, 21, 28].map(weekdayOf)).toEqual([
      'mon',
      'wed',
      'sun',
      'mon',
      'sun',
      'sun',
    ]);
  });
});

describe('nextDates', () => {
  const at = (season: GameDateIn['season'], day: number, year = 1) => ({
    year,
    season,
    day,
  });

  it('should list consecutive days when the window stays in the season', () => {
    expect(nextDates(at('spring', 1), 7)).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((d) => at('spring', d)),
    );
  });

  it('should continue in the next season when the window crosses day 28', () => {
    expect(nextDates(at('summer', 26), 7)).toEqual([
      at('summer', 26),
      at('summer', 27),
      at('summer', 28),
      at('fall', 1),
      at('fall', 2),
      at('fall', 3),
      at('fall', 4),
    ]);
  });

  it('should move to spring of the next year when the window crosses winter 28', () => {
    expect(nextDates(at('winter', 25, 1), 7)).toEqual([
      at('winter', 25, 1),
      at('winter', 26, 1),
      at('winter', 27, 1),
      at('winter', 28, 1),
      at('spring', 1, 2),
      at('spring', 2, 2),
      at('spring', 3, 2),
    ]);
  });
});
