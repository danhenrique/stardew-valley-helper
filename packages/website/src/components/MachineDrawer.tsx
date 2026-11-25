import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from '@headlessui/react';
import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'use-intl';
import type {
  MachineBatchOut,
  MachineScheduleOut,
  ProfileIn,
} from '../generated/stardew-valley-api/types.gen';
import { useDraftMachineSchedule } from '../hooks/useDraftSchedule';
import {
  useCreateMachineBatch,
  useMachines,
  useUpdateMachineBatch,
} from '../hooks/useGameData';
import {
  type MachineDraft,
  machineDates,
  summarizeMachineSchedule,
  toMachineBatchIn,
} from '../lib/machines';
import { ItemDrawer } from './ItemDrawer';
import { MachineForm } from './MachineForm';
import { apiErrorMessage, useNotifications } from './Notifications';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus overlays/drawers/05-with-sticky-footer.jsx (via ItemDrawer)

const MachineSchedulePreview = ({
  schedule,
  loading,
  emptyKind,
}: {
  schedule: MachineScheduleOut | null;
  loading: boolean;
  emptyKind: 'machine' | 'product';
}) => {
  const labels = useLabels();
  const t = useTranslations('machines.drawer');
  const tCommon = useTranslations('common');
  if (!schedule)
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {loading
          ? tCommon('calculating')
          : emptyKind === 'machine'
            ? t('chooseMachineSentence')
            : t('chooseProductSentence')}
      </p>
    );
  const dates = machineDates({ schedule });
  return (
    <div className="space-y-2">
      {schedule.approximate && (
        <p className="text-sm text-yellow-700 dark:text-yellow-500">
          {t('approximate')}
        </p>
      )}
      {dates.length ? (
        <ul
          aria-label={t('dates')}
          className="divide-y divide-gray-100 text-sm/6 text-gray-700 dark:divide-white/5 dark:text-gray-300"
        >
          {dates.map(({ date, label }) => (
            <li
              key={`${label.key}-${date.year}-${date.season}-${date.day}`}
              className="py-1"
            >
              {t('dateLine', {
                label: labels.text(label),
                date: labels.gameDate(date),
              })}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('noDates')}
        </p>
      )}
    </div>
  );
};

export const MachineDrawer = ({
  open,
  editing,
  initial,
  profile,
  onClose,
}: {
  open: boolean;
  editing: MachineBatchOut | null;
  /** Form values to start from instead of the stored batch (e.g. "Trocar produto" restarts today). */
  initial?: MachineDraft;
  profile: ProfileIn;
  onClose: () => void;
}) => {
  const labels = useLabels();
  const t = useTranslations('machines');
  const tDrawer = useTranslations('machines.drawer');
  const tFarming = useTranslations('farming.drawer');
  const tCommon = useTranslations('common');
  const formId = useId();
  const machines = useMachines();
  const createBatch = useCreateMachineBatch();
  const updateBatch = useUpdateMachineBatch();
  const { notifyError } = useNotifications();
  const [draft, setDraft] = useState<MachineDraft | null>(null);
  const [machineChosen, setMachineChosen] = useState(false);
  // Forget the draft on close so a reopened drawer starts empty until the form emits one.
  useEffect(() => {
    if (!open) {
      setDraft(null);
      setMachineChosen(false);
    }
  }, [open]);
  const { schedule, loading } = useDraftMachineSchedule(draft, profile);

  const onError = (error: unknown) => notifyError(apiErrorMessage(error));
  const submit = (next: MachineDraft) =>
    editing
      ? updateBatch.mutate(
          { machineBatchId: editing.id, ...next },
          { onSuccess: onClose, onError },
        )
      : createBatch.mutate(next, { onSuccess: onClose, onError });
  const saving = createBatch.isPending || updateBatch.isPending;

  const draftMachine = machines.data?.find(
    (machine) => machine.id === draft?.machineId,
  );
  const kind = draftMachine?.kind;
  const days = draftMachine?.outputs.find(
    (output) => output.id === draft?.outputId,
  )?.days;
  const emptyKind = machineChosen || editing ? 'product' : 'machine';
  const emptyText =
    emptyKind === 'product'
      ? tDrawer('chooseProduct')
      : tDrawer('chooseMachine');
  const summary =
    schedule && kind && days != null
      ? labels.text(summarizeMachineSchedule(kind, days, schedule))
      : draft
        ? tFarming('calculating')
        : emptyText;

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
          <MachineSchedulePreview
            schedule={schedule}
            loading={loading}
            emptyKind={emptyKind}
          />
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
      {machines.data && (
        <MachineForm
          key={editing ? `edit-${editing.id}` : 'new'}
          formId={formId}
          today={profile.currentDate}
          machines={machines.data}
          initial={initial ?? (editing ? toMachineBatchIn(editing) : undefined)}
          onDraftChange={setDraft}
          onMachineChange={() => setMachineChosen(true)}
          onSubmit={submit}
        />
      )}
    </ItemDrawer>
  );
};
