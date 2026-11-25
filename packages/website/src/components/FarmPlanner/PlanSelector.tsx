import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { useTranslations } from 'use-intl';

export type PlanChoice = { id: string; name: string };

type PlanSelectorProps = {
  planName: string;
  /** The player's other plans (the open one left out). */
  plans: PlanChoice[];
  onPick: (planId: string) => void;
};

// Adapted from Tailwind Plus elements/dropdowns/01-simple.jsx.
export function PlanSelector({ planName, plans, onPick }: PlanSelectorProps) {
  const t = useTranslations('farmPlanner.page');
  return (
    <Menu as="div" className="relative inline-block min-w-0">
      <MenuButton
        aria-label={t('switchNamed', { name: planName })}
        title={t('switch')}
        className="inline-flex max-w-full items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-base font-semibold text-gray-900 shadow-xs inset-ring-1 inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
      >
        <span className="truncate">{planName}</span>
        <ChevronDownIcon
          aria-hidden="true"
          className="-mr-1 size-5 shrink-0 text-gray-400"
        />
      </MenuButton>

      <MenuItems
        transition
        className="absolute left-0 z-20 mt-2 max-h-72 w-56 origin-top-left overflow-y-auto rounded-md bg-white shadow-lg outline-1 outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
      >
        <div className="py-1">
          {plans.map((plan) => (
            <MenuItem key={plan.id}>
              <button
                type="button"
                onClick={() => onPick(plan.id)}
                className="block w-full truncate px-4 py-2 text-left text-sm text-gray-700 data-focus:bg-gray-100 data-focus:text-gray-900 data-focus:outline-hidden dark:text-gray-300 dark:data-focus:bg-white/5 dark:data-focus:text-white"
              >
                {plan.name}
              </button>
            </MenuItem>
          ))}
        </div>
      </MenuItems>
    </Menu>
  );
}
