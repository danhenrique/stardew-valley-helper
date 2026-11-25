import { InformationCircleIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';
import type { GameDateIn } from '../generated/stardew-valley-api/types.gen';
import type { FixedEvent } from '../lib/events';
import { localizedName } from '../lib/i18n';
import type { Locale } from '../lib/locale';
import {
  type Shop,
  type ShopProgress,
  type ShopStatus,
  shopStatusToday,
} from '../lib/shops';
import { GameIcon } from './GameIcon';
import { LocaleLink } from './LocaleLink';
import type { MachineCatalogStatus } from './MachineCatalogNotice';
import { ShopCatalogModal } from './ShopCatalogModal';
import { SkeletonGrid } from './Skeleton';
import { CARD } from './styles';
import { type Labels, useLabels } from './useLabels';

// Adapted from Tailwind Plus lists/grid-lists/04-horizontal-link-cards.jsx: a grid of
// compact tiles (icon, name, closing time), each a button that opens the catalog.

/** Shops with no offers in the game data: listed, but without a catalog to open. */
export const SHOPS_WITHOUT_CATALOG: ReadonlySet<string> = new Set([
  'ice-cream-stand',
  'movie-theater',
  'museum',
  'traveling-cart',
]);

const TILE =
  'relative flex h-full w-full flex-col items-center gap-y-1 rounded-lg border border-gray-200 bg-white px-3 py-4 text-center dark:border-white/10 dark:bg-gray-800/50';

type OpenShop = { shop: Shop; status: ShopStatus };

/** The closing time of today's last opening range ("17:00"), if there is one. */
const closingTime = (hours: string[]): string | null =>
  hours[hours.length - 1]?.split('–')[1] ?? null;

const shopNotes = (
  { shop, status }: OpenShop,
  labels: Labels,
  t: Translator,
): string[] => [
  ...status.notes.map((note) => labels.text(note)),
  ...(shop.id === 'traveling-cart' ? [t('randomStock')] : []),
];

type Translator = ReturnType<typeof useTranslations<'today'>>;

/** Full hours and notes of a tile, shown on hover. */
const tileTitle = (
  entry: OpenShop,
  locale: Locale,
  labels: Labels,
  t: Translator,
): string =>
  [
    localizedName(entry.shop.name, locale),
    ...entry.status.hours,
    ...shopNotes(entry, labels, t),
  ].join(' · ');

const ShopTileContent = (entry: OpenShop) => {
  const locale = useLocale();
  const name = localizedName(entry.shop.name, locale);
  const t = useTranslations('today');
  const time = closingTime(entry.status.hours);
  const closing = time ? t('closesAt', { time }) : null;
  const labels = useLabels();
  const notes = shopNotes(entry, labels, t);
  return (
    <>
      {notes.length > 0 && (
        <InformationCircleIcon
          aria-hidden="true"
          className="absolute top-2 right-2 size-4 text-gray-400 dark:text-gray-500"
        />
      )}
      <GameIcon id={entry.shop.id} label={name} size="lg" />
      <span className="mt-1 w-full truncate text-sm/6 font-semibold text-gray-900 dark:text-white">
        {name}
      </span>
      {closing && (
        <span className="text-xs/5 text-gray-500 dark:text-gray-400">
          {closing}
        </span>
      )}
      {notes.map((note) => (
        <span key={note} className="sr-only">
          {note}
        </span>
      ))}
    </>
  );
};

type OpenShopsProps = {
  shops: Shop[];
  today: GameDateIn;
  events: FixedEvent[];
  progress: ShopProgress;
  status: MachineCatalogStatus;
  /** Festivals close shops, so the list waits for the events too. */
  eventsStatus?: MachineCatalogStatus;
};

/** The shops open today; each opens today's catalog in a modal. */
export const OpenShops = ({
  shops,
  today,
  events,
  progress,
  status: shopsStatus,
  eventsStatus = 'success',
}: OpenShopsProps) => {
  const labels = useLabels();
  const locale = useLocale();
  const t = useTranslations('today');
  const status: MachineCatalogStatus =
    shopsStatus === 'error' || eventsStatus === 'error'
      ? 'error'
      : shopsStatus === 'pending' || eventsStatus === 'pending'
        ? 'pending'
        : 'success';
  const [selected, setSelected] = useState<OpenShop | null>(null);
  const open = shops
    .map((shop) => ({
      shop,
      status: shopStatusToday(shop, today, events, progress),
    }))
    .filter((entry) => entry.status.status === 'open');

  return (
    <section className={CARD}>
      <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">
        {t('openShops')}
      </h2>
      <div className="mt-2">
        {status === 'pending' ? (
          <SkeletonGrid label={t('shopsLoading')} tiles={4} />
        ) : status === 'error' ? (
          <p className="text-sm text-red-700 dark:text-red-400">
            {t('shopsError')}
          </p>
        ) : open.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('noShops')}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {open.map((entry) => (
              <li key={entry.shop.id}>
                {SHOPS_WITHOUT_CATALOG.has(entry.shop.id) ? (
                  <div
                    className={TILE}
                    title={tileTitle(entry, locale, labels, t)}
                  >
                    <ShopTileContent {...entry} />
                  </div>
                ) : (
                  <button
                    type="button"
                    title={tileTitle(entry, locale, labels, t)}
                    onClick={() => setSelected(entry)}
                    className={`${TILE} hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:hover:border-white/25 dark:hover:bg-white/5`}
                  >
                    <ShopTileContent {...entry} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <LocaleLink
        to="/{-$locale}/shops"
        className="mt-4 inline-block text-sm font-semibold text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
      >
        {t('allShops')}
      </LocaleLink>
      {selected && (
        <ShopCatalogModal
          shop={selected.shop}
          status={selected.status}
          today={today}
          open
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
};
