import { useTranslations } from 'use-intl';

/** Not-found page; rendered inside the root `RouteIntlProvider`. */
export const NotFoundPage = () => {
  const t = useTranslations('notFound');
  return (
    <p className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
      {t('title')}
    </p>
  );
};
