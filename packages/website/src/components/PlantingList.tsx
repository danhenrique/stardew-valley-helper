import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { EllipsisVerticalIcon } from '@heroicons/react/20/solid';
import { useTranslations } from 'use-intl';
import type { PlantingOut } from '../generated/stardew-valley-api/types.gen';
import { message } from '../lib/message';
import { EmptyPlantings } from './EmptyPlantings';
import { GameIcon } from './GameIcon';
import { StatusBadge, UnavailableBadge } from './StatusBadge';
import { type Labels, useLabels } from './useLabels';

// Adapted from Tailwind Plus lists/stacked-lists/06-with-badges-button-and-actions-menu.jsx
type PlantingListProps = {
  plantings: readonly PlantingOut[];
  names: Record<string, string>;
  onEdit: (planting: PlantingOut) => void;
  onReplant: (planting: PlantingOut) => void;
  onRemove: (planting: PlantingOut) => void;
  canReplant: (planting: PlantingOut) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
};

const MENU_ITEM =
  'block w-full px-3 py-1 text-left text-sm/6 text-gray-900 data-focus:bg-gray-50 data-focus:outline-hidden dark:text-white dark:data-focus:bg-white/5';

type Translate = ReturnType<typeof useTranslations<'plantings'>>;

const nextHarvestText = (
  schedule: NonNullable<PlantingOut['schedule']>,
  t: Translate,
  labels: Labels,
): string => {
  const { status, daysUntilNext } = schedule;
  if (status === 'ready') return t('row.readyToday');
  if (status === 'dead') return t('row.dead');
  if (status === 'finished') return t('row.finished');
  if (daysUntilNext == null) return labels.text(message('labels.neverMatures'));
  return t('row.nextIn', { days: daysUntilNext });
};

const startText = (
  planting: PlantingOut,
  t: Translate,
  labels: Labels,
): string =>
  planting.anchor === 'harvested' && planting.lastHarvestOn
    ? t('row.harvested', { date: labels.gameDate(planting.lastHarvestOn) })
    : planting.plantedOn
      ? t('row.planted', { date: labels.gameDate(planting.plantedOn) })
      : '';

export const PlantingList = ({
  plantings,
  names,
  onEdit,
  onReplant,
  onRemove,
  canReplant,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: PlantingListProps) => {
  const labels = useLabels();
  const t = useTranslations('plantings');
  const tCommon = useTranslations('common');
  if (plantings.length === 0)
    return (
      <EmptyPlantings
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );

  return (
    <ul
      aria-label={t('list')}
      className="divide-y divide-gray-100 dark:divide-white/5"
    >
      {plantings.map((planting) => {
        const name =
          planting.label || names[planting.seedId] || planting.seedId;
        // Invalid planting (seed left the game data): no schedule, only Edit and Remove.
        const { schedule } = planting;
        return (
          <li
            key={planting.id}
            className="flex items-center justify-between gap-x-6 py-5"
          >
            <div className="flex min-w-0 items-center gap-x-3">
              <GameIcon id={planting.seedId} label={name} />
              <div className="min-w-0">
                <div className="flex items-start gap-x-3">
                  <p className="text-sm/6 font-semibold text-gray-900 dark:text-white">
                    {name}
                  </p>
                  {schedule ? (
                    <StatusBadge status={schedule.status} />
                  ) : (
                    <UnavailableBadge />
                  )}
                  {/* Location badge adapted from Tailwind Plus elements/badges/09-flat-pill.jsx */}
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-400/10 dark:text-gray-400">
                    {labels.location(planting.location ?? 'farm')}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs/5 text-gray-500 dark:text-gray-400">
                  <p className="whitespace-nowrap">
                    {t('row.units', { quantity: planting.quantity ?? 0 })}
                  </p>
                  <svg viewBox="0 0 2 2" className="size-0.5 fill-current">
                    <circle r={1} cx={1} cy={1} />
                  </svg>
                  <p className="truncate">{startText(planting, t, labels)}</p>
                  {schedule && (
                    <>
                      <svg viewBox="0 0 2 2" className="size-0.5 fill-current">
                        <circle r={1} cx={1} cy={1} />
                      </svg>
                      <p className="truncate">
                        {nextHarvestText(schedule, t, labels)}
                      </p>
                      <svg viewBox="0 0 2 2" className="size-0.5 fill-current">
                        <circle r={1} cx={1} cy={1} />
                      </svg>
                      <p className="truncate">
                        {labels.expectedYield(
                          schedule.yieldPerHarvest,
                          schedule.expectedTotalYield,
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-none items-center gap-x-4">
              <Menu as="div" className="relative flex-none">
                <MenuButton
                  aria-label={tCommon('moreActions')}
                  title={tCommon('moreActions')}
                  className="relative block rounded-md text-gray-500 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:text-gray-400 dark:hover:text-white"
                >
                  <span className="absolute -inset-2.5" />
                  <EllipsisVerticalIcon aria-hidden="true" className="size-5" />
                </MenuButton>
                <MenuItems
                  transition
                  className="absolute right-0 z-10 mt-2 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg outline-1 outline-gray-900/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                >
                  <MenuItem>
                    <button
                      type="button"
                      onClick={() => onEdit(planting)}
                      className={MENU_ITEM}
                    >
                      {tCommon('edit')}
                    </button>
                  </MenuItem>
                  {schedule && canReplant(planting) && (
                    <MenuItem>
                      <button
                        type="button"
                        onClick={() => onReplant(planting)}
                        className={MENU_ITEM}
                      >
                        {t('replant')}
                      </button>
                    </MenuItem>
                  )}
                  <MenuItem>
                    <button
                      type="button"
                      onClick={() => onRemove(planting)}
                      className={MENU_ITEM}
                    >
                      {t('remove')}
                    </button>
                  </MenuItem>
                </MenuItems>
              </Menu>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
