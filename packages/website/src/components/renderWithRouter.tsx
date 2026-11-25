import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { type Locale, localeFromPathname } from '../lib/locale';
import { IntlTestProvider } from './renderWithIntl';

type PageRoute = {
  path: string;
  component?: () => ReactElement;
  /** Runs before the page renders, e.g. to throw a `redirect`. */
  beforeLoad?: () => void;
};

/**
 * Renders `ui` inside a memory router that knows the events, shops, farming and calendar routes, so TanStack `Link`s
 * resolve. `pages` are extra routes (for example the page under test) rendered at `initialPath`.
 * Wrapped in `IntlTestProvider` with `locale`, or the locale of the `initialPath` prefix.
 * The locale stays fixed for the whole test: tests that navigate between `/x` and `/en/x` must
 * use the real route tree, as `routes/__root.spec.tsx` does.
 */
export const renderWithRouter = (
  ui: ReactElement | null,
  options: { initialPath?: string; pages?: PageRoute[]; locale?: Locale } = {},
) => {
  const { initialPath = '/', pages = [] } = options;
  const locale = options.locale ?? localeFromPathname(initialPath);
  const rootRoute = createRootRoute({ component: Outlet });
  const index = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => ui,
  });
  const stubs = [
    '/{-$locale}/events/',
    '/{-$locale}/events/$id',
    '/{-$locale}/shops',
    '/{-$locale}/shops/$id',
    '/{-$locale}/farming',
    '/{-$locale}/calendar',
  ]
    .filter((path) => !pages.some((page) => page.path === path))
    .map((path) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: () => <p>stub {path}</p>,
      }),
    );
  const custom = pages.map((page) =>
    createRoute({ getParentRoute: () => rootRoute, ...page }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren([index, ...stubs, ...custom]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  render(
    <IntlTestProvider locale={locale}>
      <RouterProvider router={router} />
    </IntlTestProvider>,
  );
  return router;
};
