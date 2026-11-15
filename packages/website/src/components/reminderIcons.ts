import {
  BellIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  SparklesIcon,
  SunIcon,
  TvIcon,
} from '@heroicons/react/20/solid';

/** Fallback icon of each reminder by id, used when it has no game sprite; ids without an entry use `BellIcon`. */
export const REMINDER_ICONS: Record<string, typeof BellIcon> = {
  'traveling-cart': ShoppingCartIcon,
  'krobus-sprinkler': BuildingStorefrontIcon,
  'desert-trader-staircase': BuildingStorefrontIcon,
  'queen-of-sauce-new': TvIcon,
  'queen-of-sauce-rerun': TvIcon,
  'special-orders': ClipboardDocumentListIcon,
  'forage-weekly': SunIcon,
  'buy-seeds': SparklesIcon,
};
