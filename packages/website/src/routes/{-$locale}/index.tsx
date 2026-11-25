import { createFileRoute } from '@tanstack/react-router';
import { CloudRain } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { machineCatalogStatus } from '../../components/MachineCatalogNotice';
import { MachineDrawer } from '../../components/MachineDrawer';
import { OpenShops } from '../../components/OpenShops';
import { PlantingDrawer } from '../../components/PlantingDrawer';
import { RainFishModal } from '../../components/RainFishModal';
import {
  Skeleton,
  SkeletonCardBody,
  SkeletonDays,
} from '../../components/Skeleton';
import { TodayList } from '../../components/TodayList';
import { TodayReminders } from '../../components/TodayReminders';
import { UpcomingDays } from '../../components/UpcomingDays';
import {
  useFixedEvents,
  useMachines,
  useMe,
  usePlantables,
  useReminders,
  useShops,
} from '../../hooks/useGameData';
import { usePlantableNames } from '../../hooks/usePlantableNames';

// Adapted from Tailwind Plus feedback/alerts/04-with-link-on-right.jsx (sky instead of blue).
const RainAlert = ({ onOpen }: { onOpen: () => void }) => {
  const t = useTranslations('today');
  return (
    <div className="rounded-md bg-sky-50 p-4 dark:bg-sky-500/10 dark:outline dark:outline-sky-500/20">
      <div className="flex">
        <div className="shrink-0">
          <CloudRain aria-hidden="true" className="size-5 text-sky-500" />
        </div>
        <div className="ml-3 flex-1 md:flex md:justify-between">
          <p className="text-sm font-medium text-sky-800 dark:text-sky-200">
            {t('rainAlert')}
          </p>
          <p className="mt-3 text-sm md:mt-0 md:ml-6">
            <button
              type="button"
              onClick={onOpen}
              className="font-medium whitespace-nowrap text-sky-700 hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
            >
              {t('seeRainFish')}
              <span aria-hidden="true"> &rarr;</span>
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export const Route = createFileRoute('/{-$locale}/')({
  component: TodayPage,
});

function TodayPage() {
  const t = useTranslations('today');
  const me = useMe();
  const plantables = usePlantables();
  const machines = useMachines();
  const events = useFixedEvents();
  const reminders = useReminders();
  const shops = useShops();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [machineDrawerOpen, setMachineDrawerOpen] = useState(false);
  const [rainFishOpen, setRainFishOpen] = useState(false);
  const names = usePlantableNames(plantables.data);

  const profile = me.data?.profile;
  if (me.isPending || plantables.isPending) {
    return (
      <Skeleton label={t('loading')} className="space-y-10">
        <SkeletonCardBody rows={3} />
        <SkeletonCardBody rows={4} />
        <SkeletonDays days={7} />
      </Skeleton>
    );
  }
  if (me.isError || plantables.isError || !profile) {
    return (
      <p className="text-sm text-red-700 dark:text-red-400">{t('loadError')}</p>
    );
  }

  const openDrawer = () => setDrawerOpen(true);
  const playerMachines = me.data.machines ?? [];
  const machineCatalog = machines.data ?? [];

  return (
    <div className="space-y-10">
      <h1 className="sr-only">{t('title')}</h1>
      {profile.rainToday && <RainAlert onOpen={() => setRainFishOpen(true)} />}
      <TodayList
        plantings={me.data.plantings}
        plantables={plantables.data}
        names={names}
        today={profile.currentDate}
        profile={profile}
        machines={playerMachines}
        machineCatalog={machineCatalog}
        machineCatalogStatus={machineCatalogStatus(machines)}
        events={events.data ?? []}
        eventsStatus={machineCatalogStatus(events)}
        onAddPlanting={openDrawer}
        onAddMachine={() => setMachineDrawerOpen(true)}
      />
      <TodayReminders
        reminders={reminders.data ?? []}
        events={events.data ?? []}
        today={profile.currentDate}
        status={machineCatalogStatus(reminders)}
      />
      {events.isError ? (
        <p className="text-sm text-red-700 dark:text-red-400">
          {t('eventsError')}
        </p>
      ) : (
        <UpcomingDays
          events={events.data ?? []}
          today={profile.currentDate}
          plantings={me.data.plantings}
          names={names}
          machines={playerMachines}
          machineCatalog={machineCatalog}
          machineCatalogStatus={machineCatalogStatus(machines)}
        />
      )}
      <OpenShops
        shops={shops.data ?? []}
        today={profile.currentDate}
        events={events.data ?? []}
        progress={{
          communityCenterRestored: profile.communityCenterRestored,
          keyToTown: profile.keyToTown,
          boatRepaired: profile.boatRepaired,
          rainToday: profile.rainToday,
        }}
        status={machineCatalogStatus(shops)}
        eventsStatus={machineCatalogStatus(events)}
      />
      <PlantingDrawer
        open={drawerOpen}
        editing={null}
        profile={profile}
        onClose={() => setDrawerOpen(false)}
      />
      <MachineDrawer
        open={machineDrawerOpen}
        editing={null}
        profile={profile}
        onClose={() => setMachineDrawerOpen(false)}
      />
      {profile.rainToday && (
        <RainFishModal
          open={rainFishOpen}
          onClose={() => setRainFishOpen(false)}
          season={profile.currentDate.season}
        />
      )}
    </div>
  );
}
