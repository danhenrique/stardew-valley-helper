import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';
import { parseLocaleParam, saveLocale } from '../../lib/locale';

// Validates the locale segment and remembers an explicit prefix; the root layout provides the messages.
export const Route = createFileRoute('/{-$locale}')({
  beforeLoad: ({ params }) => {
    const locale = parseLocaleParam(params.locale);
    if (locale === null) throw notFound();
    // An explicit prefix (e.g. a shared English link) is remembered as the choice.
    if (params.locale !== undefined) saveLocale(locale);
  },
  component: Outlet,
});
