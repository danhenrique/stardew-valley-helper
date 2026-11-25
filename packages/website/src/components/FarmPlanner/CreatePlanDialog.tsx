import { type FormEvent, useState } from 'react';
import { useTranslations } from 'use-intl';
import { SelectMenu } from '../form/SelectMenu';
import { Modal } from '../Modal';

export const MAX_PLAN_NAME = 60;

export type FarmChoice = { id: string; label: string };

type CreatePlanDialogProps = {
  open: boolean;
  farms: FarmChoice[];
  pending: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; farmId: string }) => void;
};

// Adapted from Tailwind Plus overlays/modal-dialogs/05-simple-with-gray-footer.jsx (through Modal)
// and forms/input-groups/02-input-with-label-and-help-text.jsx.
export function CreatePlanDialog(props: CreatePlanDialogProps) {
  const t = useTranslations('farmPlanner.create');
  // Remounted on each open so the form starts empty.
  return (
    <Modal open={props.open} onClose={props.onClose} title={t('title')}>
      {props.open && <CreatePlanForm {...props} />}
    </Modal>
  );
}

function CreatePlanForm({
  farms,
  pending,
  onClose,
  onCreate,
}: CreatePlanDialogProps) {
  const t = useTranslations('farmPlanner.create');
  const tc = useTranslations('common');
  const [name, setName] = useState('');
  const [farmId, setFarmId] = useState(farms[0]?.id ?? '');
  const trimmed = name.trim();
  const valid = trimmed.length > 0 && farmId !== '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onCreate({ name: trimmed, farmId });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label
          htmlFor="plan-name"
          className="block text-sm/6 font-medium text-gray-900 dark:text-white"
        >
          {t('name')}
        </label>
        <div className="mt-2">
          <input
            id="plan-name"
            type="text"
            maxLength={MAX_PLAN_NAME}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-describedby="plan-name-hint"
            className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-green-500"
          />
        </div>
        <p
          id="plan-name-hint"
          className="mt-2 text-sm text-gray-500 dark:text-gray-400"
        >
          {t('hint', { max: MAX_PLAN_NAME })}
        </p>
      </div>
      <SelectMenu
        label={t('farm')}
        value={farmId}
        options={farms.map((farm) => ({ value: farm.id, label: farm.label }))}
        onChange={setFarmId}
      />
      <div className="flex justify-end gap-x-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring-1 inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
        >
          {tc('cancel')}
        </button>
        <button
          type="submit"
          disabled={!valid || pending}
          className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-400"
        >
          {t('submit')}
        </button>
      </div>
    </form>
  );
}
