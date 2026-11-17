import { Link } from '@tanstack/react-router';
import clsx from 'clsx';
import type { GameDateIn } from '../generated/stardew-valley-api/types.gen';
import type { FixedEvent } from '../lib/events';
import { localizedName, WEEKDAY_LABELS } from '../lib/i18n';
import {
  fixedClosedDays,
  type Shop,
  type ShopProgress,
  type ShopStatus,
  shopStatusToday,
} from '../lib/shops';
import { GameIcon } from './GameIcon';
import { SHOPS_WITHOUT_CATALOG } from './OpenShops';

// Adapted from Tailwind Plus lists/grid-lists/04-horizontal-link-cards.jsx, like the
// "Hoje" tiles of OpenShops, with room for today's hours and the shop notes.

type ShopGridProps = {
  shops: Shop[];
  today: GameDateIn;
  events: FixedEvent[];
  progress: ShopProgress;
};

type ShopEntry = { shop: Shop; status: ShopStatus };

const GROUP: Record<ShopStatus['status'], number> = {
  open: 0,
  closed: 1,
  always: 2,
};

/** Open shops first, then closed, then shops without schedule; by name inside each group. */
export const sortShopEntries = (entries: ShopEntry[]): ShopEntry[] =>
  [...entries].sort(
    (a, b) =>
      GROUP[a.status.status] - GROUP[b.status.status] ||
      localizedName(a.shop.name).localeCompare(
        localizedName(b.shop.name),
        'pt-BR',
      ),
  );

const BADGE_BASE =
  'inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium';
const BADGES: Record<
  ShopStatus['status'],
  { label: string; className: string }
> = {
  open: {
    label: 'Aberta',
    className: `${BADGE_BASE} bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400`,
  },
  closed: {
    label: 'Fechada',
    className: `${BADGE_BASE} bg-gray-100 text-gray-600 dark:bg-gray-400/10 dark:text-gray-400`,
  },
  always: {
    label: 'Sem horário fixo',
    className: `${BADGE_BASE} bg-sky-100 text-sky-700 dark:bg-sky-400/10 dark:text-sky-400`,
  },
};

const CARD =
  'flex h-full w-full items-start gap-x-3 rounded-lg border border-gray-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-gray-800/50';
const LINK_CARD =
  'hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:hover:border-white/25 dark:hover:bg-white/5';
const DETAIL = 'text-xs/5 text-gray-500 dark:text-gray-400';

const CardContent = ({
  entry,
  progress,
}: {
  entry: ShopEntry;
  progress: ShopProgress;
}) => {
  const { shop, status } = entry;
  const name = localizedName(shop.name);
  const badge = BADGES[status.status];
  const closes = fixedClosedDays(shop.schedule, progress)
    .map((day) => WEEKDAY_LABELS[day])
    .join(', ');
  const notes = [...status.notes, shop.notes.note].filter(
    (note): note is string => Boolean(note),
  );
  return (
    <>
      <GameIcon id={shop.id} label={name} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm/6 font-semibold text-gray-900 dark:text-white">
          {name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={badge.className}>{badge.label}</span>
          {status.hours.length > 0 && (
            <span className={DETAIL}>{status.hours.join(' e ')}</span>
          )}
          {status.reason && <span className={DETAIL}>{status.reason}</span>}
        </div>
        {closes && <p className={`mt-1 ${DETAIL}`}>{`Fecha: ${closes}`}</p>}
        {shop.access && <p className={`mt-1 ${DETAIL}`}>{shop.access}</p>}
        {notes.map((note) => (
          <p key={note} className={`mt-1 ${DETAIL}`}>
            {note}
          </p>
        ))}
      </div>
    </>
  );
};

/** Every shop as a card with today's status; each card opens the shop catalog. */
export function ShopGrid({ shops, today, events, progress }: ShopGridProps) {
  const entries = sortShopEntries(
    shops.map((shop) => ({
      shop,
      status: shopStatusToday(shop, today, events, progress),
    })),
  );
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => {
        const className = clsx(
          CARD,
          entry.status.status === 'closed' && 'opacity-60',
        );
        return (
          <li key={entry.shop.id}>
            {SHOPS_WITHOUT_CATALOG.has(entry.shop.id) ? (
              <div className={className}>
                <CardContent entry={entry} progress={progress} />
              </div>
            ) : (
              <Link
                to="/lojas/$id"
                params={{ id: entry.shop.id }}
                className={clsx(className, LINK_CARD)}
              >
                <CardContent entry={entry} progress={progress} />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
