import { Link } from '@tanstack/react-router';
import type { GameDateIn } from '../generated/stardew-valley-api/types.gen';
import type { FixedEvent } from '../lib/events';
import { localizedName, WEEKDAY_LABELS } from '../lib/i18n';
import {
  fixedClosedDays,
  type Shop,
  type ShopProgress,
  shopStatusToday,
} from '../lib/shops';
import { GameIcon } from './GameIcon';

type ShopTableProps = {
  shops: Shop[];
  today: GameDateIn;
  events: FixedEvent[];
  progress: ShopProgress;
};

const BADGE_BASE =
  'inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium';
const OPEN_BADGE = `${BADGE_BASE} bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400`;
const CLOSED_BADGE = `${BADGE_BASE} bg-gray-100 text-gray-600 dark:bg-gray-400/10 dark:text-gray-400`;

const HEADER =
  'px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white';

/** Shops table, adapted from Tailwind Plus lists/tables/08-with-hidden-columns-on-mobile.jsx. */
export function ShopTable({ shops, today, events, progress }: ShopTableProps) {
  return (
    <div className="-mx-4 mt-4 overflow-x-auto sm:mx-0">
      <table className="min-w-full divide-y divide-gray-300 dark:divide-white/15">
        <thead>
          <tr>
            <th
              scope="col"
              className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-0 dark:text-white"
            >
              Loja
            </th>
            <th scope="col" className={HEADER}>
              Hoje
            </th>
            <th scope="col" className={HEADER}>
              Horário
            </th>
            <th scope="col" className={`hidden lg:table-cell ${HEADER}`}>
              Fecha
            </th>
            <th scope="col" className={`hidden lg:table-cell ${HEADER}`}>
              Observações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-white/10">
          {shops.map((shop) => {
            const status = shopStatusToday(shop, today, events, progress);
            const closes = fixedClosedDays(shop.schedule, progress)
              .map((day) => WEEKDAY_LABELS[day])
              .join(', ');
            const notes = [...status.notes, shop.notes.note]
              .filter(Boolean)
              .join(' · ');
            return (
              <tr key={shop.id}>
                <td className="py-4 pr-3 pl-4 text-sm font-medium text-gray-900 sm:pl-0 dark:text-white">
                  <Link
                    to="/lojas/$id"
                    params={{ id: shop.id }}
                    className="flex items-center gap-x-3 hover:text-green-700 dark:hover:text-green-400"
                  >
                    <GameIcon id={shop.id} label={localizedName(shop.name)} />
                    {localizedName(shop.name)}
                  </Link>
                  <dl className="font-normal lg:hidden">
                    {closes && (
                      <dd className="mt-1 truncate text-gray-500 dark:text-gray-400">
                        Fecha: {closes}
                      </dd>
                    )}
                    {notes && (
                      <>
                        <dt className="sr-only">Observações</dt>
                        <dd className="mt-1 text-gray-500 dark:text-gray-400">
                          {notes}
                        </dd>
                      </>
                    )}
                  </dl>
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={
                        status.status === 'open' ? OPEN_BADGE : CLOSED_BADGE
                      }
                    >
                      {status.status === 'open' ? 'Aberta' : 'Fechada'}
                    </span>
                    {status.reason && <span>{status.reason}</span>}
                  </span>
                </td>
                <td className="px-3 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                  {status.hours.length > 0 ? status.hours.join(' e ') : '—'}
                </td>
                <td className="hidden px-3 py-4 text-sm whitespace-nowrap text-gray-500 lg:table-cell dark:text-gray-400">
                  {closes || '—'}
                </td>
                <td className="hidden px-3 py-4 text-sm text-gray-500 lg:table-cell dark:text-gray-400">
                  {notes || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
