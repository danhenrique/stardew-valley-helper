import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from 'next-themes';
import { useTranslations } from 'use-intl';

type ThemeChoice = 'system' | 'light' | 'dark';

const CHOICES: Record<
  ThemeChoice,
  { next: ThemeChoice; Icon: typeof SunIcon }
> = {
  system: {
    next: 'light',
    Icon: ComputerDesktopIcon,
  },
  light: {
    next: 'dark',
    Icon: SunIcon,
  },
  dark: {
    next: 'system',
    Icon: MoonIcon,
  },
};

const toChoice = (theme: string | undefined): ThemeChoice =>
  theme === 'light' || theme === 'dark' ? theme : 'system';

/** Icon button that cycles automatic → light → dark; the icon shows the current mode. */
export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('theme');
  const choice = toChoice(theme);
  const { next, Icon } = CHOICES[choice];
  const label = t(choice);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
      className="relative rounded-full p-1 text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:hover:text-white"
    >
      <span className="absolute -inset-1.5" />
      <Icon aria-hidden="true" className="size-6" />
    </button>
  );
};
