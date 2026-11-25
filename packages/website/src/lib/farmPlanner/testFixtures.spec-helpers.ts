import { toCatalog } from './catalog';
import type { Terrain } from './types';

// Hand-built 6x5 terrain:
//   row0: f f f f f f
//   row1: f b b b b f
//   row2: f b b b w x
//   row3: f d d b b f
//   row4: f f f f f f
export const terrain: Terrain = {
  farmId: 'test',
  width: 6,
  height: 5,
  tiles: [...'ffffff', ...'fbbbbf', ...'fbbbwx', ...'fdddbf', ...'ffffff'].map(
    (c) => c,
  ) as Terrain['tiles'],
  fixed: [],
};

const attrs = (a: Record<string, unknown>) => a;

export const catalog = toCatalog(
  [
    {
      type: 'planner-objects',
      id: 'shed',
      name: { en: 'Shed', ptBr: 'Galpão' },
      attributes: attrs({
        item: 'shed',
        category: 'building',
        placement: 'buildable',
        size: { w: 2, h: 2 },
        paint: false,
        removable: true,
        humanDoor: { x: 0, y: 1 },
      }),
    },
    {
      type: 'planner-objects',
      id: 'tilled-soil',
      attributes: attrs({
        item: 'tilled-soil',
        category: 'planting',
        placement: 'diggable',
        size: { w: 1, h: 1 },
        paint: true,
        removable: true,
      }),
    },
    {
      type: 'planner-objects',
      id: 'apple-sapling',
      attributes: attrs({
        item: 'apple-sapling',
        category: 'planting',
        placement: 'diggable',
        size: { w: 1, h: 1 },
        paint: false,
        removable: true,
      }),
    },
    {
      type: 'planner-objects',
      id: 'scarecrow',
      attributes: attrs({
        item: 'scarecrow',
        category: 'machine',
        placement: 'any',
        size: { w: 1, h: 1 },
        paint: true,
        removable: true,
        range: { shape: 'circle', radius: 8 },
      }),
    },
    {
      type: 'planner-objects',
      id: 'coop',
      attributes: attrs({
        item: 'coop',
        category: 'building',
        placement: 'buildable',
        size: { w: 3, h: 2 },
        paint: false,
        removable: true,
        animalDoor: { x: 0, y: 1, w: 1, h: 1 },
      }),
    },
  ],
  {
    'apple-sapling': { en: 'Apple Sapling', ptBr: 'Muda de Macieira' },
    'tilled-soil': { en: 'Tilled Soil' },
  },
  'pt-BR',
);
