import { describe, expect, it } from 'vitest';
import { mergeTileIndexes, mergeTiles } from './paths';

describe('mergeTiles', () => {
  it('merges a 3-tile row into one rect', () => {
    const objs = [0, 1, 2].map((x) => ({ t: 'a', x, y: 0 }));
    expect(mergeTiles(objs, 'a')).toBe('M0 0h3v1h-3z');
  });
  it('splits runs with gaps and sorts by y then x', () => {
    const objs = [
      { t: 'a', x: 4, y: 1 },
      { t: 'a', x: 2, y: 0 },
      { t: 'a', x: 0, y: 0 },
      { t: 'a', x: 1, y: 0 },
      { t: 'b', x: 9, y: 9 },
    ];
    expect(mergeTiles(objs, 'a')).toBe('M0 0h3v1h-3zM4 1h1v1h-1z');
  });
  it('returns an empty string without tiles', () => {
    expect(mergeTiles([{ t: 'b', x: 0, y: 0 }], 'a')).toBe('');
  });
  it('ignores duplicates', () => {
    const objs = [
      { t: 'a', x: 0, y: 0 },
      { t: 'a', x: 0, y: 0 },
    ];
    expect(mergeTiles(objs, 'a')).toBe('M0 0h1v1h-1z');
  });
});

describe('mergeTileIndexes', () => {
  it('should merge a row of tile indexes when they are adjacent', () => {
    expect(mergeTileIndexes([0, 1, 2], 10)).toBe('M0 0h3v1h-3z');
  });

  it('should split runs by row when indexes wrap to the next row', () => {
    expect(mergeTileIndexes(new Set([19, 9, 10]), 10)).toBe(
      'M9 0h1v1h-1zM0 1h1v1h-1zM9 1h1v1h-1z',
    );
  });
});

describe('mergeTiles with off-map objects', () => {
  it('should keep negative coordinates when objects are parked off the map', () => {
    const objects = [
      { t: 'soil', x: -3, y: 0 },
      { t: 'soil', x: 5, y: 0 },
      { t: 'soil', x: -1, y: 1 },
    ];
    expect(mergeTiles(objects, 'soil')).toBe(
      'M-3 0h1v1h-1zM5 0h1v1h-1zM-1 1h1v1h-1z',
    );
  });
});
