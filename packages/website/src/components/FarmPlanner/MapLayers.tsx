import clsx from 'clsx';
import { memo, useId } from 'react';
import { mergeTiles } from '../../lib/farmPlanner/paths';
import type {
  Catalog,
  Issue,
  PlacedObject,
  PlannerObjectDef,
} from '../../lib/farmPlanner/types';
import { iconUrl } from '../../lib/icons';
import type { Point } from './useViewport';

export type Box = { x: number; y: number; w: number; h: number };

export const boxOf = (
  def: PlannerObjectDef | undefined,
  o: PlacedObject,
): Box => ({
  x: o.x,
  y: o.y,
  w: def?.size.w ?? 1,
  h: def?.size.h ?? 1,
});

export const rectOf = (a: Point, b: Point): Box => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x) + 1,
  h: Math.abs(a.y - b.y) + 1,
});

export const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const PAINT_FILL: Record<PlannerObjectDef['category'], string> = {
  planting: 'fill-amber-900/50',
  decoration: 'fill-stone-500/60',
  machine: 'fill-lime-600/50',
  building: 'fill-lime-600/50',
};

export const GHOST_OK =
  'fill-green-500/40 stroke-green-600 dark:stroke-green-400';
export const GHOST_BAD = 'fill-red-500/40 stroke-red-600 dark:stroke-red-400';

export const Outline = ({
  box,
  className,
}: {
  box: Box;
  className: string;
}) => (
  <rect
    x={box.x}
    y={box.y}
    width={box.w}
    height={box.h}
    strokeWidth={2}
    vectorEffect="non-scaling-stroke"
    className={clsx('pointer-events-none', className)}
  />
);

/** Painted ids as merged paths, every other object as a rect with its icon. */
export const ObjectsLayer = ({
  objects,
  catalog,
}: {
  objects: PlacedObject[];
  catalog: Catalog;
}) => {
  const paintIds = [...new Set(objects.map((o) => o.t))].filter(
    (t) => catalog.get(t)?.paint,
  );
  // Pattern ids must be unique per map instance, like the grid of FarmMap.
  const prefix = `paint-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const patternId = (t: string) =>
    `${prefix}-${t.replace(/[^a-zA-Z0-9-]/g, '')}`;
  const iconIds = paintIds.filter((t) => catalog.get(t)?.icon);
  return (
    <g>
      {iconIds.length > 0 && (
        <defs>
          {iconIds.map((t) => (
            <pattern
              key={t}
              id={patternId(t)}
              width={1}
              height={1}
              patternUnits="userSpaceOnUse"
            >
              <image
                href={iconUrl(catalog.get(t)?.icon as string)}
                width={1}
                height={1}
                preserveAspectRatio="none"
                className="[image-rendering:pixelated]"
              />
            </pattern>
          ))}
        </defs>
      )}
      {paintIds.map((t) => {
        const def = catalog.get(t) as PlannerObjectDef;
        return (
          <path
            key={t}
            data-object={t}
            d={mergeTiles(objects, t)}
            {...(def.icon
              ? { fill: `url(#${patternId(t)})` }
              : { className: PAINT_FILL[def.category] })}
          />
        );
      })}
      {objects.map((o, i) => {
        const def = catalog.get(o.t);
        if (!def || def.paint) return null;
        const box = boxOf(def, o);
        const side = Math.min(box.w, box.h);
        return (
          <g key={i} data-object={o.t} data-index={i}>
            <title>{def.name}</title>
            <rect
              x={box.x}
              y={box.y}
              width={box.w}
              height={box.h}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              className="fill-white/50 stroke-gray-700 dark:fill-gray-900/50 dark:stroke-gray-200"
            />
            {def.icon ? (
              <image
                href={iconUrl(def.icon)}
                x={box.x + (box.w - side) / 2}
                y={box.y + (box.h - side) / 2}
                width={side}
                height={side}
                className="[image-rendering:pixelated]"
              />
            ) : (
              box.w >= 2 && (
                <text
                  x={box.x + box.w / 2}
                  y={box.y + box.h / 2}
                  fontSize={0.6}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-gray-900 select-none dark:fill-white"
                >
                  {def.name}
                </text>
              )
            )}
          </g>
        );
      })}
    </g>
  );
};

/** Red outline for objects with errors, amber with ⚠ for warnings only, then the selection.
 * Memoized so hover and drag updates do not redraw every outline. */
export const MarksLayer = memo(function MarksLayer({
  objects,
  catalog,
  issues,
  selection,
}: {
  objects: PlacedObject[];
  catalog: Catalog;
  issues: Map<number, Issue[]>;
  selection: ReadonlySet<number>;
}) {
  return (
    <g>
      {[...issues].map(([i, list]) => {
        const o = objects[i];
        if (!o) return null;
        const error = list.some((issue) => issue.level === 'error');
        const box = boxOf(catalog.get(o.t), o);
        return (
          <g key={i} data-issue={error ? 'error' : 'warning'}>
            <Outline
              box={box}
              className={clsx(
                'fill-none',
                error
                  ? 'stroke-red-600 dark:stroke-red-400'
                  : 'stroke-amber-500 dark:stroke-amber-400',
              )}
            />
            {!error && (
              <text
                x={box.x + 0.05}
                y={box.y + 0.75}
                fontSize={0.7}
                className="pointer-events-none fill-amber-500 select-none"
              >
                ⚠
              </text>
            )}
          </g>
        );
      })}
      {[...selection].map((i) => {
        const o = objects[i];
        return o ? (
          <Outline
            key={i}
            box={boxOf(catalog.get(o.t), o)}
            className="fill-sky-500/20 stroke-sky-500 [stroke-dasharray:4_2] dark:stroke-sky-400"
          />
        ) : null;
      })}
    </g>
  );
});
