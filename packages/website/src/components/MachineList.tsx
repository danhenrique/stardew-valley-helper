import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { EllipsisVerticalIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';
import type {
  GameDateIn,
  MachineBatchOut,
  MachineOut,
} from '../generated/stardew-valley-api/types.gen';
import {
  isMachineActionable,
  type MachineKind,
  machineBatchNames,
  nextMachineDate,
} from '../lib/machines';
import { EmptyPlantings } from './EmptyPlantings';
import { GameIcon } from './GameIcon';
import { MachineStatusBadge, UnavailableBadge } from './StatusBadge';
import { UnderlineTabs } from './UnderlineTabs';
import { type Labels, useLabels } from './useLabels';

// Adapted from Tailwind Plus lists/stacked-lists/06-with-badges-button-and-actions-menu.jsx
type MachineTab = 'all' | 'ready' | 'running';

type MachineListProps = {
  batches: readonly MachineBatchOut[];
  machines: readonly MachineOut[];
  /** Current game date, to find each batch's next date. */
  today: GameDateIn;
  onEdit: (batch: MachineBatchOut) => void;
  onRecollect: (batch: MachineBatchOut) => void;
  onRemove: (batch: MachineBatchOut) => void;
  /** Shows a button in the empty state that adds a machine. */
  onAdd?: () => void;
};

const MENU_ITEM =
  'block w-full px-3 py-1 text-left text-sm/6 text-gray-900 data-focus:bg-gray-50 data-focus:outline-hidden dark:text-white dark:data-focus:bg-white/5';

type Translate = ReturnType<typeof useTranslations<'machines.row'>>;

const relativeText = (
  kind: MachineKind | undefined,
  days: number,
  t: Translate,
): string => {
  if (kind === 'aging') return t('nextQuality', { days });
  if (kind === 'continuous') return t('nextCollection', { days });
  return t('readyIn', { days });
};

/** "Ready in 2 days (Summer 3, Year 1)": relative days plus the next absolute date (spec §8.2). */
const nextText = (
  batch: MachineBatchOut,
  schedule: NonNullable<MachineBatchOut['schedule']>,
  kind: MachineKind | undefined,
  today: GameDateIn,
  labels: Labels,
  t: Translate,
): string => {
  const { status, daysUntilNext } = schedule;
  if (status === 'ready') return t('ready');
  if (status === 'iridium') return t('iridium');
  if (daysUntilNext == null) return t('noForecast');
  const next = nextMachineDate(batch, today);
  const relative = relativeText(kind, daysUntilNext, t);
  return next
    ? t('withDate', { relative, date: labels.gameDate(next) })
    : relative;
};

const Dot = () => (
  <svg viewBox="0 0 2 2" className="size-0.5 fill-current">
    <circle r={1} cx={1} cy={1} />
  </svg>
);

export const MachineList = ({
  batches,
  machines,
  today,
  onEdit,
  onRecollect,
  onRemove,
  onAdd,
}: MachineListProps) => {
  const labels = useLabels();
  const locale = useLocale();
  const t = useTranslations('machines');
  const tRow = useTranslations('machines.row');
  const tCommon = useTranslations('common');
  const tabs: { id: MachineTab; label: string }[] = [
    { id: 'all', label: t('tabs.all') },
    { id: 'ready', label: t('tabs.ready') },
    { id: 'running', label: t('tabs.running') },
  ];
  const [tab, setTab] = useState<MachineTab>('all');
  const ready = batches.filter(isMachineActionable);
  // Invalid batches (no schedule) are neither ready nor running: they only show under "All".
  const running = batches.filter(
    (batch) => batch.schedule != null && !isMachineActionable(batch),
  );
  const shown = tab === 'all' ? batches : tab === 'ready' ? ready : running;

  return (
    <div>
      <div className="mb-4">
        <UnderlineTabs
          tabs={tabs}
          value={tab}
          counts={{
            all: batches.length,
            ready: ready.length,
            running: running.length,
          }}
          onChange={setTab}
          navLabel={t('tabs.nav')}
          selectLabel={t('tabs.choose')}
        />
      </div>
      {shown.length === 0 ? (
        <EmptyPlantings
          title={t(`emptyState.${tab}`)}
          description={
            tab === 'all'
              ? t('emptyState.firstDescription')
              : t('emptyState.otherDescription')
          }
          action={
            onAdd && tab === 'all'
              ? { label: t('new'), onClick: onAdd }
              : undefined
          }
        />
      ) : (
        <ul
          aria-label={t('list')}
          className="divide-y divide-gray-100 dark:divide-white/5"
        >
          {shown.map((batch) => {
            const names = machineBatchNames(batch, machines, locale);
            const quantity = batch.quantity ?? 1;
            const { schedule } = batch;
            return (
              <li
                key={batch.id}
                className="flex items-center justify-between gap-x-6 py-5"
              >
                <div className="flex min-w-0 items-center gap-x-3">
                  <GameIcon id={batch.machineId} label={names.machine} />
                  <div className="min-w-0">
                    <div className="flex items-start gap-x-3">
                      <p className="text-sm/6 font-semibold text-gray-900 dark:text-white">
                        {`${names.machine} → ${names.output}`}
                      </p>
                      {schedule ? (
                        <MachineStatusBadge status={schedule.status} />
                      ) : (
                        <UnavailableBadge />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs/5 text-gray-500 dark:text-gray-400">
                      {batch.label && (
                        <>
                          <p className="truncate">{batch.label}</p>
                          <Dot />
                        </>
                      )}
                      <p className="whitespace-nowrap">
                        {tRow('count', { quantity })}
                      </p>
                      <Dot />
                      <p className="truncate">
                        {tRow('started', {
                          date: labels.gameDate(batch.startedOn),
                        })}
                      </p>
                      {schedule && (
                        <>
                          <Dot />
                          <p className="truncate">
                            {nextText(
                              batch,
                              schedule,
                              names.kind,
                              today,
                              labels,
                              tRow,
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
                      <EllipsisVerticalIcon
                        aria-hidden="true"
                        className="size-5"
                      />
                    </MenuButton>
                    <MenuItems
                      transition
                      className="absolute right-0 z-10 mt-2 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg outline-1 outline-gray-900/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                    >
                      <MenuItem>
                        <button
                          type="button"
                          onClick={() => onEdit(batch)}
                          className={MENU_ITEM}
                        >
                          {tCommon('edit')}
                        </button>
                      </MenuItem>
                      {schedule && names.kind === 'batch' && (
                        <MenuItem>
                          <button
                            type="button"
                            onClick={() => onRecollect(batch)}
                            className={MENU_ITEM}
                          >
                            {t('refill')}
                          </button>
                        </MenuItem>
                      )}
                      <MenuItem>
                        <button
                          type="button"
                          onClick={() => onRemove(batch)}
                          className={MENU_ITEM}
                        >
                          {t('empty')}
                        </button>
                      </MenuItem>
                    </MenuItems>
                  </Menu>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
