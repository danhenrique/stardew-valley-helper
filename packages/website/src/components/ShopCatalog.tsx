import { useTranslations } from 'use-intl';
import type { GameDateIn } from '../generated/stardew-valley-api/types.gen';
import { useGameNames } from '../hooks/useGameNames';
import {
  costMessage,
  hasRotatingStock,
  isPurchasable,
  offerCosts,
  offerTags,
  type ShopOffer,
} from '../lib/shopCatalog';
import { NumberStepper } from './form/NumberStepper';
import { GameIcon } from './GameIcon';
import { BADGE } from './styles';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus lists/stacked-lists/01-simple.jsx (rows) and
// lists/stacked-lists/12-narrow-with-sticky-headings.jsx (section headings).

const SECTIONS = ['shop', 'upgrade', 'geode', 'building', 'magic'] as const;
type Section = (typeof SECTIONS)[number];
const isSection = (section: string): section is Section =>
  (SECTIONS as readonly string[]).includes(section);

type Group = { section?: string; offers: ShopOffer[] };

/** Groups by section in order of first appearance; one unnamed group when no offer has a section. */
const groupBySection = (offers: readonly ShopOffer[]): Group[] => {
  if (!offers.some((offer) => offer.section)) return [{ offers: [...offers] }];
  const groups = new Map<string, ShopOffer[]>();
  for (const offer of offers) {
    const key = offer.section ?? 'shop';
    groups.set(key, [...(groups.get(key) ?? []), offer]);
  }
  return [...groups].map(([section, items]) => ({ section, offers: items }));
};

type Quantity = { value: number; onChange: (qty: number) => void };

const OfferRow = ({
  offer,
  year,
  quantity,
}: {
  offer: ShopOffer;
  year: number;
  quantity?: Quantity;
}) => {
  const labels = useLabels();
  const t = useTranslations('shops');
  const { nameOf } = useGameNames();
  const name = nameOf(offer.itemId);
  const tags = offerTags(offer, nameOf).map((tag) => labels.text(tag));
  return (
    <li className="flex items-center justify-between gap-x-4 py-3">
      <div className="flex min-w-0 items-center gap-x-3">
        <GameIcon id={offer.itemId} label={name} />
        <div className="min-w-0">
          <p className="text-sm/6 font-semibold text-gray-900 dark:text-white">
            {name}
          </p>
          {offer.materials && (
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs/5 text-gray-500 dark:text-gray-400">
              {offer.materials.map((material) => (
                <span
                  key={material.item}
                  className="inline-flex items-center gap-x-1"
                >
                  <GameIcon
                    id={material.item}
                    label={nameOf(material.item)}
                    size="sm"
                  />
                  {`${material.qty}× ${nameOf(material.item)}`}
                </span>
              ))}
            </p>
          )}
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className={BADGE}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-none flex-col items-end gap-y-2 sm:flex-row sm:items-center sm:gap-x-4">
        {quantity && isPurchasable(offer, year) && (
          <div className="order-2 w-28 sm:order-1">
            <NumberStepper
              label={t('quantityOf', { name })}
              hideLabel
              value={quantity.value}
              min={0}
              max={999}
              onChange={quantity.onChange}
            />
          </div>
        )}
        <div className="order-1 flex flex-col items-end text-sm font-medium text-gray-900 sm:order-2 dark:text-white">
          {offer.price === 0 && !isPurchasable(offer, year) ? (
            <span>{t('free')}</span>
          ) : (
            offerCosts(offer, year).map((cost) => (
              <span key={cost.unit}>{labels.text(costMessage(cost))}</span>
            ))
          )}
        </div>
      </div>
    </li>
  );
};

/** Offers of a shop on `date`; the caller filters them with `offersOn`. */
export const ShopCatalog = ({
  offers,
  date,
  quantities,
  onQuantityChange,
}: {
  offers: readonly ShopOffer[];
  date: GameDateIn;
  /** With `onQuantityChange`, shows a quantity stepper per offer; `quantities[i]` is for `offers[i]`. */
  quantities?: readonly number[];
  onQuantityChange?: (index: number, qty: number) => void;
}) => {
  const t = useTranslations('shops');
  const quantityOf = (offer: ShopOffer): Quantity | undefined => {
    if (!quantities || !onQuantityChange) return undefined;
    const index = offers.indexOf(offer);
    return {
      value: quantities[index] ?? 0,
      onChange: (qty) => onQuantityChange(index, qty),
    };
  };
  if (offers.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('emptyDay')}
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {hasRotatingStock(offers) && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('randomStock')}
        </p>
      )}
      {groupBySection(offers).map((group) => (
        <div key={group.section ?? 'all'}>
          {group.section && (
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {isSection(group.section)
                ? t(`section.${group.section}`)
                : group.section}
            </h3>
          )}
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {group.offers.map((offer, index) => (
              <OfferRow
                key={`${offer.itemId}-${index}`}
                offer={offer}
                year={date.year}
                quantity={quantityOf(offer)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
