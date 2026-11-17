import { ChevronDownIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { useState } from 'react';
import type {
  ArtisanProductOut,
  SeedValueOut,
} from '../generated/stardew-valley-api/types.gen';
import {
  bestDestination,
  type Destination,
  formatGoldPerDay,
} from '../lib/seedValues';

const PRODUCT_NAMES: Record<string, string> = {
  jelly: 'Geleia',
  pickles: 'Picles',
  wine: 'Vinho',
  juice: 'Suco',
  'pale-ale': 'Pale Ale',
  beer: 'Cerveja',
  'green-tea': 'Chá Verde',
  coffee: 'Café',
};

const QUALITIES = [
  ['normal', 'Base'],
  ['silver', 'Prata'],
  ['gold', 'Ouro'],
  ['iridium', 'Irídio'],
] as const;

const Line = ({
  label,
  perDay,
  best,
}: {
  label: string;
  perDay?: number | null;
  best: boolean;
}) => (
  <div
    className={clsx(
      'flex justify-between gap-x-3',
      best
        ? 'font-semibold text-green-700 dark:text-green-400'
        : 'text-gray-500 dark:text-gray-400',
    )}
  >
    <span className="truncate">{label}</span>
    {perDay != null && <span>{formatGoldPerDay(perDay)}</span>}
  </div>
);

const productLabel = (
  machine: string,
  product?: ArtisanProductOut | null,
): string =>
  product
    ? `${machine} · ${PRODUCT_NAMES[product.item] ?? product.item} ${product.price}g`
    : `${machine} · —`;

/** Quality prices and gold per day selling raw, in a preserves jar and in a keg. */
export const SeedDestinations = ({ value }: { value: SeedValueOut }) => {
  const [pricesOpen, setPricesOpen] = useState(false);
  const { prices } = value;
  if (!prices) return null;
  const best: Destination | null = bestDestination(value);
  return (
    <div className="space-y-1 border-t border-gray-100 px-4 py-2 text-xs/5 dark:border-white/5">
      <div className="flex items-start gap-x-2">
        <div
          className={clsx(
            pricesOpen ? 'flex' : 'hidden',
            'flex-1 flex-wrap gap-x-3 text-gray-500 sm:flex dark:text-gray-400',
          )}
        >
          {QUALITIES.map(([quality, label]) => (
            <span key={quality}>{`${label} ${prices[quality]}g`}</span>
          ))}
        </div>
        {!pricesOpen && (
          <span className="flex-1 text-gray-500 sm:hidden dark:text-gray-400">
            Preços por qualidade
          </span>
        )}
        <button
          type="button"
          onClick={() => setPricesOpen((open) => !open)}
          aria-expanded={pricesOpen}
          aria-label="Ver preços"
          title="Ver preços"
          className="rounded-sm text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-green-600 sm:hidden dark:hover:text-gray-300"
        >
          <ChevronDownIcon
            aria-hidden="true"
            className={clsx('size-5', pricesOpen && 'rotate-180')}
          />
        </button>
      </div>
      <Line
        label={`Direto ${prices.normal}g`}
        perDay={value.goldPerDayTenths}
        best={best === 'raw'}
      />
      <Line
        label={productLabel('Jarra', value.jar)}
        perDay={value.jarGoldPerDayTenths}
        best={best === 'jar'}
      />
      <Line
        label={productLabel('Barril', value.keg)}
        perDay={value.kegGoldPerDayTenths}
        best={best === 'keg'}
      />
    </div>
  );
};
