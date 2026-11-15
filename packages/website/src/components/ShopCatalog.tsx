import type { GameDateIn } from '../generated/stardew-valley-api/types.gen';
import { useGameNames } from '../hooks/useGameNames';
import {
  formatCost,
  hasRotatingStock,
  offerCosts,
  offerTags,
  type ShopOffer,
} from '../lib/shopCatalog';
import { GameIcon } from './GameIcon';
import { BADGE } from './styles';

// Adapted from Tailwind Plus lists/stacked-lists/01-simple.jsx (rows) and
// lists/stacked-lists/12-narrow-with-sticky-headings.jsx (section headings).

export const SECTION_LABELS: Record<string, string> = {
  shop: 'Loja',
  upgrade: 'Melhorias',
  geode: 'Geodos',
  building: 'Construções',
  magic: 'Magia',
};

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

const OfferRow = ({ offer, year }: { offer: ShopOffer; year: number }) => {
  const { nameOf } = useGameNames();
  const name = nameOf(offer.itemId);
  const tags = offerTags(offer, nameOf);
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
      <div className="flex flex-none flex-col items-end text-sm font-medium text-gray-900 dark:text-white">
        {offerCosts(offer, year).map((cost) => (
          <span key={cost.unit}>{formatCost(cost)}</span>
        ))}
      </div>
    </li>
  );
};

/** Offers of a shop on `date`; the caller filters them with `offersOn`. */
export const ShopCatalog = ({
  offers,
  date,
}: {
  offers: readonly ShopOffer[];
  date: GameDateIn;
}) => {
  if (offers.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Nada à venda neste dia.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {hasRotatingStock(offers) && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Parte do estoque é sorteada pelo jogo
        </p>
      )}
      {groupBySection(offers).map((group) => (
        <div key={group.section ?? 'all'}>
          {group.section && (
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {SECTION_LABELS[group.section] ?? group.section}
            </h3>
          )}
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {group.offers.map((offer, index) => (
              <OfferRow
                key={`${offer.itemId}-${index}`}
                offer={offer}
                year={date.year}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
