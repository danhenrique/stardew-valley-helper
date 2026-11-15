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
import { AppShell } from '.';

const renderShell = async (onSignOut = vi.fn()) => {
  const rootRoute = createRootRoute({
    component: () => (
      <AppShell
        userName="Jogador"
        onSignOut={onSignOut}
        dayNav={<p>controle do dia</p>}
      >
        <Outlet />
      </AppShell>
    ),
  });
  const routes = ['/', '/sementes'].map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <p>page {path}</p>,
    }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByText('page /');
  return onSignOut;
};

describe('AppShell', () => {
  it('should show navigation links in order when rendered', async () => {
    await renderShell();
    const desktop = screen
      .getAllByRole('link')
      .slice(0, 8)
      .map((link) => link.textContent);
    expect(desktop).toEqual([
      'Hoje',
      'Plantios',
      'Máquinas',
      'Sementes',
      'Peixes',
      'Calendário',
      'Eventos',
      'Lojas',
    ]);
    expect(screen.getAllByRole('link', { name: 'Hoje' })[0]).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getAllByRole('link', { name: 'Plantios' })[0],
    ).toHaveAttribute('href', '/plantios');
    expect(
      screen.getAllByRole('link', { name: 'Máquinas' })[0],
    ).toHaveAttribute('href', '/maquinas');
    expect(
      screen.getAllByRole('link', { name: 'Sementes' })[0],
    ).toHaveAttribute('href', '/sementes');
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
