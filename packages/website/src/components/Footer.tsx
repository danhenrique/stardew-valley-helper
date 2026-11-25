import { useTranslations } from 'use-intl';

// Data license notice required by the game dataset (spec §12).
export const Footer = () => {
  const t = useTranslations('common.footer');
  return (
    <footer className="border-t border-gray-200 dark:border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          {t('data')}
        </p>
        <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
          {t('images')}
        </p>
      </div>
    </footer>
  );
};
