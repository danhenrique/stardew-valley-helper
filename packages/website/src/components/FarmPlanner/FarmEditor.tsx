import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslations } from 'use-intl';
import type { FarmPlanOut } from '../../generated/stardew-valley-api/types.gen';
import { farmBackgroundUrl } from '../../hooks/useFarmPlans';
import { coverage, coverageSummary } from '../../lib/farmPlanner/coverage';
import {
  type EditorAction,
  type EditorState,
  editorReducer,
  loadPlan,
} from '../../lib/farmPlanner/editor';
import {
  checkPlacement,
  checkPlan,
  issueMessage,
  paintRect,
} from '../../lib/farmPlanner/rules';
import type {
  PlacedObject,
  PlannerObjectDef,
  Terrain,
} from '../../lib/farmPlanner/types';
import { message, type Translatable } from '../../lib/message';
import { DetailsPanel, type Notice } from './DetailsPanel';
import { EditorDrawer } from './EditorDrawer';
import { FarmMap } from './FarmMap';
import { Palette } from './Palette';
import type { PlanChoice } from './PlanSelector';
import { Toolbar } from './Toolbar';
import type { SaveState } from './useAutosave';
import { useCoverageToggle } from './useCoverageToggle';
import { type Tool, useEditorKeys } from './useEditorKeys';
import { type Point, useViewport } from './useViewport';

type FarmEditorProps = {
  plan: FarmPlanOut;
  terrain: Terrain;
  catalog: Map<string, PlannerObjectDef>;
  /** Fires with the new objects after every accepted edit (and once after a load cleanup). */
  onChange: (objects: PlacedObject[]) => void;
  /** Autosave state shown in the toolbar. */
  saveStatus?: SaveState;
  /** Server detail of a rejected save, shown with the error state. */
  saveError?: Translatable;
  /** The player's other plans, listed by the toolbar's plan selector. */
  otherPlans?: PlanChoice[];
  onPickPlan?: (planId: string) => void;
  ref?: Ref<FarmEditorHandle>;
};

export type FarmEditorHandle = {
  /**
   * Replaces the objects and clears the history (after "Recarregar"). Fires onChange only when
   * unknown objects were dropped, as on the first load.
   */
  reset: (objects: PlacedObject[]) => void;
};

const NOT_REMOVABLE = message('farmPlanner.notice.notRemovable');
const MOVE_REFUSED = message('farmPlanner.notice.moveRefused');
const LIMIT_MESSAGE = issueMessage(
  { level: 'error', code: 'limit' },
  new Map(),
);

const errorNotice = (messages: Translatable[]): Notice => ({
  level: 'error',
  messages: [...new Map(messages.map((m) => [JSON.stringify(m), m])).values()],
});
const LIMIT_NOTICE = errorNotice([LIMIT_MESSAGE]);

/** Farm plan editor: toolbar, palette, map and details (palette and details are drawers below `lg`). */
export function FarmEditor({
  plan,
  terrain,
  catalog,
  onChange,
  saveStatus = 'idle',
  saveError,
  otherPlans,
  onPickPlan,
  ref,
}: FarmEditorProps) {
  const t = useTranslations('farmPlanner');
  const [initial] = useState(() => loadPlan(plan.objects, catalog));
  const [state, setState] = useState<EditorState>(() => ({
    objects: initial.objects,
    past: [],
    future: [],
    selection: new Set(),
    dirty: false,
  }));
  const stateRef = useRef(state);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [tool, setTool] = useState<Tool>('select');
  const [activeId, setActiveId] = useState<string>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dropped, setDropped] = useState(initial.dropped);
  const [drawer, setDrawer] = useState<'palette' | 'details' | null>(null);

  const ctx = useMemo(() => ({ terrain, catalog }), [terrain, catalog]);
  const mapSize = useMemo(
    () => ({ width: terrain.width, height: terrain.height }),
    [terrain.width, terrain.height],
  );
  const viewport = useViewport(mapSize);
  const active = activeId ? catalog.get(activeId) : undefined;
  const issues = useMemo(
    () => checkPlan(terrain, catalog, state.objects),
    [terrain, catalog, state.objects],
  );
  const [showCoverage, toggleCoverage, turnCoverageOn] = useCoverageToggle();
  const coverageState = useMemo(() => {
    const cov = coverage(state.objects, catalog, terrain);
    return {
      cov,
      summary: coverageSummary(state.objects, catalog, terrain, cov),
    };
  }, [terrain, catalog, state.objects]);

  // Objects dropped on load are saved away once (the ref survives StrictMode's double effect).
  const reportedCleanup = useRef(false);
  useEffect(() => {
    if (initial.dropped > 0 && !reportedCleanup.current) {
      reportedCleanup.current = true;
      onChangeRef.current(initial.objects);
    }
  }, [initial]);

  useImperativeHandle(
    ref,
    () => ({
      reset: (objects) => {
        const loaded = loadPlan(objects, catalog);
        const next = editorReducer(
          stateRef.current,
          { type: 'reset', objects: loaded.objects },
          ctx,
        );
        stateRef.current = next;
        setState(next);
        setNotice(null);
        setDropped(loaded.dropped);
        // As on the first load, the cleanup is saved away.
        if (loaded.dropped > 0) onChangeRef.current(loaded.objects);
      },
    }),
    [catalog, ctx],
  );

  /** Runs an action; returns false when the reducer refused it. */
  const apply = (action: EditorAction): boolean => {
    const prev = stateRef.current;
    const next = editorReducer(prev, action, ctx);
    if (next === prev) return false;
    stateRef.current = next;
    setState(next);
    if (next.objects !== prev.objects) onChangeRef.current(next.objects);
    return true;
  };

  const edit = (action: EditorAction, refusal?: Notice) => {
    if (apply(action)) setNotice(null);
    else if (refusal) setNotice(refusal);
  };

  const place = (tile: Point) => {
    if (!active) return;
    const object = { t: active.id, ...tile };
    const errors = checkPlacement(object, {
      ...ctx,
      objects: stateRef.current.objects,
    }).filter((i) => i.level === 'error');
    if (errors.length) {
      setNotice(errorNotice(errors.map((i) => issueMessage(i, catalog))));
      return;
    }
    // The reducer also refuses at the object limit; that is the only refusal left here.
    edit({ type: 'place', object }, LIMIT_NOTICE);
  };

  const paint = (from: Point, to: Point) => {
    if (!active) return;
    const result = paintRect(active, from, to, {
      ...ctx,
      objects: stateRef.current.objects,
    });
    if ('error' in result) {
      setNotice(LIMIT_NOTICE);
      return;
    }
    edit({ type: 'paint', objects: result });
  };

  const move = (indexes: number[], dx: number, dy: number) =>
    edit({ type: 'move', indexes, dx, dy }, errorNotice([MOVE_REFUSED]));

  const remove = (indexes: number[]) => {
    const objects = stateRef.current.objects;
    const locked = indexes.some(
      (i) => objects[i] && catalog.get(objects[i].t)?.removable === false,
    );
    const removed = apply({ type: 'delete', indexes });
    if (locked) setNotice(errorNotice([NOT_REMOVABLE]));
    else if (removed) setNotice(null);
  };

  const select = (indexes: number[]) => {
    apply({ type: 'select', indexes });
    setNotice(null);
  };

  const pick = (id: string) => {
    setActiveId(id);
    setTool('place');
    setDrawer(null);
  };

  const { spaceHeld } = useEditorKeys({
    hasSelection: state.selection.size > 0,
    setTool,
    deleteSelection: () => remove([...stateRef.current.selection]),
    moveSelection: (dx, dy) => move([...stateRef.current.selection], dx, dy),
    undo: () => edit({ type: 'undo' }),
    redo: () => edit({ type: 'redo' }),
    clearSelection: () => select([]),
  });

  const palette = (
    <Palette catalog={catalog} activeId={activeId} onPick={pick} />
  );
  const details = (
    <DetailsPanel
      catalog={catalog}
      objects={state.objects}
      issues={issues}
      selection={state.selection}
      notice={notice}
      dropped={dropped}
      coverage={coverageState.summary}
      onShowTile={(tile) => {
        // Show the outlines and get the mobile drawer out of the way, or the jump shows nothing.
        turnCoverageOn();
        setDrawer(null);
        viewport.centerOn({
          x: tile % terrain.width,
          y: Math.floor(tile / terrain.width),
        });
      }}
      onSelect={(indexes) => {
        setTool('select');
        select(indexes);
      }}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[28rem] flex-col overflow-hidden rounded-lg bg-white shadow-sm outline outline-gray-200 dark:bg-gray-900 dark:shadow-none dark:outline-white/10">
      <Toolbar
        planName={plan.name}
        otherPlans={otherPlans}
        onPickPlan={onPickPlan}
        saveStatus={saveStatus}
        saveError={saveError}
        tool={tool}
        onTool={setTool}
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
        onUndo={() => edit({ type: 'undo' })}
        onRedo={() => edit({ type: 'redo' })}
        zoom={viewport.view.zoom}
        onZoomIn={viewport.zoomIn}
        onZoomOut={viewport.zoomOut}
        onFit={viewport.fit}
        showCoverage={showCoverage}
        onToggleCoverage={toggleCoverage}
        onOpenPalette={() => setDrawer('palette')}
        onOpenDetails={() => setDrawer('details')}
      />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-200 p-4 lg:flex dark:border-white/10">
          {palette}
        </aside>
        <div className="min-w-0 flex-1">
          <FarmMap
            terrain={terrain}
            catalog={catalog}
            objects={state.objects}
            issues={issues}
            selection={state.selection}
            tool={tool}
            active={active}
            backgroundUrl={farmBackgroundUrl(terrain.farmId)}
            coverage={showCoverage ? coverageState : null}
            viewport={viewport}
            spaceHeld={spaceHeld}
            onPlace={place}
            onPaint={paint}
            onSelect={select}
            onMove={move}
            onDelete={remove}
          />
        </div>
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-gray-200 p-4 lg:block dark:border-white/10">
          {details}
        </aside>
      </div>
      <EditorDrawer
        open={drawer === 'palette'}
        title={t('palette.label')}
        onClose={() => setDrawer(null)}
      >
        {palette}
      </EditorDrawer>
      <EditorDrawer
        open={drawer === 'details'}
        title={t('details.label')}
        onClose={() => setDrawer(null)}
      >
        {details}
      </EditorDrawer>
    </div>
  );
}
