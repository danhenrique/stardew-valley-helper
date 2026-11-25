import type { PlacedObject } from './types';

/** SVG path `d` (tile units) covering tiles given as indexes (`y * width + x`); each row run is one rect. */
export const mergeTileIndexes = (
  indexes: Iterable<number>,
  width: number,
): string => {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i];
    const y = Math.floor(start / width);
    let end = start + 1;
    i++;
    while (
      i < sorted.length &&
      sorted[i] === end &&
      Math.floor(sorted[i] / width) === y
    ) {
      end++;
      i++;
    }
    const n = end - start;
    parts.push(`M${start - y * width} ${y}h${n}v1h-${n}z`);
  }
  return parts.join('');
};

/** SVG path `d` (tile units) covering every tile of id `t`; row-adjacent tiles share one rect. */
export const mergeTiles = (objects: PlacedObject[], t: string): string => {
  const tiles = objects
    .filter((o) => o.t === t)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const parts: string[] = [];
  let i = 0;
  while (i < tiles.length) {
    const { x, y } = tiles[i];
    let end = x + 1;
    i++;
    while (i < tiles.length && tiles[i].y === y && tiles[i].x <= end) {
      end = Math.max(end, tiles[i].x + 1);
      i++;
    }
    const n = end - x;
    parts.push(`M${x} ${y}h${n}v1h-${n}z`);
  }
  return parts.join('');
};
