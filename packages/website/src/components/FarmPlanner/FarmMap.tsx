import clsx from 'clsx';
import { useEffect, useId, useMemo, useRef } from 'react';
import { useTranslations } from 'use-intl';
import {
  type Coverage,
  type CoverageSummary,
  coverageKind,
  rangeTiles,
} from '../../lib/farmPlanner/coverage';
import {
  canMove,
  checkPlacement,
  paintRect,
} from '../../lib/farmPlanner/rules';
import type {
  Catalog,
  Issue,
  PlacedObject,
  PlannerObjectDef,
  Terrain,
} from '../../lib/farmPlanner/types';
import { CoverageLayer, RangePreview } from './CoverageLayer';
import {
  type Box,
  boxOf,
  GHOST_BAD,
  GHOST_OK,
  MarksLayer,
  ObjectsLayer,
  Outline,
  rectOf,
} from './MapLayers';
import type { Tool } from './useEditorKeys';
import { deletedBy, useMapPointer } from './useMapPointer';
import type { Point, Viewport } from './useViewport';

export type FarmMapProps = {
  terrain: Terrain;
  catalog: Catalog;
  objects: PlacedObject[];
  issues: Map<number, Issue[]>;
  selection: ReadonlySet<number>;
  tool: Tool;
  active: PlannerObjectDef | undefined;
  backgroundUrl: string;
  /** Shown when the coverage layer is on. */
  coverage?: { cov: Coverage; summary: CoverageSummary } | null;
  viewport: Viewport;
  spaceHeld: boolean;
  onPlace: (tile: Point) => void;
  onPaint: (from: Point, to: Point) => void;
  onSelect: (indexes: number[]) => void;
  onMove: (indexes: number[], dx: number, dy: number) => void;
  /** Removes these objects in one action (non-removable ones are skipped by the caller). */
  onDelete: (indexes: number[]) => void;
};

/** The farm as SVG in tile units: background, grid, objects, issue outlines, selection and ghost. */
export function FarmMap(props: FarmMapProps) {
  const { terrain, catalog, objects, issues, selection, tool, active } = props;
  const { viewport } = props;
  const t = useTranslations('farmPlanner.map');
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridId = `grid-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { drag, hover, handlers } = useMapPointer(props, svgRef);
  const setContainer = viewport.setContainer;

  // Measure the container and follow its size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setContainer({ width: r.width, height: r.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [setContainer]);

  const objectsLayer = useMemo(
    () => <ObjectsLayer objects={objects} catalog={catalog} />,
    [objects, catalog],
  );

  const ghosts = useMemo((): { box: Box; ok: boolean }[] => {
    const ctx = { terrain, catalog, objects };
    if (drag?.kind === 'move') {
      const dx = drag.to.x - drag.from.x;
      const dy = drag.to.y - drag.from.y;
      if (!dx && !dy) return [];
      const ok = canMove(drag.indexes, dx, dy, ctx);
      return drag.indexes.map((i) => {
        const o = objects[i];
        return {
          box: boxOf(catalog.get(o.t), { ...o, x: o.x + dx, y: o.y + dy }),
          ok,
        };
      });
    }
    if (drag?.kind === 'paint') {
      // Red when the paint would add nothing or pass the object limit.
      const painted = active && paintRect(active, drag.from, drag.to, ctx);
      const ok = Array.isArray(painted) && painted.length > 0;
      return [{ box: rectOf(drag.from, drag.to), ok }];
    }
    if (tool !== 'place' || !active || !hover || drag) return [];
    const candidate = { t: active.id, ...hover };
    const ok = !checkPlacement(candidate, ctx).some((i) => i.level === 'error');
    return [{ box: boxOf(active, candidate), ok }];
  }, [drag, tool, active, hover, terrain, catalog, objects]);

  // Objects the delete rectangle would remove (the farmhouse and other fixed ones stay).
  const doomed = useMemo(() => {
    if (drag?.kind !== 'delete') return [];
    return deletedBy(objects, catalog, drag.from, drag.to).filter(
      (i) => catalog.get(objects[i].t)?.removable !== false,
    );
  }, [drag, objects, catalog]);

  // Range of the sprinkler or scarecrow being placed, or of a single selected one.
  const preview = useMemo(() => {
    if (tool === 'place' && active && hover && !drag) {
      const kind = coverageKind(active);
      return kind
        ? { kind, tiles: rangeTiles(active, hover.x, hover.y, terrain) }
        : null;
    }
    if (selection.size !== 1) return null;
    const index = [...selection][0];
    const o = objects[index];
    const def = o && catalog.get(o.t);
    const kind = def && coverageKind(def);
    if (!def || !kind) return null;
    // Follow the object while it is being dragged.
    const moving = drag?.kind === 'move' && drag.indexes.includes(index);
    const dx = moving ? drag.to.x - drag.from.x : 0;
    const dy = moving ? drag.to.y - drag.from.y : 0;
    return { kind, tiles: rangeTiles(def, o.x + dx, o.y + dy, terrain) };
  }, [tool, active, hover, drag, selection, objects, catalog, terrain]);

  const cursor =
    drag?.kind === 'pan'
      ? 'cursor-grabbing'
      : props.spaceHeld
        ? 'cursor-grab'
        : tool === 'place'
          ? 'cursor-crosshair'
          : 'cursor-default';

  return (
    <div
      ref={wrapRef}
      className="relative size-full overflow-hidden bg-gray-100 dark:bg-gray-950"
    >
      <svg
        ref={svgRef}
        role="application"
        aria-label={t('label')}
        viewBox={viewport.viewBox}
        className={clsx('block size-full touch-none select-none', cursor)}
        {...handlers}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern
            id={gridId}
            width={1}
            height={1}
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M1 0H0V1"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              className="fill-none stroke-black/15 dark:stroke-white/15"
            />
          </pattern>
        </defs>
        <image
          href={props.backgroundUrl}
          width={terrain.width}
          height={terrain.height}
          preserveAspectRatio="none"
          className="[image-rendering:pixelated]"
        />
        <rect
          width={terrain.width}
          height={terrain.height}
          fill={`url(#${gridId})`}
          className="pointer-events-none"
        />
        {props.coverage && (
          <CoverageLayer
            cov={props.coverage.cov}
            summary={props.coverage.summary}
            width={terrain.width}
          />
        )}
        {preview && (
          <RangePreview
            tiles={preview.tiles}
            kind={preview.kind}
            width={terrain.width}
          />
        )}
        {objectsLayer}
        <MarksLayer
          objects={objects}
          catalog={catalog}
          issues={issues}
          selection={selection}
        />
        {drag?.kind === 'area' && (
          <Outline
            box={rectOf(drag.from, drag.to)}
            className="fill-sky-500/10 stroke-sky-500 [stroke-dasharray:4_2]"
          />
        )}
        {drag?.kind === 'delete' && (
          <Outline
            box={rectOf(drag.from, drag.to)}
            className="fill-red-500/10 stroke-red-500 [stroke-dasharray:4_2]"
          />
        )}
        {doomed.map((i) => (
          <Outline
            key={i}
            box={boxOf(catalog.get(objects[i].t), objects[i])}
            className="fill-red-500/20 stroke-red-600 dark:stroke-red-400"
          />
        ))}
        {ghosts.map((g, i) => (
          <Outline
            key={i}
            box={g.box}
            className={g.ok ? GHOST_OK : GHOST_BAD}
          />
        ))}
      </svg>
    </div>
  );
}
