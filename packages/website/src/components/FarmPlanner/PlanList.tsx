import {
  DocumentDuplicateIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { type KeyboardEvent, useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';
import type { FarmPlanSummaryOut } from '../../generated/stardew-valley-api/types.gen';
import {
  farmBackgroundUrl,
  useCreateFarmPlan,
  useDeleteFarmPlan,
  useFarmPlans,
  useFarms,
  useRenameFarmPlan,
} from '../../hooks/useFarmPlans';
import { localizedName } from '../../lib/i18n';
import type { Locale } from '../../lib/locale';
import { LocaleLink, useLocaleNavigate } from '../LocaleLink';
import { Modal } from '../Modal';
import { apiErrorMessage, useNotifications } from '../Notifications';
import { SkeletonPage } from '../Skeleton';
import { CreatePlanDialog, MAX_PLAN_NAME } from './CreatePlanDialog';

export const MAX_PLANS = 20;

const ICON_BUTTON =
  'relative z-10 rounded-md p-1 text-gray-400 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:hover:text-gray-200';

const formatDate = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleDateString(locale, { timeZone: 'UTC' });

/** The player's farm plans as cards, with create, duplicate, inline rename and delete. */
export function PlanList() {
  const locale = useLocale();
  const t = useTranslations('farmPlanner.list');
  const common = useTranslations('common');
  const plans = useFarmPlans();
  const farms = useFarms();
  const createPlan = useCreateFarmPlan();
  const deletePlan = useDeleteFarmPlan();
  const renamePlan = useRenameFarmPlan();
  const { notifyError } = useNotifications();
  const navigate = useLocaleNavigate();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<FarmPlanSummaryOut | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  if (plans.isPending || farms.isPending) {
    return <SkeletonPage label={t('loading')} />;
  }
  if (plans.isError || farms.isError) {
    return (
      <p className="text-sm text-red-700 dark:text-red-400">{t('loadError')}</p>
    );
  }

  const farmNames = new Map(
    farms.data.map((farm) => [farm.id, localizedName(farm.name, locale)]),
  );
  const atLimit = plans.data.length >= MAX_PLANS;

  const openPlan = (id: string) =>
    navigate({ to: '/{-$locale}/farm/$id', params: { id } });

  const create = (
    body: { name: string; farmId: string } | { name: string; copyFrom: string },
    onDone?: () => void,
  ) =>
    createPlan.mutateAsync(body).then(
      (plan) => {
        onDone?.();
        return openPlan(plan.id);
      },
      (error) => notifyError(apiErrorMessage(error)),
    );

  const confirmDelete = () => {
    if (!deleting) return;
    const { id } = deleting;
    deletePlan.mutateAsync({ planId: id }).then(
      () => setDeleting(null),
      (error) => {
        setDeleting(null);
        notifyError(apiErrorMessage(error));
      },
    );
  };

  const saveName = (plan: FarmPlanSummaryOut, value: string) => {
    const name = value.trim();
    setRenaming(null);
    if (!name || name === plan.name) return;
    renamePlan
      .mutateAsync({ planId: plan.id, name })
      .catch((error) => notifyError(apiErrorMessage(error)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-x-3">
        {atLimit && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('limit', { max: MAX_PLANS })}
          </p>
        )}
        <button
          type="button"
          disabled={atLimit}
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-x-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-400"
        >
          <PlusIcon aria-hidden="true" className="-ml-0.5 size-5" />
          {t('new')}
        </button>
      </div>

      {plans.data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-white/20 dark:text-gray-400">
          {t('empty')}
        </p>
      ) : (
        // Adapted from Tailwind Plus lists/grid-lists/06-images-with-details.jsx
        <ul
          role="list"
          className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3 xl:gap-x-8"
        >
          {plans.data.map((plan) => {
            const farmName = farmNames.get(plan.farmId) || plan.farmId;
            return (
              <li key={plan.id} className="relative">
                <div className="group overflow-hidden rounded-lg bg-gray-100 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-green-600 dark:bg-gray-800 dark:focus-within:outline-green-500">
                  <img
                    alt=""
                    src={farmBackgroundUrl(plan.farmId)}
                    className="pointer-events-none aspect-10/7 w-full rounded-lg object-cover outline -outline-offset-1 outline-black/5 group-hover:opacity-75 dark:outline-white/10"
                  />
                  <LocaleLink
                    to="/{-$locale}/farm/$id"
                    params={{ id: plan.id }}
                    className="absolute inset-0 focus:outline-hidden"
                  >
                    <span className="sr-only">
                      {t('open', { name: plan.name })}
                    </span>
                  </LocaleLink>
                </div>
                <div className="mt-2 flex items-start justify-between gap-x-2">
                  <div className="min-w-0 flex-1">
                    {renaming === plan.id ? (
                      <RenameInput
                        initial={plan.name}
                        onSave={(value) => saveName(plan, value)}
                        onCancel={() => setRenaming(null)}
                      />
                    ) : (
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {plan.name}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {farmName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('updatedAt', {
                        date: formatDate(plan.updatedAt, locale),
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-x-1">
                    <button
                      type="button"
                      aria-label={t('rename', { name: plan.name })}
                      title={t('rename', { name: plan.name })}
                      onClick={() => setRenaming(plan.id)}
                      className={ICON_BUTTON}
                    >
                      <PencilSquareIcon aria-hidden="true" className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('duplicate', { name: plan.name })}
                      title={t('duplicate', { name: plan.name })}
                      disabled={atLimit || createPlan.isPending}
                      onClick={() =>
                        create({
                          name: t('copyName', { name: plan.name }).slice(
                            0,
                            MAX_PLAN_NAME,
                          ),
                          copyFrom: plan.id,
                        })
                      }
                      className={`${ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <DocumentDuplicateIcon
                        aria-hidden="true"
                        className="size-5"
                      />
                    </button>
                    <button
                      type="button"
                      aria-label={t('delete', { name: plan.name })}
                      title={t('delete', { name: plan.name })}
                      onClick={() => setDeleting(plan)}
                      className={`${ICON_BUTTON} hover:text-red-600 dark:hover:text-red-400`}
                    >
                      <TrashIcon aria-hidden="true" className="size-5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CreatePlanDialog
        open={creating}
        farms={farms.data.map((farm) => ({
          id: farm.id,
          label: localizedName(farm.name, locale) || farm.id,
        }))}
        pending={createPlan.isPending}
        onClose={() => setCreating(false)}
        onCreate={(body) => create(body, () => setCreating(false))}
      />
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('deleteTitle')}
        footer={
          <div className="flex gap-x-3">
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring-1 inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
            >
              {common('cancel')}
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deletePlan.isPending}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-500 dark:shadow-none dark:hover:bg-red-400"
            >
              {t('deleteAction')}
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {deleting && t('deleteConfirm', { name: deleting.name })}
        </p>
      </Modal>
    </div>
  );
}

function RenameInput({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('farmPlanner.list');
  const [value, setValue] = useState(initial);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') onSave(value);
    if (event.key === 'Escape') onCancel();
  };
  return (
    <input
      type="text"
      aria-label={t('nameLabel')}
      autoFocus
      maxLength={MAX_PLAN_NAME}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={onCancel}
      className="relative z-10 block w-full rounded-md bg-white px-2 py-1 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:focus:outline-green-500"
    />
  );
}
