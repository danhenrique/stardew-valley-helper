const TAB_BY_LEGACY_TAB: Record<string, string> = {
  plantios: 'plantings',
  maquinas: 'machines',
  calendario: 'calendar',
  eventos: 'events',
};

/** Old single-segment paths and their English targets; `tab` is the tab the old path implied. */
const LEGACY_ROOTS: Record<string, { to: string; tab?: string }> = {
  producao: { to: 'farming' },
  fazenda: { to: 'farm' },
  sementes: { to: 'seeds' },
  peixes: { to: 'fish' },
  calendario: { to: 'calendar' },
  lojas: { to: 'shops' },
  eventos: { to: 'events' },
  maquinas: { to: 'farming', tab: 'machines' },
  plantios: { to: 'farming', tab: 'plantings' },
};

/** Own-key lookup, so inherited keys such as `constructor` or `__proto__` never match. */
const own = <T>(table: Record<string, T>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;

export type LegacyRedirect = { to: string; search: Record<string, unknown> };

/**
 * Maps an old Portuguese URL to its English equivalent, or returns `null` when the path is not legacy.
 * A trailing slash is ignored, ids are kept as they are and the old `aba` param becomes `tab`.
 */
export const legacyRedirect = (
  pathname: string,
  search: Record<string, unknown>,
): LegacyRedirect | null => {
  const [root, ...rest] = pathname.split('/').filter(Boolean);
  const target = root === undefined ? undefined : own(LEGACY_ROOTS, root);
  if (!target) return null;

  const { aba, ...others } = search;
  const out: Record<string, unknown> = { ...others };
  const tab =
    target.tab ??
    (rest.length === 0 && typeof aba === 'string'
      ? own(TAB_BY_LEGACY_TAB, aba)
      : undefined);
  if (tab) out.tab = tab;
  // `/eventos` alone is the events tab of the calendar; `/eventos/<id>` is an event.
  if (root === 'eventos' && rest.length === 0) {
    return { to: '/calendar', search: { ...out, tab: 'events' } };
  }
  return { to: `/${[target.to, ...rest].join('/')}`, search: out };
};
