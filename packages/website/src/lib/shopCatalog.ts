import type {
  GameDateIn,
  RelationOut,
  Season,
} from '../generated/stardew-valley-api/types.gen';
import { isRecord } from './events';
import { WEEKDAYS, type Weekday, weekdayOf } from './gameDate';

export type Currency = 'qiCoins' | 'qiGems' | 'goldenWalnuts';

export type ShopOffer = {
  itemId: string;
  price?: number;
  priceByYear?: { year1: number; year2plus: number };
  /** Non-gold cost; an offer can cost gold and a currency at once. */
  currency?: Partial<Record<Currency, number>>;
  materials?: { item: string; qty: number }[];
  season?: Season;
  section?: string;
  availability?: Weekday | 'evenDays' | 'oddDays';
  fromYear?: number;
  fishingLevel?: number;
  packSize?: number;
  recipe?: boolean;
  rotating?: boolean;
  requiresBuilding?: string;
  requiresMonsterGoal?: string;
  special?: string;
};

export type OfferCost = { amount: number; unit: 'gold' | Currency };

export const COST_LABELS: Record<OfferCost['unit'], string> = {
  gold: 'g',
  qiCoins: 'fichas Qi',
  qiGems: 'gemas Qi',
  goldenWalnuts: 'nozes douradas',
};

const CURRENCIES: readonly Currency[] = ['qiCoins', 'qiGems', 'goldenWalnuts'];
const SEASONS: readonly Season[] = ['spring', 'summer', 'fall', 'winter'];
const AVAILABILITIES: readonly string[] = [...WEEKDAYS, 'evenDays', 'oddDays'];

const SPECIAL_LABELS: Record<string, string> = {
  onlyOneAtMaxKrobusFriendshipWhileSingle:
    'Só um, com amizade máxima com Krobus e solteiro',
  wednesdayRandomFishOrMagnetBait:
    'Às quartas: peixe aleatório ou isca magnética',
};

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string =>
  typeof value === 'string' && value !== '';

const parseMaterials = (value: unknown): ShopOffer['materials'] =>
  Array.isArray(value) &&
  value.every((m) => isRecord(m) && isString(m['item']) && isNumber(m['qty']))
    ? value.map((m) => ({ item: m['item'] as string, qty: m['qty'] as number }))
    : undefined;

const parsePriceByYear = (value: unknown): ShopOffer['priceByYear'] =>
  isRecord(value) && isNumber(value['year1']) && isNumber(value['year2plus'])
    ? { year1: value['year1'], year2plus: value['year2plus'] }
    : undefined;

const parseCurrency = (value: unknown): ShopOffer['currency'] => {
  if (!isRecord(value)) return undefined;
  const entries = CURRENCIES.flatMap((c) =>
    isNumber(value[c]) ? [[c, value[c]] as const] : [],
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const toOffer = (attrs: Record<string, unknown>): ShopOffer | undefined => {
  const itemId = attrs['itemId'];
  if (!isString(itemId)) return undefined;
  const fields: Partial<ShopOffer> = {
    price: isNumber(attrs['price']) ? attrs['price'] : undefined,
    priceByYear: parsePriceByYear(attrs['priceByYear']),
    currency: parseCurrency(attrs['currency']),
    materials: parseMaterials(attrs['materials']),
    season: SEASONS.includes(attrs['season'] as Season)
      ? (attrs['season'] as Season)
      : undefined,
    section: isString(attrs['section']) ? attrs['section'] : undefined,
    availability: AVAILABILITIES.includes(attrs['availability'] as string)
      ? (attrs['availability'] as ShopOffer['availability'])
      : undefined,
    fromYear: isNumber(attrs['fromYear']) ? attrs['fromYear'] : undefined,
    fishingLevel: isNumber(attrs['fishingLevel'])
      ? attrs['fishingLevel']
      : undefined,
    packSize: isNumber(attrs['packSize']) ? attrs['packSize'] : undefined,
    recipe: attrs['recipe'] === true ? true : undefined,
    rotating: attrs['rotating'] === true ? true : undefined,
    requiresBuilding: isString(attrs['requiresBuilding'])
      ? attrs['requiresBuilding']
      : undefined,
    requiresMonsterGoal: isString(attrs['requiresMonsterGoal'])
      ? attrs['requiresMonsterGoal']
      : undefined,
    special: isString(attrs['special']) ? attrs['special'] : undefined,
  };
  const defined = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
  return { itemId, ...defined };
};

/** Stored position of an offer: the number after the last '#' of `OFFER#ITEM#<itemId>#<index>`. */
const offerIndex = (sk: string): number =>
  Number(sk.slice(sk.lastIndexOf('#') + 1));

/** Offers of a shop detail (`GET /game/lojas/{id}`), in stored order. */
export const buildOffers = (relations: readonly RelationOut[]): ShopOffer[] =>
  relations
    .filter((r) => r.kind === 'ShopOffer')
    .sort((a, b) => offerIndex(a.sk) - offerIndex(b.sk))
    .flatMap((r) => {
      const offer = toOffer(r.attributes ?? {});
      return offer ? [offer] : [];
    });

const availableOn = (offer: ShopOffer, date: GameDateIn): boolean => {
  const { availability } = offer;
  if (!availability) return true;
  if (availability === 'evenDays') return date.day % 2 === 0;
  if (availability === 'oddDays') return date.day % 2 === 1;
  return availability === weekdayOf(date.day);
};

/** Offers on sale on `date`: season, weekday or day parity, and first year. */
export const offersOn = (
  offers: readonly ShopOffer[],
  date: GameDateIn,
): ShopOffer[] =>
  offers.filter(
    (offer) =>
      (!offer.season || offer.season === date.season) &&
      availableOn(offer, date) &&
      (offer.fromYear === undefined || date.year >= offer.fromYear),
  );

/** Costs to show, gold first, then each non-gold currency. */
export const offerCosts = (offer: ShopOffer, year: number): OfferCost[] => {
  const gold = offer.priceByYear
    ? year <= 1
      ? offer.priceByYear.year1
      : offer.priceByYear.year2plus
    : offer.price;
  // Barter and currency offers store a 0 gold price; it is not a cost to show.
  const paidOtherwise =
    offer.currency !== undefined || offer.materials !== undefined;
  const showGold = gold !== undefined && !(gold === 0 && paidOtherwise);
  return [
    ...(showGold ? [{ amount: gold, unit: 'gold' as const }] : []),
    ...CURRENCIES.flatMap((unit) => {
      const amount = offer.currency?.[unit];
      return amount === undefined ? [] : [{ amount, unit }];
    }),
  ];
};

export const formatCost = ({ amount, unit }: OfferCost): string =>
  unit === 'gold' ? `${amount}g` : `${amount} ${COST_LABELS[unit]}`;

/** Labels for what the profile does not track; they never hide the offer. */
export const offerTags = (
  offer: ShopOffer,
  nameOf: (id: string) => string,
): string[] => [
  ...(offer.fishingLevel ? [`Requer pesca nível ${offer.fishingLevel}`] : []),
  ...(offer.requiresBuilding
    ? [`Requer ${nameOf(offer.requiresBuilding)}`]
    : []),
  ...(offer.requiresMonsterGoal ? ['Requer meta de monstros'] : []),
  ...(offer.recipe ? ['Receita'] : []),
  ...(offer.packSize ? [`Pacote com ${offer.packSize}`] : []),
  ...(offer.rotating ? ['Rotativo'] : []),
  ...(offer.special && SPECIAL_LABELS[offer.special]
    ? [SPECIAL_LABELS[offer.special]]
    : []),
];

export const hasRotatingStock = (offers: readonly ShopOffer[]): boolean =>
  offers.some((offer) => offer.rotating);
