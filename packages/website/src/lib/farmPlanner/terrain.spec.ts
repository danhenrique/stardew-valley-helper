import { describe, expect, it } from 'vitest';
import { decodeTiles, toTerrain } from './terrain';

describe('decodeTiles', () => {
  it('expands runs row-major', () => {
    expect(decodeTiles('2f1b1c', 2, 2)).toEqual(['f', 'f', 'b', 'c']);
  });
  it('throws on a length mismatch', () => {
    expect(() => decodeTiles('3x', 2, 2)).toThrow();
    expect(() => decodeTiles('1x', 2, 2)).toThrow();
    expect(() => decodeTiles('2x2q', 2, 2)).toThrow();
  });
});

describe('toTerrain', () => {
  it('reads the farm attributes', () => {
    const t = toTerrain({
      type: 'farms',
      id: 'standard',
      attributes: {
        width: 2,
        height: 1,
        tiles: '1f1w',
        fixed: [{ t: 'house', x: 0, y: 0 }, { bad: 1 }],
      },
    });
    expect(t).toEqual({
      farmId: 'standard',
      width: 2,
      height: 1,
      tiles: ['f', 'w'],
      fixed: [{ t: 'house', x: 0, y: 0 }],
    });
  });
  it('throws without terrain data', () => {
    expect(() => toTerrain({ type: 'farms', id: 'x' })).toThrow();
  });
});
