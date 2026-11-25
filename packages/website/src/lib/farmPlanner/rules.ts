import { type MessageRef, message } from '../message';
import {
  type Catalog,
  type Issue,
  MAX_OBJECTS,
  type PlacedObject,
  type PlannerObjectDef,
  type Terrain,
} from './types';

export type RulesContext = {
  terrain: Terrain;
  catalog: Catalog;
  objects: PlacedObject[];
  ignore?: ReadonlySet<number>;
};

/** `self` value for a candidate that is not in the plan yet. */
const FREE = -1;

const footprint = (def: PlannerObjectDef, o: PlacedObject) => ({
  x0: o.x,
  y0: o.y,
  x1: o.x + def.size.w,
  y1: o.y + def.size.h,
});

/** Every object on each tile (plan objects only; `terrain.fixed` is never read). */
type Grid = { cells: (number[] | undefined)[] };

const makeGrid = (ctx: RulesContext): Grid => {
  const { terrain, catalog, objects } = ctx;
  const { width, height } = terrain;
  const cells: (number[] | undefined)[] = new Array(width * height);
  objects.forEach((o, i) => {
    const def = catalog.get(o.t);
    if (!def) return;
    const f = footprint(def, o);
    for (let y = Math.max(0, f.y0); y < Math.min(height, f.y1); y++) {
      for (let x = Math.max(0, f.x0); x < Math.min(width, f.x1); x++) {
        (cells[y * width + x] ??= []).push(i);
      }
    }
  });
  return { cells };
};

/** Objects at a tile, skipping ignored ones and `self`. */
const occupants = (
  grid: Grid,
  ctx: RulesContext,
  x: number,
  y: number,
  self: number,
): number[] =>
  (grid.cells[y * ctx.terrain.width + x] ?? []).filter(
    (i) => i !== self && !ctx.ignore?.has(i),
  );

const inMap = (t: Terrain, x: number, y: number) =>
  x >= 0 && y >= 0 && x < t.width && y < t.height;

const check = (
  candidate: PlacedObject,
  ctx: RulesContext,
  grid: Grid,
  self: number,
): Issue[] => {
  const { terrain, catalog } = ctx;
  const def = catalog.get(candidate.t);
  if (!def) return [];
  const f = footprint(def, candidate);
  if (f.x0 < 0 || f.y0 < 0 || f.x1 > terrain.width || f.y1 > terrain.height) {
    return [{ level: 'error', code: 'outside' }];
  }
  const issues: Issue[] = [];
  let blocked = false;
  let wrong = false;
  const others = new Set<number>();
  for (let y = f.y0; y < f.y1; y++) {
    for (let x = f.x0; x < f.x1; x++) {
      const tile = terrain.tiles[y * terrain.width + x];
      if (tile === 'w' || tile === 'x') blocked = true;
      else if (def.placement === 'buildable' && tile !== 'b' && tile !== 'c')
        wrong = true;
      else if (def.placement === 'diggable' && tile !== 'd' && tile !== 'b')
        wrong = true;
      for (const o of occupants(grid, ctx, x, y, self)) others.add(o);
    }
  }
  if (blocked) issues.push({ level: 'error', code: 'blockedTile' });
  else if (wrong) {
    issues.push({
      level: 'error',
      code: def.placement === 'buildable' ? 'notBuildable' : 'notDiggable',
    });
  }
  for (const o of others) {
    issues.push({ level: 'error', code: 'overlap', other: ctx.objects[o]?.t });
  }

  if (def.kind === 'fruitTree') {
    let crowded = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = candidate.x + dx;
        const y = candidate.y + dy;
        if (
          (dx || dy) &&
          inMap(terrain, x, y) &&
          occupants(grid, ctx, x, y, self).length > 0
        ) {
          crowded = true;
        }
      }
    }
    if (crowded) issues.push({ level: 'warning', code: 'treeSpace' });
  }

  // Doors open onto the tile (or tiles) just below them.
  const doorTiles: { x: number; y: number }[] = [];
  if (def.humanDoor) {
    doorTiles.push({
      x: candidate.x + def.humanDoor.x,
      y: candidate.y + def.humanDoor.y + 1,
    });
  }
  if (def.animalDoor) {
    const d = def.animalDoor;
    for (let i = 0; i < d.w; i++) {
      doorTiles.push({ x: candidate.x + d.x + i, y: candidate.y + d.y + d.h });
    }
  }
  const doorBlocked = (p: { x: number; y: number }) => {
    if (!inMap(terrain, p.x, p.y)) return true;
    const tile = terrain.tiles[p.y * terrain.width + p.x];
    if (tile === 'w' || tile === 'x') return true;
    return occupants(grid, ctx, p.x, p.y, self).length > 0;
  };
  if (doorTiles.some(doorBlocked)) {
    issues.push({ level: 'warning', code: 'doorBlocked' });
  }
  return issues;
};

export const checkPlacement = (
  candidate: PlacedObject,
  ctx: RulesContext,
): Issue[] => check(candidate, ctx, makeGrid(ctx), FREE);

export const checkPlan = (
  terrain: Terrain,
  catalog: Catalog,
  objects: PlacedObject[],
): Map<number, Issue[]> => {
  const ctx: RulesContext = { terrain, catalog, objects };
  const grid = makeGrid(ctx);
  const result = new Map<number, Issue[]>();
  objects.forEach((o, i) => {
    const issues = check(o, ctx, grid, i);
    if (issues.length) result.set(i, issues);
  });
  return result;
};

const hasError = (issues: Issue[]) => issues.some((i) => i.level === 'error');

/** All or nothing: false when any moved object would break an error rule. */
export const canMove = (
  indexes: number[],
  dx: number,
  dy: number,
  ctx: RulesContext,
): boolean => {
  const moving = new Set(indexes);
  const inner: RulesContext = { ...ctx, ignore: moving };
  const grid = makeGrid(inner);
  return indexes.every((i) => {
    const o = ctx.objects[i];
    if (!o) return false;
    return !hasError(
      check({ ...o, x: o.x + dx, y: o.y + dy }, inner, grid, FREE),
    );
  });
};

export const paintRect = (
  def: PlannerObjectDef,
  from: { x: number; y: number },
  to: { x: number; y: number },
  ctx: RulesContext,
): PlacedObject[] | { error: 'limit' } => {
  const grid = makeGrid(ctx);
  const taken = new Set<string>();
  const result: PlacedObject[] = [];
  const [x0, x1] = [Math.min(from.x, to.x), Math.max(from.x, to.x)];
  const [y0, y1] = [Math.min(from.y, to.y), Math.max(from.y, to.y)];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const candidate = { t: def.id, x, y };
      if (hasError(check(candidate, ctx, grid, FREE))) continue;
      const keys: string[] = [];
      for (let j = 0; j < def.size.h; j++) {
        for (let i = 0; i < def.size.w; i++) keys.push(`${x + i},${y + j}`);
      }
      if (keys.some((k) => taken.has(k))) continue;
      keys.forEach((k) => taken.add(k));
      result.push(candidate);
    }
  }
  if (ctx.objects.length + result.length > MAX_OBJECTS)
    return { error: 'limit' };
  return result;
};

/** Indexes (ascending) of the objects whose footprint intersects `box`; unknown types count as 1x1. */
export const objectsInBox = (
  objects: PlacedObject[],
  catalog: Catalog,
  box: { x: number; y: number; w: number; h: number },
): number[] =>
  objects.flatMap((o, i) => {
    const size = catalog.get(o.t)?.size ?? { w: 1, h: 1 };
    const hits =
      o.x < box.x + box.w &&
      box.x < o.x + size.w &&
      o.y < box.y + box.h &&
      box.y < o.y + size.h;
    return hits ? [i] : [];
  });

export const issueMessage = (issue: Issue, catalog: Catalog): MessageRef =>
  issue.code === 'overlap'
    ? message('farmPlanner.issue.overlap', {
        name: issue.other
          ? (catalog.get(issue.other)?.name ?? issue.other)
          : message('farmPlanner.issue.otherObject'),
      })
    : message(`farmPlanner.issue.${issue.code}`);
