import { MagnifyingGlassIcon } from '@heroicons/react/16/solid';
import { ChevronDownIcon, CubeIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { Fragment, useId, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';
import type { Catalog, PlannerObjectDef } from '../../lib/farmPlanner/types';
import { GameIcon } from '../GameIcon';
import { useLabels } from '../useLabels';
import {
  CATEGORY_LABELS,
  type PaletteGroup,
  paletteGroups,
} from './paletteGroups';

const COLLAPSED_KEY = 'farmPlanner.paletteCollapsed';

/** Collapsed group ids from localStorage; anything unreadable means every group open. */
const readCollapsed = (): Set<string> => {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(COLLAPSED_KEY) ?? '[]',
    );
    return new Set(
      Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [],
    );
  } catch {
    return new Set();
  }
};

const writeCollapsed = (ids: Set<string>) => {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage blocked or full: the state just lasts for this visit.
  }
};

const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Matches the localized name or the id (so English terms like "spr" still find sprinklers). */
const matches = (def: PlannerObjectDef, query: string) =>
  normalize(def.name).includes(query) || def.id.includes(query);

type PaletteProps = {
  catalog: Catalog;
  activeId: string | undefined;
  onPick: (id: string) => void;
};

/** Search plus the placeable objects (fixed ones are left out) in collapsible groups by type. */
export function Palette({ catalog, activeId, onPick }: PaletteProps) {
  const labels = useLabels();
  const t = useTranslations('farmPlanner.palette');
  const locale = useLocale();
  const searchId = useId();
  const groupIdPrefix = useId();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const query = normalize(search.trim());

  const groups = useMemo(() => {
    const collator = new Intl.Collator(locale);
    const defs = [...catalog.values()]
      // Fixed objects (farmhouse, greenhouse, …) are unique: they can be moved, never added.
      .filter((def) => def.removable && (!query || matches(def, query)))
      .sort((a, b) => collator.compare(a.name, b.name));
    return paletteGroups(defs);
  }, [catalog, query, locale]);

  const toggle = (id: string) => {
    const next = new Set(collapsed);
    if (!next.delete(id)) next.add(id);
    setCollapsed(next);
    writeCollapsed(next);
  };
  // While searching, every group with matches is open, whatever was stored.
  const isOpen = (group: PaletteGroup) => !!query || !collapsed.has(group.id);

  return (
    <section aria-label={t('label')} className="flex min-h-0 flex-col gap-4">
      {/* Adapted from Tailwind Plus forms/input-groups/07-input-with-leading-icon.jsx
          with the hidden label of 05-input-with-hidden-label.jsx. */}
      <div>
        <label htmlFor={searchId} className="sr-only">
          {t('search')}
        </label>
        <div className="grid grid-cols-1">
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('search')}
            className="col-start-1 row-start-1 block w-full rounded-md bg-white py-1.5 pr-3 pl-10 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 sm:pl-9 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-green-500"
          />
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-gray-400 sm:size-4 dark:text-gray-500"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {groups.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('empty')}
          </p>
        )}
        {groups.map((group, index) => {
          const open = isOpen(group);
          const listId = `${groupIdPrefix}-${group.id}`;
          const categoryLabel = CATEGORY_LABELS[group.category];
          // Categories split into sub-groups keep their own heading above them.
          const firstOfCategory =
            groups[index - 1]?.category !== group.category;
          return (
            <Fragment key={group.id}>
              {firstOfCategory && group.label.key !== categoryLabel.key && (
                <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  {labels.text(categoryLabel)}
                </h3>
              )}
              <div>
                {/* Adapted from Tailwind Plus navigation/sidebar-navigation/03-with-expandable-sections.jsx. */}
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => toggle(group.id)}
                  className="group flex w-full items-center gap-x-2 rounded-md px-2 py-1 text-left text-sm/6 font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  <ChevronDownIcon
                    aria-hidden="true"
                    className={clsx(
                      'size-5 shrink-0 text-gray-400 transition-transform dark:text-gray-500',
                      !open && '-rotate-90',
                    )}
                  />
                  {labels.text(group.label)}
                </button>
                <ul id={listId} hidden={!open} className="mt-1 space-y-0.5">
                  {group.defs.map((def) => {
                    const active = def.id === activeId;
                    return (
                      <li key={def.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => onPick(def.id)}
                          className={clsx(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                            active
                              ? 'bg-green-50 font-semibold text-green-700 dark:bg-green-500/20 dark:text-green-300'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5',
                          )}
                        >
                          <GameIcon
                            id={def.icon ?? def.id}
                            label={def.name}
                            decorative
                            fallback={CubeIcon}
                          />
                          <span className="truncate">{def.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
