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

type PageRoute = {
  path: string;
  component?: () => ReactElement;
  /** Runs before the page renders, e.g. to throw a `redirect`. */
  beforeLoad?: () => void;
};

/**
 * Renders `ui` inside a memory router that knows the events routes, so TanStack `Link`s
 * resolve. `pages` are extra routes (for example the page under test) rendered at `initialPath`.
 */
export const renderWithRouter = (
  ui: ReactElement | null,
  options: { initialPath?: string; pages?: PageRoute[] } = {},
) => {
  const { initialPath = '/', pages = [] } = options;
  const rootRoute = createRootRoute({ component: Outlet });
  const index = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => ui,
  });
  const stubs = [
    '/eventos/',
    '/eventos/$id',
    '/lojas',
    '/lojas/$id',
    '/plantios',
    '/maquinas',
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
  render(<RouterProvider router={router} />);
  return router;
};
