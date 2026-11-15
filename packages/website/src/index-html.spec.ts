import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Runs the inline theme script from index.html, which must apply the dark
// class before React mounts to avoid a light flash for dark-mode visitors.
const runThemeScript = (prefersDark: boolean) => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script, 'inline theme script').toBeTruthy();
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: prefersDark,
  } as MediaQueryList);
  new Function(script as string)();
};

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('index.html theme script', () => {
  it('should apply a stored dark theme', () => {
    localStorage.setItem('theme', 'dark');
    runThemeScript(false);
    expect(document.documentElement).toHaveClass('dark');
  });

  it('should respect a stored light theme over the system preference', () => {
    localStorage.setItem('theme', 'light');
    runThemeScript(true);
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('should follow the system preference when automatic is stored', () => {
    localStorage.setItem('theme', 'system');
    runThemeScript(true);
    expect(document.documentElement).toHaveClass('dark');
  });

  it('should follow the system preference when nothing is stored', () => {
    runThemeScript(false);
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
