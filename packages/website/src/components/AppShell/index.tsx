import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from '@headlessui/react';
import {
  Bars3Icon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useLocation } from '@tanstack/react-router';
import clsx from 'clsx';
import type { PropsWithChildren, ReactNode } from 'react';
import { useTranslations } from 'use-intl';
import { Footer } from '../Footer';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { LocaleLink } from '../LocaleLink';
import { ThemeToggle } from '../ThemeToggle';

// Adapted from Tailwind Plus application-ui-v4/react/application-shells/stacked/01-with-bottom-border.jsx
const NAVIGATION = [
  { key: 'today', to: '/{-$locale}' },
  { key: 'farming', to: '/{-$locale}/farming' },
  { key: 'farm', to: '/{-$locale}/farm' },
  { key: 'seeds', to: '/{-$locale}/seeds' },
  { key: 'fish', to: '/{-$locale}/fish' },
  { key: 'calendar', to: '/{-$locale}/calendar' },
  { key: 'shops', to: '/{-$locale}/shops' },
] as const;

type AppShellProps = PropsWithChildren<{
  userName?: string;
  onSignOut: () => void;
  /** Game day control: next to the user menu on wide screens (xl), a strip under the bar below that. */
  dayNav?: ReactNode;
}>;

export const AppShell = ({
  userName,
  onSignOut,
  dayNav,
  children,
}: AppShellProps) => {
  const { pathname } = useLocation();
  const t = useTranslations('nav');
  // Compare without the locale prefix so `/en/farming` marks the same item as `/farming`.
  const withoutLocale = (path: string) =>
    path.replace(/^(\/en|\/\{-\$locale\})(?=\/|$)/, '') || '/';
  const isCurrent = (to: string) =>
    withoutLocale(pathname) === withoutLocale(to);

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-900">
      <Disclosure
        as="nav"
        className="border-b border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex shrink-0 items-center">
                <span className="text-lg font-bold text-green-700 dark:text-green-400">
                  Stardew Helper
                </span>
              </div>
              <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                {NAVIGATION.map((item) => (
                  <LocaleLink
                    key={item.key}
                    to={item.to}
                    // The current page keeps its search (the open tab); others open fresh.
                    search={isCurrent(item.to) ? true : undefined}
                    aria-current={isCurrent(item.to) ? 'page' : undefined}
                    className={clsx(
                      isCurrent(item.to)
                        ? 'border-green-600 text-gray-900 dark:border-green-500 dark:text-white'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-white/20 dark:hover:text-gray-200',
                      'inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium',
                    )}
                  >
                    {t(item.key)}
                  </LocaleLink>
                ))}
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              {dayNav && <div className="mr-4 hidden xl:block">{dayNav}</div>}
              <div className="flex items-center gap-3">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              <Menu as="div" className="relative ml-3">
                <MenuButton
                  aria-label={t('openUserMenu')}
                  title={t('openUserMenu')}
                  className="relative flex max-w-xs items-center rounded-full text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:hover:text-white"
                >
                  <span className="absolute -inset-1.5" />
                  <UserCircleIcon aria-hidden="true" className="size-8" />
                </MenuButton>
                <MenuItems
                  transition
                  className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg outline outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                >
                  {userName && (
                    <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {userName}
                    </div>
                  )}
                  <MenuItem>
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden dark:text-gray-300 dark:data-focus:bg-white/5"
                    >
                      {t('signOut')}
                    </button>
                  </MenuItem>
                </MenuItems>
              </Menu>
            </div>
            <div className="-mr-2 flex items-center gap-2 sm:hidden">
              <LanguageSwitcher />
              <ThemeToggle />
              <DisclosureButton
                aria-label={t('openMainMenu')}
                title={t('openMainMenu')}
                className="group relative inline-flex items-center justify-center rounded-md bg-white p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-2 focus:outline-offset-2 focus:outline-green-600 dark:bg-gray-900 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <span className="absolute -inset-0.5" />
                <Bars3Icon
                  aria-hidden="true"
                  className="block size-6 group-data-open:hidden"
                />
                <XMarkIcon
                  aria-hidden="true"
                  className="hidden size-6 group-data-open:block"
                />
              </DisclosureButton>
            </div>
          </div>
        </div>
        {dayNav && (
          <div className="flex justify-center border-t border-gray-200 px-4 py-2 xl:hidden dark:border-white/10">
            {dayNav}
          </div>
        )}

        <DisclosurePanel className="sm:hidden">
          <div className="space-y-1 pt-2 pb-3">
            {NAVIGATION.map((item) => (
              <DisclosureButton
                key={item.key}
                as={LocaleLink}
                to={item.to}
                search={isCurrent(item.to) ? true : undefined}
                aria-current={isCurrent(item.to) ? 'page' : undefined}
                className={clsx(
                  isCurrent(item.to)
                    ? 'border-green-600 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-600/10 dark:text-green-300'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200',
                  'block border-l-4 py-2 pr-4 pl-3 text-base font-medium',
                )}
              >
                {t(item.key)}
              </DisclosureButton>
            ))}
          </div>
          <div className="border-t border-gray-200 pt-4 pb-3 dark:border-gray-700">
            {userName && (
              <div className="px-4 text-base font-medium text-gray-800 dark:text-white">
                {userName}
              </div>
            )}
            <div className="mt-3 space-y-1">
              <DisclosureButton
                as="button"
                type="button"
                onClick={onSignOut}
                className="block w-full px-4 py-2 text-left text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
              >
                {t('signOut')}
              </DisclosureButton>
            </div>
          </div>
        </DisclosurePanel>
      </Disclosure>

      <main className="flex-1 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
      <Footer />
    </div>
  );
};

export default AppShell;
