import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { CheckIcon } from '@heroicons/react/20/solid';
import { LanguageIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useTranslations } from 'use-intl';
import { type Locale, saveLocale, useRouteLocale } from '../../lib/locale';
import { useLocaleNavigate } from '../LocaleLink';

// Names are shown in their own language so they stay readable from the wrong one.
const OPTIONS: readonly { locale: Locale; name: 'portuguese' | 'english' }[] = [
  { locale: 'pt-BR', name: 'portuguese' },
  { locale: 'en', name: 'english' },
];

// Adapted from Tailwind Plus application-ui-v4/react/elements/dropdowns/04-with-minimal-menu-icon.jsx
/** Icon button with a menu to switch language, keeping the current page, params and search. */
export const LanguageSwitcher = () => {
  const t = useTranslations('language');
  const current = useRouteLocale();
  const navigate = useLocaleNavigate();

  const choose = (locale: Locale) => {
    saveLocale(locale);
    if (locale === current) return;
    // Same route, same params and search, under the other prefix.
    void navigate({ params: true, search: true, hash: true, locale });
  };

  return (
    <Menu as="div" className="relative">
      <MenuButton
        aria-label={t('label')}
        title={t('label')}
        className="relative flex items-center rounded-full p-1 text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:hover:text-white"
      >
        <span className="absolute -inset-1.5" />
        <LanguageIcon aria-hidden="true" className="size-6" />
      </MenuButton>
      <MenuItems
        transition
        className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-white py-1 shadow-lg outline outline-black/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
      >
        {OPTIONS.map(({ locale, name }) => (
          <MenuItem key={locale}>
            <button
              type="button"
              lang={locale}
              aria-current={locale === current ? 'true' : undefined}
              onClick={() => choose(locale)}
              className={clsx(
                'flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 data-focus:bg-gray-100 data-focus:outline-hidden dark:text-gray-300 dark:data-focus:bg-white/5',
                locale === current && 'font-semibold',
              )}
            >
              {t(name)}
              {locale === current && (
                <CheckIcon
                  aria-hidden="true"
                  className="size-5 text-green-600"
                />
              )}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
};
