import { fireEvent } from '@testing-library/react';
import type { FarmPlanOut } from '../../generated/stardew-valley-api/types.gen';
import type {
  Catalog,
  PlacedObject,
  PlannerObjectDef,
  Terrain,
  TileCode,
} from '../../lib/farmPlanner/types';
import { TILE_PX } from './useViewport';

// Hand-built 12x8 terrain: buildable everywhere, water at x 6..8 / y 0..1, diggable rows 6..7.
const tiles: TileCode[] = [];
for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 12; x++) {
    if (x >= 6 && x <= 8 && y <= 1) tiles.push('w');
    else if (y >= 6) tiles.push('d');
    else tiles.push('b');
  }
}
export const terrain: Terrain = {
  farmId: 'test',
  width: 12,
  height: 8,
  tiles,
  fixed: [],
};

const def = (
  id: string,
  name: string,
  extra: Partial<PlannerObjectDef> = {},
): PlannerObjectDef => ({
  id,
  name,
  icon: null,
  category: 'machine',
  size: { w: 1, h: 1 },
  placement: 'any',
  paint: false,
  removable: true,
  ...extra,
});

export const catalog: Catalog = new Map(
  [
    def('farmhouse', 'Casa da fazenda', {
      category: 'building',
      size: { w: 2, h: 2 },
      placement: 'buildable',
      removable: false,
    }),
    def('barn', 'Celeiro', {
      category: 'building',
      size: { w: 3, h: 2 },
      placement: 'buildable',
    }),
    def('tilled-soil', 'Terra arada', {
      category: 'planting',
      placement: 'diggable',
      paint: true,
    }),
    def('sprinkler', 'Aspersor', {
      category: 'planting',
      range: { shape: 'diamond', radius: 1 },
    }),
    def('quality-sprinkler', 'Aspersor de qualidade', {
      category: 'planting',
      range: { shape: 'square', radius: 1 },
    }),
    def('iridium-sprinkler', 'Aspersor com irídio', {
      category: 'planting',
      range: { shape: 'square', radius: 2 },
    }),
    def('scarecrow', 'Espantalho', {
      category: 'planting',
      range: { shape: 'circle', radius: 8 },
    }),
    def('stone-floor', 'Piso de pedra', {
      category: 'decoration',
      paint: true,
    }),
  ].map((d) => [d.id, d]),
);

export const FARMHOUSE: PlacedObject = { t: 'farmhouse', x: 0, y: 0 };

export const planWith = (objects: PlacedObject[]): FarmPlanOut => ({
  id: 'plan-1',
  name: 'Ano 1',
  farmId: 'test',
  version: 1,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  objects,
});

// jsdom has no layout: the map is unmeasured, so the view stays at 1x with no offset.
const at = (x: number, y: number) => ({
  clientX: x * TILE_PX + TILE_PX / 2,
  clientY: y * TILE_PX + TILE_PX / 2,
  button: 0,
  pointerId: 1,
});
export const hoverTile = (map: Element, x: number, y: number) =>
  fireEvent.pointerMove(map, at(x, y));
export const clickTile = (map: Element, x: number, y: number) => {
  fireEvent.pointerDown(map, at(x, y));
  fireEvent.pointerUp(map, at(x, y));
};
export const dragTiles = (
  map: Element,
  from: [number, number],
  to: [number, number],
) => {
  fireEvent.pointerDown(map, at(...from));
  fireEvent.pointerMove(map, at(...to));
  fireEvent.pointerUp(map, at(...to));
};
