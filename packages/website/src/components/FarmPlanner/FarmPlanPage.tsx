import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { useQueryClient } from '@tanstack/react-query';
import { useBlocker } from '@tanstack/react-router';
import { useRef } from 'react';
import { useTranslations } from 'use-intl';
import type { FarmPlanOut } from '../../generated/stardew-valley-api/types.gen';
import {
  isNotFound,
  useFarmPlan,
  useFarmPlans,
  useFarmTerrain,
  usePlannerCatalog,
  useUpdateFarmPlan,
} from '../../hooks/useFarmPlans';
import { useStardewValleyApi } from '../../hooks/useStardewValleyApi';
import type { Catalog, Terrain } from '../../lib/farmPlanner/types';
import { LocaleLink, useLocaleNavigate } from '../LocaleLink';
import { SkeletonPage } from '../Skeleton';
import { ConflictDialog } from './ConflictDialog';
import { FarmEditor, type FarmEditorHandle } from './FarmEditor';
import { LeaveDialog } from './LeaveDialog';
import { useAutosave } from './useAutosave';

const BACK_LINK =
  'inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white';
const PRIMARY_BUTTON =
  'rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:bg-green-500 dark:hover:bg-green-400';

/** Editor page of one plan: loading, not found and load failure states, then the editor. */
export function FarmPlanPage({ planId }: { planId: string }) {
  const t = useTranslations('farmPlanner.page');
  const plan = useFarmPlan(planId);
  const terrain = useFarmTerrain(plan.data?.farmId);
  const catalog = usePlannerCatalog();
  const queryClient = useQueryClient();

  const back = (
    <LocaleLink to="/{-$locale}/farm" className={BACK_LINK}>
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      {t('back')}
    </LocaleLink>
  );

  // Once loaded, the editor stays mounted: a failed background refetch must not drop edits.
  if (plan.data && terrain.data && catalog.data) {
    return (
      <div className="space-y-4">
        {back}
        <AutosavedEditor
          key={plan.data.id}
          plan={plan.data}
          terrain={terrain.data}
          catalog={catalog.data}
        />
      </div>
    );
  }
  if (!plan.data && isNotFound(plan.error)) {
    return (
      <div className="space-y-2 py-12 text-center">
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">
          {t('notFound')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('notFoundHint')}
        </p>
        <LocaleLink
          to="/{-$locale}/farm"
          className="inline-block text-sm font-semibold text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
        >
          {t('backToPlans')}
        </LocaleLink>
      </div>
    );
  }
  if (plan.isError || terrain.isError || catalog.isError) {
    return (
      <div className="space-y-4">
        {back}
        <p className="text-sm text-red-700 dark:text-red-400">
          {t('loadError')}
        </p>
        <button
          type="button"
          onClick={() => queryClient.refetchQueries({ type: 'active' })}
          className={PRIMARY_BUTTON}
        >
          {t('retry')}
        </button>
      </div>
    );
  }
  return <SkeletonPage label={t('loading')} />;
}

/**
 * The editor keeps its own objects. Refetched plan data only updates the name; the objects
 * reach the editor again only through "Recarregar".
 */
function AutosavedEditor({
  plan,
  terrain,
  catalog,
}: {
  plan: FarmPlanOut;
  terrain: Terrain;
  catalog: Catalog;
}) {
  const api = useStardewValleyApi();
  const queryClient = useQueryClient();
  const update = useUpdateFarmPlan();
  const editor = useRef<FarmEditorHandle>(null);
  const navigate = useLocaleNavigate();
  const plans = useFarmPlans();
  const otherPlans = plans.data
    ?.filter((p) => p.id !== plan.id)
    .map(({ id, name }) => ({ id, name }));
  const autosave = useAutosave({
    planId: plan.id,
    name: plan.name,
    initialVersion: plan.version,
    save: (input) => update.mutateAsync(input),
    fetchPlan: () =>
      queryClient.fetchQuery({
        ...api.getFarmPlan.queryOptions({ planId: plan.id }),
        staleTime: 0,
      }),
    onReload: (objects) => editor.current?.reset(objects),
  });

  // Leaving inside the app with something not saved yet asks first, in LeaveDialog. Tab close
  // and reload are covered by useAutosave's own (native) beforeunload handler.
  const atRisk =
    autosave.unsaved ||
    autosave.status === 'saving' ||
    autosave.status === 'error' ||
    autosave.status === 'conflict';
  const leave = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      atRisk && current.pathname !== next.pathname,
    withResolver: true,
    enableBeforeUnload: false,
  });

  return (
    <>
      <FarmEditor
        ref={editor}
        plan={plan}
        terrain={terrain}
        catalog={catalog}
        onChange={autosave.schedule}
        saveStatus={autosave.status}
        saveError={autosave.errorMessage}
        otherPlans={otherPlans}
        // Goes through the router, so LeaveDialog asks first when changes are at risk.
        onPickPlan={(id) =>
          navigate({ to: '/{-$locale}/farm/$id', params: { id } })
        }
      />
      <ConflictDialog
        open={autosave.status === 'conflict'}
        onReload={autosave.reload}
        onOverwrite={autosave.overwrite}
      />
      <LeaveDialog
        open={leave.status === 'blocked'}
        onLeave={() => leave.proceed?.()}
        onStay={() => leave.reset?.()}
      />
    </>
  );
}
