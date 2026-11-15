import type { RelationOut } from '../generated/stardew-valley-api/types.gen';

export type GiftTier = 'loves' | 'likes' | 'neutral' | 'dislikesOrHates';
export type GiftEntry = {
  kind: 'item' | 'category';
  id: string;
  except: string[];
};
export type GiftTastes = Record<GiftTier, GiftEntry[]>;

export const GIFT_TIERS: readonly GiftTier[] = [
  'loves',
  'likes',
  'neutral',
  'dislikesOrHates',
];

export const GIFT_TIER_LABELS: Record<GiftTier, string> = {
  loves: 'Ama',
  likes: 'Gosta',
  neutral: 'Neutro',
  dislikesOrHates: 'Não gosta ou odeia',
};

export const emptyTastes = (): GiftTastes => ({
  loves: [],
  likes: [],
  neutral: [],
  dislikesOrHates: [],
});

const isTier = (value: string): value is GiftTier =>
  (GIFT_TIERS as readonly string[]).includes(value);

const KINDS: Record<string, GiftEntry['kind']> = {
  ITEM: 'item',
  CATEGORY: 'category',
};

/** The villager's own gift tastes, from its `GIFT#<tier>#<ITEM|CATEGORY>#<id>` relations. */
export const giftTastes = (relations: readonly RelationOut[]): GiftTastes => {
  const tastes = emptyTastes();
  for (const relation of relations) {
    if (relation.kind !== 'GiftTaste') continue;
    const [prefix, tier, targetKind, ...rest] = relation.sk.split('#');
    const kind = KINDS[targetKind];
    const id = rest.join('#');
    if (prefix !== 'GIFT' || !isTier(tier) || !kind || !id) continue;
    const except = relation.attributes?.['except'];
    tastes[tier].push({
      kind,
      id,
      except: Array.isArray(except)
        ? except.filter((e): e is string => typeof e === 'string')
        : [],
    });
  }
  return tastes;
};

export const isEmptyTastes = (
  tastes: GiftTastes,
  tiers: readonly GiftTier[] = GIFT_TIERS,
): boolean => tiers.every((tier) => tastes[tier].length === 0);
