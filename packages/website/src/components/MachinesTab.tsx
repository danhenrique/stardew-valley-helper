import { useState } from 'react';
import { useTranslations } from 'use-intl';
import type { MachineBatchOut } from '../generated/stardew-valley-api/types.gen';
import { useMachines, useMe } from '../hooks/useGameData';
import { useMachineActions } from '../hooks/useMachineActions';
import { MachineCalendar } from './MachineCalendar';
import { MachineDrawer } from './MachineDrawer';
import { MachineList } from './MachineList';
import { SkeletonPage } from './Skeleton';
import { CARD } from './styles';

/** The player machines with their drawer and calendar. */
export function MachinesTab() {
  const t = useTranslations('machines');
  const tFarming = useTranslations('farming');
  const me = useMe();
  const machines = useMachines();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<MachineBatchOut | null>(null);
  // Hooks run before the loading guards; the fallback date is never used for an action.
  const actions = useMachineActions(
    me.data?.profile.currentDate ?? { year: 1, season: 'spring', day: 1 },
  );

  const profile = me.data?.profile;
  if (me.isPending || machines.isPending) {
    return <SkeletonPage label={t('loading')} />;
  }
  if (me.isError || machines.isError || !profile) {
    return (
      <p className="text-sm text-red-700 dark:text-red-400">
        {tFarming('loadError')}
      </p>
    );
  }

  const openDrawer = (batch: MachineBatchOut | null) => {
    setEditing(batch);
    setDrawerOpen(true);
  };
  const shown = (me.data.machines ?? []).filter(
    (batch) => !actions.removing.has(batch.id),
  );
  const recollect = (batch: MachineBatchOut) => {
    if (!actions.recollecting.has(batch.id)) actions.recollect(batch);
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => openDrawer(null)}
          className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:bg-green-500 dark:hover:bg-green-400"
        >
          {t('add')}
        </button>
      </div>
      <section className={CARD}>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">
          {t('mine')}
        </h2>
        <div className="mt-2">
          <MachineList
            batches={shown}
            machines={machines.data}
            today={profile.currentDate}
            onEdit={openDrawer}
            onRecollect={recollect}
            onRemove={actions.remove}
            onAdd={() => openDrawer(null)}
          />
        </div>
      </section>
      <section className="overflow-hidden rounded-lg bg-white shadow-sm outline outline-black/5 dark:bg-gray-800/50 dark:outline-white/10">
        <MachineCalendar
          batches={shown}
          machines={machines.data}
          today={profile.currentDate}
        />
      </section>
      <MachineDrawer
        open={drawerOpen}
        editing={editing}
        profile={profile}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
