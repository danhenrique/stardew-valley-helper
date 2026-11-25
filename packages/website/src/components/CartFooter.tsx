import { TrashIcon } from '@heroicons/react/20/solid';
import { useTranslations } from 'use-intl';
import { useGameNames } from '../hooks/useGameNames';
import {
  type CartTotals,
  type Currency,
  costMessage,
} from '../lib/shopCatalog';
import { useLabels } from './useLabels';

const isEmpty = ({ gold, currencies, materials }: CartTotals): boolean =>
  gold === 0 &&
  Object.values(currencies).every((amount) => !amount) &&
  materials.length === 0;

/** Sticky total of a purchase: gold, other currencies and materials kept apart. */
export const CartFooter = ({
  totals,
  onClear,
}: {
  totals: CartTotals;
  onClear: () => void;
}) => {
  const { nameOf } = useGameNames();
  const labels = useLabels();
  const t = useTranslations('shops.cart');
  if (isEmpty(totals)) return null;
  const currencies = Object.entries(totals.currencies) as [Currency, number][];
  return (
    <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-x-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border dark:border-white/10 dark:bg-gray-900/95">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {totals.gold > 0 && (
          <span className="font-semibold text-gray-900 dark:text-white">
            {t('total', { gold: totals.gold })}
          </span>
        )}
        {currencies.map(([unit, amount]) => (
          <span
            key={unit}
            className="font-medium text-gray-900 dark:text-white"
          >
            {labels.text(costMessage({ amount, unit }))}
          </span>
        ))}
        {totals.materials.map((material) => (
          <span
            key={material.item}
            className="text-gray-500 dark:text-gray-400"
          >
            {`${material.qty}× ${nameOf(material.item)}`}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label={t('clear')}
        title={t('clear')}
        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:hover:bg-white/10 dark:hover:text-gray-300"
      >
        <TrashIcon aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
};
