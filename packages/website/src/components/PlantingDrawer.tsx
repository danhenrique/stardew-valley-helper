import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from '@headlessui/react';
import {
  CalendarDaysIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/20/solid';
import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'use-intl';
import type {
  GameDateIn,
  PlantingOut,
  ProfileIn,
  ScheduleOut,
} from '../generated/stardew-valley-api/types.gen';
import { useDraftSchedule } from '../hooks/useDraftSchedule';
import {
  useCreatePlanting,
  useFertilizers,
  usePlantables,
  useUpdatePlanting,
} from '../hooks/useGameData';
import { describeFirstHarvest, summarizeSchedule } from '../lib/plantings';
import { ItemDrawer } from './ItemDrawer';
import { apiErrorMessage, useNotifications } from './Notifications';
import { type PlantingDraft, PlantingForm } from './PlantingForm';
import { SchedulePreview } from './SchedulePreview';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus overlays/drawers/05-with-sticky-footer.jsx (via ItemDrawer)

// Adapted from Tailwind Plus feedback/alerts/01-with-description.jsx (green / yellow).
const FirstHarvestHint = ({
  schedule,
  today,
}: {
  schedule: ScheduleOut;
  today: GameDateIn;
}) => {
  const labels = useLabels();
  const t = useTranslations('plantings.drawer');
  const matures = schedule.firstHarvest !== null;
  const Icon = matures ? CalendarDaysIcon : ExclamationTriangleIcon;
  return (
    <div
      role="status"
      aria-label={t('firstHarvest')}
      className={
        matures
          ? 'flex gap-x-3 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-500/10 dark:text-green-300 dark:outline dark:outline-green-500/20'
          : 'flex gap-x-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-200 dark:outline dark:outline-yellow-500/15'
      }
    >
      <Icon
        aria-hidden="true"
        className={
          matures
            ? 'size-5 shrink-0 text-green-500'
            : 'size-5 shrink-0 text-yellow-400'
        }
      />
      <p>
        {matures ? (
          <>
            <span className="font-semibold">{t('firstHarvestLabel')}</span>{' '}
            {labels.text(describeFirstHarvest(schedule, today))}
          </>
        ) : (
          labels.text(describeFirstHarvest(schedule, today))
        )}
      </p>
    </div>
  );
};

const toDraft = (planting: PlantingOut): PlantingDraft => ({
  seedId: planting.seedId,
  anchor: planting.anchor ?? 'planted',
  plantedOn: planting.plantedOn ?? null,
  lastHarvestOn: planting.lastHarvestOn ?? null,
  fertilizer: planting.fertilizer ?? 'none',
  location: planting.location ?? 'farm',
  quantity: planting.quantity ?? 1,
  label: planting.label ?? null,
});

export const PlantingDrawer = ({
  open,
  editing,
  profile,
  onClose,
}: {
  open: boolean;
  editing: PlantingOut | null;
  profile: ProfileIn;
  onClose: () => void;
}) => {
  const labels = useLabels();
  const t = useTranslations('plantings');
  const tFarming = useTranslations('farming.drawer');
  const tCommon = useTranslations('common');
  const formId = useId();
  const plantables = usePlantables();
  const fertilizers = useFertilizers();
  const createPlanting = useCreatePlanting();
  const updatePlanting = useUpdatePlanting();
  const { notifyError } = useNotifications();
  const [draft, setDraft] = useState<PlantingDraft | null>(null);
  // Forget the draft on close so a reopened drawer starts empty until the form emits one.
  useEffect(() => {
    if (!open) setDraft(null);
  }, [open]);
  const { schedule, loading } = useDraftSchedule(draft, profile);

  const onError = (error: unknown) => notifyError(apiErrorMessage(error));
  const submit = (next: PlantingDraft) =>
    editing
      ? updatePlanting.mutate(
          { plantingId: editing.id, ...next },
          { onSuccess: onClose, onError },
        )
      : createPlanting.mutate(next, { onSuccess: onClose, onError });
  const saving = createPlanting.isPending || updatePlanting.isPending;

  const summary = schedule
    ? labels.text(summarizeSchedule(schedule, profile.currentDate))
    : draft
      ? tFarming('calculating')
      : t('drawer.choose');

  const footer = (
    <div className="flex w-full flex-col gap-3">
      <Disclosure as="div">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">{summary}</p>
          <DisclosureButton className="shrink-0 text-sm font-semibold text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300">
            {tFarming('details')}
          </DisclosureButton>
        </div>
        <DisclosurePanel className="mt-3 max-h-64 overflow-y-auto">
          <SchedulePreview schedule={schedule} loading={loading} />
        </DisclosurePanel>
      </Disclosure>
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
        >
          {tCommon('cancel')}
        </button>
        <button
          type="submit"
          form={formId}
          disabled={!draft || saving}
          className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-400"
        >
          {tCommon('save')}
        </button>
      </div>
    </div>
  );

  return (
    <ItemDrawer
      open={open}
      title={editing ? t('edit') : t('add')}
      onClose={onClose}
      footer={footer}
    >
      {plantables.data && (
        <PlantingForm
          key={editing ? `edit-${editing.id}` : 'new'}
          formId={formId}
          today={profile.currentDate}
          plantables={plantables.data}
          fertilizers={fertilizers.data ?? []}
          initial={editing ? toDraft(editing) : undefined}
          onDraftChange={setDraft}
          onSubmit={submit}
          harvestHint={
            draft && schedule ? (
              <FirstHarvestHint
                schedule={schedule}
                today={profile.currentDate}
              />
            ) : null
          }
        />
      )}
    </ItemDrawer>
  );
};
