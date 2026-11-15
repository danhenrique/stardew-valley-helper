import { ChevronDownIcon } from '@heroicons/react/16/solid';
import clsx from 'clsx';

// Adapted from Tailwind Plus navigation/tabs/08-tabs-with-underline-and-badges.jsx
// (buttons instead of links: the tabs filter in place).
export type UnderlineTab<T extends string> = { id: T; label: string };

type UnderlineTabsProps<T extends string> = {
  tabs: readonly UnderlineTab<T>[];
  value: T;
  counts: Record<T, number>;
  onChange: (tab: T) => void;
  /** Accessible names of the tab bar (desktop) and of the select (mobile). */
  navLabel: string;
  selectLabel: string;
};

export function UnderlineTabs<T extends string>({
  tabs,
  value,
  counts,
  onChange,
  navLabel,
  selectLabel,
}: UnderlineTabsProps<T>) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:hidden">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          aria-label={selectLabel}
          className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-2 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 dark:bg-white/5 dark:text-gray-100 dark:outline-white/10 dark:*:bg-gray-800 dark:focus:outline-green-500"
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label} ({counts[tab.id]})
            </option>
          ))}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end fill-gray-500 dark:fill-gray-400"
        />
      </div>
      <div className="hidden sm:block">
        <div className="border-b border-gray-200 dark:border-white/10">
          <nav aria-label={navLabel} className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const current = tab.id === value;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChange(tab.id)}
                  aria-current={current ? 'page' : undefined}
                  className={clsx(
                    current
                      ? 'border-green-500 text-green-600 dark:border-green-400 dark:text-green-400'
                      : 'border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:border-white/20 dark:hover:text-white',
                    'flex border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap',
                  )}
                >
                  {tab.label}{' '}
                  <span
                    className={clsx(
                      current
                        ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-gray-300',
                      'ml-3 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    )}
                  >
                    {counts[tab.id]}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
