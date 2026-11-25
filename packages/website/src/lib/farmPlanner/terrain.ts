import type { GameEntityDetailOut } from '../../generated/stardew-valley-api/types.gen';
import { isRecord } from '../events';
import type { PlacedObject, Terrain, TileCode } from './types';

const RUN = /(\d+)([fdbcwx])/y;
const CODES = new Set<string>(['f', 'd', 'b', 'c', 'w', 'x']);

export const decodeTiles = (
  rle: string,
  width: number,
  height: number,
): TileCode[] => {
  const total = width * height;
  const tiles: TileCode[] = [];
  RUN.lastIndex = 0;
  let pos = 0;
  while (pos < rle.length) {
    RUN.lastIndex = pos;
    const m = RUN.exec(rle);
    if (!m) throw new Error(`Invalid tile run at position ${pos}`);
    const count = Number(m[1]);
    if (tiles.length + count > total) {
      throw new Error(`Tile data exceeds ${width}x${height}`);
    }
    for (let i = 0; i < count; i++) tiles.push(m[2] as TileCode);
    pos = RUN.lastIndex;
  }
  if (tiles.length !== total) {
    throw new Error(
      `Tile data has ${tiles.length} tiles, expected ${total} (${width}x${height})`,
    );
  }
  return tiles;
};

const asInt = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) ? value : undefined;

export const toTerrain = (entity: GameEntityDetailOut): Terrain => {
  const a = entity.attributes ?? {};
  const width = asInt(a['width']);
  const height = asInt(a['height']);
  const rle = a['tiles'];
  if (width === undefined || height === undefined || typeof rle !== 'string') {
    throw new Error(`Farm ${entity.id} has no terrain data`);
  }
  const fixedRaw = Array.isArray(a['fixed']) ? a['fixed'] : [];
  const fixed: PlacedObject[] = [];
  for (const f of fixedRaw) {
    if (!isRecord(f)) continue;
    const x = asInt(f['x']);
    const y = asInt(f['y']);
    if (typeof f['t'] === 'string' && x !== undefined && y !== undefined) {
      fixed.push({ t: f['t'], x, y });
    }
  }
  return {
    farmId: entity.id,
    width,
    height,
    tiles: decodeTiles(rle, width, height),
    fixed,
  };
};

export const isTileCode = (value: string): value is TileCode =>
  CODES.has(value);
