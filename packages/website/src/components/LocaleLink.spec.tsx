import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { parseLocaleParam, useRouteLocale } from '../lib/locale';
import { Route as RootRoute } from '../routes/__root';
import { LocaleLink, useLocaleNavigate } from './LocaleLink';
import { IntlTestProvider } from './renderWithIntl';

// Stub tree so the tests do not depend on the real routes.
const renderAt = async (path: string) => {
  const rootRoute = createRootRoute({
    component: Outlet,
    notFoundComponent: RootRoute.options.notFoundComponent,
  });
  const layout = createRoute({
    getParentRoute: () => rootRoute,
    path: '/{-$locale}',
    beforeLoad: ({ params }) => {
      if (parseLocaleParam(params.locale) === null) {
        throw notFound();
      }
    },
    component: Outlet,
  });
  const Home = () => <p>home {useRouteLocale()}</p>;
  const Fish = () => {
    const navigate = useLocaleNavigate();
    return (
      <div>
        <LocaleLink to="/{-$locale}/seeds">go seeds</LocaleLink>
        <LocaleLink to="/{-$locale}/shops/$id" params={{ id: 'pierre' }}>
          go shop
        </LocaleLink>
        <button
          type="button"
          onClick={() => navigate({ to: '/{-$locale}/seeds' })}
        >
          nav
        </button>
      </div>
    );
  };
  const index = createRoute({
    getParentRoute: () => layout,
    path: '/',
    component: Home,
  });
  const fish = createRoute({
    getParentRoute: () => layout,
    path: 'fish',
    component: Fish,
  });
  const seeds = createRoute({
    getParentRoute: () => layout,
    path: 'seeds',
    component: () => <p>seeds page</p>,
  });
  const shop = createRoute({
    getParentRoute: () => layout,
    path: 'shops/$id',
    component: () => <p>shop page</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      layout.addChildren([index, fish, seeds, shop]),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <IntlTestProvider>
      <RouterProvider router={router} />
    </IntlTestProvider>,
  );
  await router.load();
  return router;
};

describe('LocaleLink', () => {
  it('keeps the en prefix', async () => {
    await renderAt('/en/fish');
    expect((await screen.findByText('go seeds')).getAttribute('href')).toBe(
      '/en/seeds',
    );
    expect(screen.getByText('go shop').getAttribute('href')).toBe(
      '/en/shops/pierre',
    );
  });
  it('adds no prefix for pt-BR', async () => {
    await renderAt('/fish');
    expect((await screen.findByText('go seeds')).getAttribute('href')).toBe(
      '/seeds',
    );
  });
  it('navigates keeping the locale', async () => {
    const router = await renderAt('/en/fish');
    (await screen.findByText('nav')).click();
    await screen.findByText('seeds page');
    expect(router.state.location.pathname).toBe('/en/seeds');
  });
});

describe('locale segment', () => {
  it.each(['/en', '/en/'])(
    'renders home with locale en at %s',
    async (path) => {
      await renderAt(path);
      expect(await screen.findByText('home en')).toBeTruthy();
    },
  );
  it('renders home with locale pt-BR at /', async () => {
    await renderAt('/');
    expect(await screen.findByText('home pt-BR')).toBeTruthy();
  });
  it('renders not-found for /xx', async () => {
    await renderAt('/xx');
    expect(await screen.findByText('Página não encontrada')).toBeTruthy();
    expect(screen.queryByText(/^home/)).toBeNull();
  });
});
