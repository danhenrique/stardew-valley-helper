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
import { localeFromPathname } from '../../lib/locale';
import { IntlTestProvider } from '../renderWithIntl';
import { AppShell } from '.';

const renderShell = async (onSignOut = vi.fn(), initialPath = '/') => {
  const rootRoute = createRootRoute({
    component: () => (
      <IntlTestProvider locale={localeFromPathname(initialPath)}>
        <AppShell
          userName="Jogador"
          onSignOut={onSignOut}
          dayNav={<p>controle do dia</p>}
        >
          <Outlet />
        </AppShell>
      </IntlTestProvider>
    ),
  });
  const routes = ['/', '/{-$locale}/seeds', '/{-$locale}/farming'].map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <p>page {path.replace('/{-$locale}', '')}</p>,
    }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByText(
    `page ${initialPath.split('?')[0].replace(/^\/en(?=\/)/, '')}`,
  );
  return onSignOut;
};

describe('AppShell', () => {
  it('should show navigation links in order when rendered', async () => {
    await renderShell();
    const desktop = screen
      .getAllByRole('link')
      .slice(0, 7)
      .map((link) => link.textContent);
    expect(desktop).toEqual([
      'Hoje',
      'Produção',
      'Fazenda',
      'Sementes',
      'Peixes',
      'Calendário',
      'Lojas',
    ]);
    expect(screen.queryByRole('link', { name: 'Eventos' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Hoje' })[0]).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getAllByRole('link', { name: 'Produção' })[0],
    ).toHaveAttribute('href', '/farming');
    expect(
      screen.getAllByRole('link', { name: 'Sementes' })[0],
    ).toHaveAttribute('href', '/seeds');
  });

  it('should keep the open tab in the link of the current page', async () => {
    await renderShell(vi.fn(), '/farming?tab=machines');
    expect(
      screen.getAllByRole('link', { name: 'Produção' })[0],
    ).toHaveAttribute('href', '/farming?tab=machines');
    expect(
      screen.getAllByRole('link', { name: 'Sementes' })[0],
    ).toHaveAttribute('href', '/seeds');
  });

  it('should mark Produção as current on any of its tabs', async () => {
    await renderShell(vi.fn(), '/farming?tab=machines');
    expect(
      screen.getAllByRole('link', { name: 'Produção' })[0],
    ).toHaveAttribute('aria-current', 'page');
  });

  it('should mark the current page when route matches', async () => {
    await renderShell();
    expect(screen.getAllByRole('link', { name: 'Hoje' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('should show the data license notice when rendered', async () => {
    await renderShell();
    expect(screen.getByText(/ConcernedApe LLC/)).toBeInTheDocument();
    expect(
      screen.getByText(/Site de fã, sem fins comerciais/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Imagens usadas sem fins comerciais/),
    ).toBeInTheDocument();
  });

  it('should show the day control on desktop and in the mobile strip', async () => {
    await renderShell();
    expect(screen.getAllByText('controle do dia')).toHaveLength(2);
  });

  it('should show the theme toggle when rendered', async () => {
    await renderShell();
    expect(
      screen.getAllByRole('button', { name: /^Tema automático/ }).length,
    ).toBeGreaterThan(0);
  });

  it('should call sign out when user picks Sair in the user menu', async () => {
    const onSignOut = await renderShell();
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Abrir menu do usuário' })[0],
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Sair' }),
    );
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});

describe('AppShell under the en locale', () => {
  it('should keep the en prefix in the links and mark the current page', async () => {
    await renderShell(vi.fn(), '/en/farming?tab=machines');
    const farming = screen.getAllByRole('link', { name: 'Farming' })[0];
    expect(farming).toHaveAttribute('href', '/en/farming?tab=machines');
    expect(farming).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { name: 'Seeds' })[0]).toHaveAttribute(
      'href',
      '/en/seeds',
    );
    expect(screen.getAllByRole('link', { name: 'Today' })[0]).toHaveAttribute(
      'href',
      '/en',
    );
  });
});

describe('AppShell in English', () => {
  it('should show the navigation, the user menu and the notice in English', async () => {
    await renderShell(vi.fn(), '/en/farming');
    expect(
      screen
        .getAllByRole('link')
        .slice(0, 7)
        .map((link) => link.textContent),
    ).toEqual([
      'Today',
      'Farming',
      'Farm',
      'Seeds',
      'Fish',
      'Calendar',
      'Shops',
    ]);
    expect(
      screen.getAllByRole('button', { name: 'Open user menu' })[0],
    ).toHaveAttribute('title', 'Open user menu');
    expect(
      screen.getAllByRole('button', { name: /^Automatic theme/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Fan site, not for profit/)).toBeInTheDocument();
  });
});
