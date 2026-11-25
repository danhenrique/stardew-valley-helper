import type { Catalog, PlacedObject, PlannerObjectDef, Terrain } from './types';

const TILLED = 'tilled-soil';

/** Sets of tile indexes (`y * width + x`). */
export type Coverage = { watered: Set<number>; protected: Set<number> };

export type CoverageSummary = {
  tilled: number;
  watered: number;
  protected: number;
  dry: number[];
  unprotected: number[];
};

/** Sprinklers (diamond/square ranges) water; scarecrows (circle ranges) protect. */
export const coverageKind = (
  def: PlannerObjectDef,
): 'water' | 'protect' | null => {
  if (def.category !== 'planting' || !def.range) return null;
  return def.range.shape === 'circle' ? 'protect' : 'water';
};

type Range = NonNullable<PlannerObjectDef['range']>;

const inRange = (
  shape: Range['shape'],
  r: number,
  dx: number,
  dy: number,
): boolean => {
  switch (shape) {
    case 'diamond':
      return Math.abs(dx) + Math.abs(dy) <= r;
    case 'square':
      return Math.max(Math.abs(dx), Math.abs(dy)) <= r;
    case 'circle':
      // The game protects tiles closer than radius + 1 (248 tiles for a radius-8 scarecrow).
      return dx * dx + dy * dy < (r + 1) * (r + 1);
  }
};

/** (dx, dy) pairs in range, without (0, 0), flattened; computed once per shape and radius. */
const OFFSETS = new Map<string, Int32Array>();

const offsetsOf = ({ shape, radius: r }: Range): Int32Array => {
  const key = `${shape}:${r}`;
  let offsets = OFFSETS.get(key);
  if (!offsets) {
    const list: number[] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if ((dx !== 0 || dy !== 0) && inRange(shape, r, dx, dy))
          list.push(dx, dy);
      }
    }
    offsets = Int32Array.from(list);
    OFFSETS.set(key, offsets);
  }
  return offsets;
};

/** Calls `visit` with each tile covered from (x, y), cut at the map edge. */
const forEachInRange = (
  range: Range,
  x: number,
  y: number,
  terrain: Terrain,
  visit: (tile: number) => void,
) => {
  const offsets = offsetsOf(range);
  const { width, height } = terrain;
  for (let i = 0; i < offsets.length; i += 2) {
    const tx = x + offsets[i];
    const ty = y + offsets[i + 1];
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
    visit(ty * width + tx);
  }
};

/** Tiles covered by one object at (x, y), without its own tile and cut at the map edge. */
export const rangeTiles = (
  def: PlannerObjectDef,
  x: number,
  y: number,
  terrain: Terrain,
): number[] => {
  if (!def.range) return [];
  const tiles: number[] = [];
  forEachInRange(def.range, x, y, terrain, (tile) => tiles.push(tile));
  return tiles;
};

export const coverage = (
  objects: PlacedObject[],
  catalog: Catalog,
  terrain: Terrain,
): Coverage => {
  const cov: Coverage = { watered: new Set(), protected: new Set() };
  for (const o of objects) {
    const def = catalog.get(o.t);
    const kind = def && coverageKind(def);
    if (!def?.range || !kind) continue;
    const target = kind === 'water' ? cov.watered : cov.protected;
    forEachInRange(def.range, o.x, o.y, terrain, (tile) => target.add(tile));
  }
  return cov;
};

/** Counts over tilled tiles only; `dry`/`unprotected` are the uncovered ones, ascending. */
export const coverageSummary = (
  objects: PlacedObject[],
  _catalog: Catalog,
  terrain: Terrain,
  cov: Coverage,
): CoverageSummary => {
  const tilled = [
    ...new Set(
      objects
        .filter(
          (o) =>
            o.t === TILLED &&
            o.x >= 0 &&
            o.y >= 0 &&
            o.x < terrain.width &&
            o.y < terrain.height,
        )
        .map((o) => o.y * terrain.width + o.x),
    ),
  ].sort((a, b) => a - b);
  const dry = tilled.filter((t) => !cov.watered.has(t));
  const unprotected = tilled.filter((t) => !cov.protected.has(t));
  return {
    tilled: tilled.length,
    watered: tilled.length - dry.length,
    protected: tilled.length - unprotected.length,
    dry,
    unprotected,
  };
};
