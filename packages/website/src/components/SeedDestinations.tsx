import { ChevronDownIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';
import type {
  ArtisanProductOut,
  SeedValueOut,
} from '../generated/stardew-valley-api/types.gen';
import {
  bestDestination,
  type Destination,
  formatGoldPerDay,
} from '../lib/seedValues';
import { useLabels } from './useLabels';

const QUALITIES = ['normal', 'silver', 'gold', 'iridium'] as const;

const Line = ({
  label,
  perDay,
  best,
}: {
  label: string;
  perDay?: number | null;
  best: boolean;
}) => {
  const locale = useLocale();
  const labels = useLabels();
  return (
    <div
      className={clsx(
        'flex justify-between gap-x-3',
        best
          ? 'font-semibold text-green-700 dark:text-green-400'
          : 'text-gray-500 dark:text-gray-400',
      )}
    >
      <span className="truncate">{label}</span>
      {perDay != null && (
        <span>{labels.text(formatGoldPerDay(perDay, locale))}</span>
      )}
    </div>
  );
};

const useProductLabel = () => {
  const t = useTranslations('seeds');
  return (
    machine: 'jar' | 'keg',
    product?: ArtisanProductOut | null,
  ): string => {
    const machineName = t(`machine.${machine}`);
    if (!product) return t('machineNoProduct', { machine: machineName });
    const key = `products.${product.item}`;
    return t('machineProduct', {
      machine: machineName,
      product: t.has(key as 'products.jelly')
        ? t(key as 'products.jelly')
        : product.item,
      price: product.price,
    });
  };
};

/** Quality prices and gold per day selling raw, in a preserves jar and in a keg. */
export const SeedDestinations = ({ value }: { value: SeedValueOut }) => {
  const t = useTranslations('seeds');
  const labels = useLabels();
  const productLabel = useProductLabel();
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
          {QUALITIES.map((quality) => (
            <span key={quality}>
              {t('qualityPrice', {
                quality:
                  quality === 'normal'
                    ? t('baseQuality')
                    : labels.quality(quality),
                price: prices[quality],
              })}
            </span>
          ))}
        </div>
        {!pricesOpen && (
          <span className="flex-1 text-gray-500 sm:hidden dark:text-gray-400">
            {t('pricesByQuality')}
          </span>
        )}
        <button
          type="button"
          onClick={() => setPricesOpen((open) => !open)}
          aria-expanded={pricesOpen}
          aria-label={t('showPrices')}
          title={t('showPrices')}
          className="rounded-sm text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-green-600 sm:hidden dark:hover:text-gray-300"
        >
          <ChevronDownIcon
            aria-hidden="true"
            className={clsx('size-5', pricesOpen && 'rotate-180')}
          />
        </button>
      </div>
      <Line
        label={t('direct', { price: prices.normal })}
        perDay={value.goldPerDayTenths}
        best={best === 'raw'}
      />
      <Line
        label={productLabel('jar', value.jar)}
        perDay={value.jarGoldPerDayTenths}
        best={best === 'jar'}
      />
      <Line
        label={productLabel('keg', value.keg)}
        perDay={value.kegGoldPerDayTenths}
        best={best === 'keg'}
      />
    </div>
  );
};
