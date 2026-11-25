import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readSavedLocale } from '../../lib/locale';
import { preloadMessages, resetMessageCache } from '../../lib/messageCache';
import { RouteIntlProvider } from '../RouteIntlProvider';
import { LanguageSwitcher } from '.';

const renderAt = async (initialPath: string) => {
  // The real provider: it follows the URL and sets <html lang>.
  resetMessageCache();
  await preloadMessages('en');
  const rootRoute = createRootRoute({
    component: () => (
      <RouteIntlProvider>
        <LanguageSwitcher />
        <Outlet />
      </RouteIntlProvider>
    ),
  });
  const routes = ['/{-$locale}/farming', '/{-$locale}/farm/$id'].map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <p>page</p>,
    }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByText('page');
  return router;
};

afterEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'pt-BR';
});

describe('LanguageSwitcher', () => {
  it('should label the icon button in the active language', async () => {
    await renderAt('/farming');
    const button = screen.getByRole('button', { name: 'Idioma' });
    expect(button).toHaveAttribute('title', 'Idioma');
  });

  it('should label the icon button in English under /en', async () => {
    await renderAt('/en/farming');
    expect(screen.getByRole('button', { name: 'Language' })).toHaveAttribute(
      'title',
      'Language',
    );
  });

  it('should list both languages in their own language', async () => {
    await renderAt('/farming');
    await userEvent.setup().click(screen.getByRole('button'));
    expect(screen.getByRole('menuitem', { name: 'Português' })).toHaveAttribute(
      'lang',
      'pt-BR',
    );
    expect(screen.getByRole('menuitem', { name: 'English' })).toHaveAttribute(
      'lang',
      'en',
    );
  });

  it('should mark the active language for assistive tech', async () => {
    await renderAt('/en/farming');
    await userEvent.setup().click(screen.getByRole('button'));
    expect(screen.getByRole('menuitem', { name: 'English' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(
      screen.getByRole('menuitem', { name: 'Português' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('should switch to English keeping the search, save the choice and set lang', async () => {
    const router = await renderAt('/farming?tab=machines');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('menuitem', { name: 'English' }));
    expect(router.state.location.pathname).toBe('/en/farming');
    expect(router.state.location.search).toEqual({ tab: 'machines' });
    expect(readSavedLocale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('should switch to Portuguese keeping the id and save the choice', async () => {
    const router = await renderAt('/en/farm/plan-1');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('menuitem', { name: 'Português' }));
    expect(router.state.location.pathname).toBe('/farm/plan-1');
    expect(readSavedLocale()).toBe('pt-BR');
  });
});
