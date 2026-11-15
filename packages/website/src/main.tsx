import { createRouter, RouterProvider } from '@tanstack/react-router';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { useAuth } from 'react-oidc-context';
import CognitoAuth from './components/CognitoAuth';
import QueryClientProvider from './components/QueryClientProvider';
import RuntimeConfigProvider from './components/RuntimeConfig';
import StardewValleyApiProvider from './components/StardewValleyApiProvider';
import { ThemeProvider } from './components/ThemeProvider';
import { useRuntimeConfig } from './hooks/useRuntimeConfig';
import { routeTree } from './routeTree.gen';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type RouterProviderContext = {
  runtimeConfig?: ReturnType<typeof useRuntimeConfig>;
  auth?: ReturnType<typeof useAuth>;
};

const router = createRouter({
  routeTree,
  context: { runtimeConfig: undefined, auth: undefined },
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const App = () => {
  const auth = useAuth();
  const runtimeConfig = useRuntimeConfig();
  return <RouterProvider router={router} context={{ runtimeConfig, auth }} />;
};

const root = document.getElementById('root');
root &&
  createRoot(root).render(
    <React.StrictMode>
      <ThemeProvider>
        <RuntimeConfigProvider>
          <CognitoAuth>
            <QueryClientProvider>
              <StardewValleyApiProvider>
                <App />
              </StardewValleyApiProvider>
            </QueryClientProvider>
          </CognitoAuth>
        </RuntimeConfigProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
