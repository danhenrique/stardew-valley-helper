import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { useAuth } from 'react-oidc-context';
import { AppShell } from '../components/AppShell';
import { GameDayNavContainer } from '../components/GameDayNavContainer';
import { NotificationsProvider } from '../components/Notifications';
import type { RouterProviderContext } from '../main';

const RootLayout = () => {
  const { user, removeUser, signoutRedirect, clearStaleState } = useAuth();
  const signOut = () => {
    removeUser();
    signoutRedirect({
      post_logout_redirect_uri: window.location.origin,
      extraQueryParams: {
        redirect_uri: window.location.origin,
        response_type: 'code',
      },
    });
    clearStaleState();
  };
  const userName = user?.profile?.['cognito:username'];

  return (
    <NotificationsProvider>
      <AppShell
        userName={typeof userName === 'string' ? userName : undefined}
        onSignOut={signOut}
        dayNav={<GameDayNavContainer />}
      >
        <Outlet />
      </AppShell>
    </NotificationsProvider>
  );
};

export const Route = createRootRouteWithContext<RouterProviderContext>()({
  component: RootLayout,
});
