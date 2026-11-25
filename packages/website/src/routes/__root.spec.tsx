import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useTranslations } from 'use-intl';
import { readSavedLocale, resetMemoryLocale, saveLocale } from '../lib/locale';
import { resetMessageCache } from '../lib/messageCache';
import { loadMessages } from '../lib/messages';
import { routeTree } from '../routeTree.gen';

vi.mock('../lib/messages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/messages')>();
  return { ...actual, loadMessages: vi.fn(actual.loadMessages) };
});

vi.mock('react-oidc-context', () => ({
  useAuth: () => ({
    user: undefined,
    removeUser: vi.fn(),
    signoutRedirect: vi.fn(),
    clearStaleState: vi.fn(),
  }),
}));
// The shell renders a probe that translates, proving it is inside the intl provider.
vi.mock('../components/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => {
    const t = useTranslations('notFound');
    return (
      <>
        <span>shell: {t('title')}</span>
        {children}
      </>
    );
  },
}));
vi.mock('../components/GameDayNavContainer', () => ({
  GameDayNavContainer: () => null,
}));
// The pages fetch game data; the locale tests only need the layout.
vi.mock('./{-$locale}/index', async () => {
  const { createFileRoute } = await import('@tanstack/react-router');
  return {
    Route: createFileRoute('/{-$locale}/')({ component: () => <p>home</p> }),
  };
});
vi.mock('../components/Notifications', () => ({
  NotificationsProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const stubLanguages = (languages: string[]) =>
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);

beforeEach(() => {
  localStorage.clear();
  stubLanguages(['pt-BR']);
});
afterEach(() => {
  localStorage.clear();
  resetMemoryLocale();
});

const load = async (path: string) => {
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history });
  await router.load();
  return { router, history };
};

describe('legacy Portuguese URLs in the app route tree', () => {
  it('should redirect a one-segment-plus-id path before the locale check', async () => {
    const { router, history } = await load('/lojas/blacksmith');
    expect(router.state.location.pathname).toBe('/shops/blacksmith');
    expect(router.state.matches.at(-1)?.routeId).toBe('/{-$locale}/shops/$id');
    expect(history.length).toBe(1);
  });

  it('should redirect a bare one-segment path instead of a locale 404', async () => {
    const { router, history } = await load('/sementes');
    expect(router.state.location.pathname).toBe('/seeds');
    expect(router.state.matches.at(-1)?.routeId).toBe('/{-$locale}/seeds');
    expect(history.length).toBe(1);
  });

  it('should keep the old redirect targets and the tab', async () => {
    const { router } = await load('/maquinas');
    expect(router.state.location.pathname).toBe('/farming');
    expect(router.state.location.search).toEqual({ tab: 'machines' });
  });

  it('should keep "/xx" as not found', async () => {
    const { router } = await load('/xx');
    expect(router.state.location.pathname).toBe('/xx');
  });

  it.each(['/xx', '/xx/seeds'])(
    'should render the not-found page for "%s" with the real route tree',
    async (path) => {
      const history = createMemoryHistory({ initialEntries: [path] });
      const router = createRouter({ routeTree, history });
      render(<RouterProvider router={router} />);
      expect(await screen.findByText('Página não encontrada')).toBeTruthy();
    },
  );
});

const renderAt = (path: string) => {
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history });
  render(<RouterProvider router={router} />);
  return router;
};

describe('root intl provider', () => {
  beforeEach(() => {
    resetMessageCache();
  });
  afterEach(() => {
    document.documentElement.lang = 'pt-BR';
  });

  it('should translate the shell in English under /en', async () => {
    renderAt('/en');
    expect(await screen.findByText('home')).toBeTruthy();
    expect(screen.getByText('shell: Page not found')).toBeTruthy();
  });

  it('should translate the shell in Portuguese at /', async () => {
    renderAt('/');
    expect(await screen.findByText('home')).toBeTruthy();
    expect(screen.getByText('shell: Página não encontrada')).toBeTruthy();
  });

  it('should render the not-found page in English under /en', async () => {
    renderAt('/en/xx-unknown');
    expect(await screen.findByText('Page not found')).toBeTruthy();
    expect(screen.getByText('shell: Page not found')).toBeTruthy();
  });

  it('should render the not-found page in Portuguese for an unknown locale', async () => {
    renderAt('/xx');
    expect(await screen.findByText('Página não encontrada')).toBeTruthy();
    expect(screen.getByText('shell: Página não encontrada')).toBeTruthy();
  });

  it('should set the html lang to en under /en', async () => {
    renderAt('/en');
    expect(await screen.findByText('home')).toBeTruthy();
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
  });

  it('should set the html lang to pt-BR at /', async () => {
    document.documentElement.lang = 'en';
    renderAt('/');
    expect(await screen.findByText('home')).toBeTruthy();
    await waitFor(() => expect(document.documentElement.lang).toBe('pt-BR'));
  });

  it('should switch language and lang when navigating between / and /en without reloading', async () => {
    const router = renderAt('/');
    expect(
      await screen.findByText('shell: Página não encontrada'),
    ).toBeTruthy();
    await act(() => router.navigate({ to: '/en' }));
    expect(await screen.findByText('shell: Page not found')).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
    // Opening /en remembered English; choosing Portuguese (as the switcher does) overrides it.
    saveLocale('pt-BR');
    await act(() => router.navigate({ to: '/' }));
    expect(
      await screen.findByText('shell: Página não encontrada'),
    ).toBeTruthy();
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('should fall back to Portuguese instead of a blank page when English fails to load', async () => {
    vi.mocked(loadMessages).mockRejectedValueOnce(new Error('chunk failed'));
    const router = renderAt('/en');
    expect(await screen.findByText('home')).toBeTruthy();
    expect(screen.getByText('shell: Página não encontrada')).toBeTruthy();
    expect(document.documentElement.lang).toBe('pt-BR');
    // The next navigation retries the load.
    await act(() => router.navigate({ to: '/en/xx-unknown' }));
    expect(await screen.findByText('shell: Page not found')).toBeTruthy();
  });
});

describe('language detection and remembered choice', () => {
  beforeEach(() => {
    resetMessageCache();
  });

  it('should redirect to /en with a replaced history entry for an English browser', async () => {
    stubLanguages(['en-US']);
    const { router, history } = await load('/seeds');
    expect(router.state.location.pathname).toBe('/en/seeds');
    expect(history.length).toBe(1);
  });

  it('should keep the search when redirecting', async () => {
    stubLanguages(['en-US']);
    const { router } = await load('/farming?tab=machines');
    expect(router.state.location.pathname).toBe('/en/farming');
    expect(router.state.location.search).toEqual({ tab: 'machines' });
  });

  it('should send a legacy Portuguese URL straight to the English target', async () => {
    stubLanguages(['en-US']);
    const { router } = await load('/lojas/blacksmith');
    expect(router.state.location.pathname).toBe('/en/shops/blacksmith');
  });

  it('should stay on the Portuguese URL when pt-BR is saved', async () => {
    stubLanguages(['en-US']);
    localStorage.setItem('stardew.locale', 'pt-BR');
    const { router } = await load('/seeds');
    expect(router.state.location.pathname).toBe('/seeds');
  });

  it('should redirect a saved English choice even for a Portuguese browser', async () => {
    localStorage.setItem('stardew.locale', 'en');
    const { router } = await load('/shops/blacksmith?x=1');
    expect(router.state.location.pathname).toBe('/en/shops/blacksmith');
    expect(router.state.location.search).toEqual({ x: 1 });
  });

  it('should fall back to the browser language when storage throws', async () => {
    stubLanguages(['en-US']);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { router } = await load('/seeds');
    expect(router.state.location.pathname).toBe('/en/seeds');
  });

  it('should keep a Portuguese choice for an English browser when storage throws', async () => {
    stubLanguages(['en-US']);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    saveLocale('pt-BR');
    const { router } = await load('/seeds');
    expect(router.state.location.pathname).toBe('/seeds');
  });

  it('should save en when an explicit English URL is opened', async () => {
    await load('/en/fish');
    expect(readSavedLocale()).toBe('en');
  });

  it('should not save anything for an unprefixed URL', async () => {
    await load('/fish');
    expect(readSavedLocale()).toBeNull();
  });
});
