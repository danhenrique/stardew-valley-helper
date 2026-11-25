/** f free, d diggable (not buildable), b buildable and diggable, c buildable (not diggable), w water, x blocked. */
export type TileCode = 'f' | 'd' | 'b' | 'c' | 'w' | 'x';

export type PlacedObject = { t: string; x: number; y: number };

export type Terrain = {
  farmId: string;
  width: number;
  height: number;
  tiles: TileCode[];
  fixed: PlacedObject[];
};

export type PlannerObjectDef = {
  id: string;
  name: string;
  icon: string | null;
  category: 'building' | 'planting' | 'machine' | 'decoration';
  size: { w: number; h: number };
  placement: 'buildable' | 'diggable' | 'any';
  paint: boolean;
  removable: boolean;
  humanDoor?: { x: number; y: number };
  animalDoor?: { x: number; y: number; w: number; h: number };
  range?: { shape: 'square' | 'diamond' | 'circle'; radius: number };
  /** Fruit trees (planting, diggable, 1x1, not tilled soil) need free tiles around them. */
  kind?: 'fruitTree';
};

export type Catalog = Map<string, PlannerObjectDef>;

export type Issue = {
  level: 'error' | 'warning';
  code:
    | 'overlap'
    | 'outside'
    | 'notBuildable'
    | 'notDiggable'
    | 'blockedTile'
    | 'treeSpace'
    | 'doorBlocked'
    | 'limit';
  other?: string;
};

export const MAX_OBJECTS = 8000;
