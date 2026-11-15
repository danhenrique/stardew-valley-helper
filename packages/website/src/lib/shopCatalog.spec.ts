import type {
  GameDateIn,
  RelationOut,
} from '../generated/stardew-valley-api/types.gen';
import {
  buildOffers,
  formatCost,
  hasRotatingStock,
  offerCosts,
  offersOn,
  offerTags,
  type ShopOffer,
} from './shopCatalog';

const date = (
  day: number,
  season: GameDateIn['season'] = 'spring',
  year = 1,
) => ({
  year,
  season,
  day,
});
const offer = (fields: Partial<ShopOffer> = {}): ShopOffer => ({
  itemId: 'test-item',
  ...fields,
});
const kept = (o: ShopOffer, d: GameDateIn) => offersOn([o], d).length === 1;

describe('offersOn', () => {
  it('should keep an offer without rules on any date', () => {
    expect(kept(offer(), date(9, 'winter', 4))).toBe(true);
  });

  it('should keep a seasonal offer only in its season', () => {
    expect(kept(offer({ season: 'fall' }), date(3, 'fall'))).toBe(true);
    expect(kept(offer({ season: 'fall' }), date(3, 'spring'))).toBe(false);
  });

  it('should keep a weekday offer only on that weekday (day 1 is Monday)', () => {
    expect(kept(offer({ availability: 'tue' }), date(2))).toBe(true);
    expect(kept(offer({ availability: 'tue' }), date(3))).toBe(false);
  });

  it('should keep even and odd day offers on matching days', () => {
    expect(kept(offer({ availability: 'evenDays' }), date(4))).toBe(true);
    expect(kept(offer({ availability: 'evenDays' }), date(5))).toBe(false);
    expect(kept(offer({ availability: 'oddDays' }), date(5))).toBe(true);
    expect(kept(offer({ availability: 'oddDays' }), date(4))).toBe(false);
  });

  it('should hide offers that start in a later year', () => {
    expect(kept(offer({ fromYear: 2 }), date(1, 'spring', 1))).toBe(false);
    expect(kept(offer({ fromYear: 2 }), date(1, 'spring', 2))).toBe(true);
    expect(kept(offer({ fromYear: 2 }), date(1, 'spring', 3))).toBe(true);
  });
});

describe('offerCosts', () => {
  const byYear = offer({ priceByYear: { year1: 75, year2plus: 150 } });

  it('should use the year 1 price in year 1 and the later price afterwards', () => {
    expect(offerCosts(byYear, 1)).toEqual([{ amount: 75, unit: 'gold' }]);
    expect(offerCosts(byYear, 2)).toEqual([{ amount: 150, unit: 'gold' }]);
    expect(offerCosts(byYear, 5)).toEqual([{ amount: 150, unit: 'gold' }]);
  });

  it('should list gold and a currency together', () => {
    expect(
      offerCosts(offer({ price: 500, currency: { qiGems: 10 } }), 1),
    ).toEqual([
      { amount: 500, unit: 'gold' },
      { amount: 10, unit: 'qiGems' },
    ]);
  });

  it('should leave out a zero gold price when the offer is paid otherwise', () => {
    expect(
      offerCosts(offer({ price: 0, currency: { qiCoins: 5000 } }), 1),
    ).toEqual([{ amount: 5000, unit: 'qiCoins' }]);
    expect(
      offerCosts(
        offer({ price: 0, materials: [{ item: 'quartz', qty: 5 }] }),
        1,
      ),
    ).toEqual([]);
  });

  it('should list a currency-only cost', () => {
    expect(offerCosts(offer({ currency: { qiCoins: 5000 } }), 1)).toEqual([
      { amount: 5000, unit: 'qiCoins' },
    ]);
  });
});

describe('formatCost', () => {
  it('should format gold and the other currencies', () => {
    expect(formatCost({ amount: 250, unit: 'gold' })).toBe('250g');
    expect(formatCost({ amount: 10, unit: 'qiGems' })).toBe('10 gemas Qi');
    expect(formatCost({ amount: 5000, unit: 'qiCoins' })).toBe(
      '5000 fichas Qi',
    );
    expect(formatCost({ amount: 3, unit: 'goldenWalnuts' })).toBe(
      '3 nozes douradas',
    );
  });
});

describe('offerTags', () => {
  const nameOf = (id: string) => (id === 'coop' ? 'Galinheiro' : id);
  const tags = (fields: Partial<ShopOffer>) => offerTags(offer(fields), nameOf);

  it('should label requirements the profile does not track', () => {
    expect(tags({ fishingLevel: 2 })).toEqual(['Requer pesca nível 2']);
    expect(tags({ fishingLevel: 0 })).toEqual([]);
    expect(tags({ requiresBuilding: 'coop' })).toEqual(['Requer Galinheiro']);
    expect(tags({ requiresMonsterGoal: 'slimes' })).toEqual([
      'Requer meta de monstros',
    ]);
  });

  it('should label recipes, packs and rotating stock', () => {
    expect(tags({ recipe: true })).toEqual(['Receita']);
    expect(tags({ packSize: 3 })).toEqual(['Pacote com 3']);
    expect(tags({ rotating: true })).toEqual(['Rotativo']);
  });

  it('should label the special cases', () => {
    expect(
      tags({ special: 'onlyOneAtMaxKrobusFriendshipWhileSingle' }),
    ).toEqual(['Só um, com amizade máxima com Krobus e solteiro']);
    expect(tags({ special: 'wednesdayRandomFishOrMagnetBait' })).toEqual([
      'Às quartas: peixe aleatório ou isca magnética',
    ]);
  });
});

describe('hasRotatingStock', () => {
  it('should be true when any offer rotates', () => {
    expect(hasRotatingStock([offer(), offer({ rotating: true })])).toBe(true);
    expect(hasRotatingStock([offer()])).toBe(false);
  });
});

describe('buildOffers', () => {
  const relation = (
    sk: string,
    attributes: Record<string, unknown>,
  ): RelationOut => ({
    kind: 'ShopOffer',
    pk: 'SHOP#test-shop',
    sk,
    attributes,
  });

  it('should keep only shop offers, in stored index order', () => {
    // The sort key starts with the item id, so the index after the last '#' is the stored order.
    const offers = buildOffers([
      relation('OFFER#ITEM#a-item#01', { itemId: 'a-item', price: 20 }),
      { kind: 'GiftTaste', pk: 'SHOP#test-shop', sk: 'GIFT#x' },
      relation('OFFER#ITEM#z-item#00', { itemId: 'z-item', price: 10 }),
      relation('OFFER#ITEM#m-item#10', { itemId: 'm-item', price: 30 }),
      relation('OFFER#ITEM#b-item#02', { itemId: 'b-item', price: 40 }),
    ]);
    expect(offers.map((o) => o.itemId)).toEqual([
      'z-item',
      'a-item',
      'b-item',
      'm-item',
    ]);
    expect(offers[0].price).toBe(10);
  });

  it('should keep well-formed fields and drop malformed ones', () => {
    const [good] = buildOffers([
      relation('OFFER#ITEM#a#00', {
        itemId: 'a',
        materials: [{ item: 'copper-bar', qty: 5 }],
        priceByYear: { year1: 75, year2plus: 150 },
        currency: { qiGems: 10 },
        availability: 'tue',
        season: 'fall',
      }),
    ]);
    expect(good).toMatchObject({
      materials: [{ item: 'copper-bar', qty: 5 }],
      priceByYear: { year1: 75, year2plus: 150 },
      currency: { qiGems: 10 },
      availability: 'tue',
      season: 'fall',
    });
    const [bad] = buildOffers([
      relation('OFFER#ITEM#a#00', {
        itemId: 'a',
        materials: 'copper-bar',
        price: '10',
        availability: 'someday',
      }),
    ]);
    expect(bad).toEqual({ itemId: 'a' });
  });
});
