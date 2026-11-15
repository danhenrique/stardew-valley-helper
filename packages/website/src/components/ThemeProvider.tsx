import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { PropsWithChildren } from 'react';

/** Light/dark theme on the `<html>` class; follows the system until the player picks one. */
export const ThemeProvider = ({ children }: PropsWithChildren) => (
  <NextThemesProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
    // The inline theme script never runs in a client-rendered SPA (index.html
    // applies the class instead); a data block type keeps React from warning.
    scriptProps={{ type: 'application/json' }}
  >
    {children}
  </NextThemesProvider>
);
