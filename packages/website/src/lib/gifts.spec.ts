import type { RelationOut } from '../generated/stardew-valley-api/types.gen';
import { emptyTastes, giftTastes, isEmptyTastes } from './gifts';

const taste = (sk: string, except?: string[]): RelationOut => ({
  kind: 'GiftTaste',
  pk: 'VILLAGER#test-villager',
  sk,
  attributes: except ? { tier: 'x', except } : { tier: 'x' },
});

describe('giftTastes', () => {
  it('should read item and category tastes of every tier', () => {
    const tastes = giftTastes([
      taste('GIFT#loves#ITEM#test-amethyst'),
      taste('GIFT#likes#CATEGORY#test-flowers', ['test-poppy']),
      taste('GIFT#neutral#ITEM#test-bread'),
      taste('GIFT#dislikesOrHates#ITEM#test-clay'),
    ]);
    expect(tastes).toEqual({
      loves: [{ kind: 'item', id: 'test-amethyst', except: [] }],
      likes: [{ kind: 'category', id: 'test-flowers', except: ['test-poppy'] }],
      neutral: [{ kind: 'item', id: 'test-bread', except: [] }],
      dislikesOrHates: [{ kind: 'item', id: 'test-clay', except: [] }],
    });
  });

  it('should ignore other relations and keep empty tiers', () => {
    const tastes = giftTastes([
      { kind: 'MovieTaste', pk: 'VILLAGER#test-villager', sk: 'MOVIE#loves#x' },
      taste('GIFT#unknown#ITEM#test-x'),
    ]);
    expect(tastes).toEqual(emptyTastes());
    expect(isEmptyTastes(tastes)).toBe(true);
  });
});

describe('isEmptyTastes', () => {
  it('should look only at the given tiers', () => {
    const tastes = giftTastes([taste('GIFT#likes#ITEM#test-quartz')]);
    expect(isEmptyTastes(tastes)).toBe(false);
    expect(isEmptyTastes(tastes, ['loves'])).toBe(true);
  });
});
