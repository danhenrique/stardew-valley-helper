import {
  createRootRouteWithContext,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { useAuth } from 'react-oidc-context';
import { AppShell } from '../components/AppShell';
import { GameDayNavContainer } from '../components/GameDayNavContainer';
import { NotFoundPage } from '../components/NotFoundPage';
import { NotificationsProvider } from '../components/Notifications';
import { RouteIntlProvider } from '../components/RouteIntlProvider';
import { legacyRedirect } from '../lib/legacyRoutes';
import {
  detectLocale,
  localeFromPathname,
  localeRedirect,
  readSavedLocale,
} from '../lib/locale';
import { preloadMessages } from '../lib/messageCache';
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
    <RouteIntlProvider>
      <NotificationsProvider>
        <AppShell
          userName={typeof userName === 'string' ? userName : undefined}
          onSignOut={signOut}
          dayNav={<GameDayNavContainer />}
        >
          <Outlet />
        </AppShell>
      </NotificationsProvider>
    </RouteIntlProvider>
  );
};

export const Route = createRootRouteWithContext<RouterProviderContext>()({
  // Runs before the child routes' beforeLoad, so `/lojas` is redirected instead of
  // being read as an unknown locale by the optional `{-$locale}` segment.
  // Then sends unprefixed URLs to the remembered or detected language.
  // Then waits for the messages of the URL's locale (instant once loaded, and for the default
  // locale), so a language switch renders the new language without a loading flash.
  beforeLoad: async ({ location }) => {
    const target = legacyRedirect(location.pathname, location.search);
    if (target) throw redirect({ ...target, replace: true });
    const redirectTo = localeRedirect(
      location.pathname,
      location.search,
      detectLocale(readSavedLocale(), navigator.languages),
    );
    if (redirectTo) throw redirect({ ...redirectTo, replace: true });
    await preloadMessages(localeFromPathname(location.pathname));
  },
  component: RootLayout,
  // Rendered inside RootLayout's Outlet, so it shares the root provider.
  notFoundComponent: NotFoundPage,
});
