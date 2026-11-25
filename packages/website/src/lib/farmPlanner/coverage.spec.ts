import { describe, expect, it } from 'vitest';
import {
  coverage,
  coverageKind,
  coverageSummary,
  rangeTiles,
} from './coverage';
import type { Catalog, PlacedObject, PlannerObjectDef, Terrain } from './types';

const open = (width: number, height: number): Terrain => ({
  farmId: 'open',
  width,
  height,
  tiles: Array(width * height).fill('f'),
  fixed: [],
});

const def = (
  id: string,
  range?: PlannerObjectDef['range'],
): PlannerObjectDef => ({
  id,
  name: id,
  icon: null,
  category: 'planting',
  size: { w: 1, h: 1 },
  placement: id === 'tilled-soil' ? 'diggable' : 'any',
  paint: id === 'tilled-soil',
  removable: true,
  range,
});

const sprinkler = def('sprinkler', { shape: 'diamond', radius: 1 });
const quality = def('quality-sprinkler', { shape: 'square', radius: 1 });
const iridium = def('iridium-sprinkler', { shape: 'square', radius: 2 });
const scarecrow = def('scarecrow', { shape: 'circle', radius: 8 });
const deluxe = def('deluxe-scarecrow', { shape: 'circle', radius: 16 });
const soil = def('tilled-soil');

const catalog: Catalog = new Map(
  [sprinkler, quality, iridium, scarecrow, deluxe, soil].map((d) => [d.id, d]),
);

describe('rangeTiles', () => {
  it.each([
    [sprinkler, 4],
    [quality, 8],
    [iridium, 24],
    [scarecrow, 248],
  ])('should cover the game tile count when the object is %s', (d, n) => {
    expect(rangeTiles(d, 20, 20, open(40, 40))).toHaveLength(n);
  });

  it('should cover 888 tiles when the object is a deluxe scarecrow', () => {
    expect(rangeTiles(deluxe, 40, 40, open(80, 80))).toHaveLength(888);
  });

  it('should exclude the object tile when computing a range', () => {
    const t = open(10, 10);
    expect(rangeTiles(iridium, 5, 5, t)).not.toContain(5 * 10 + 5);
  });

  it('should cut the range when it reaches the map edge', () => {
    expect(
      rangeTiles(quality, 0, 0, open(10, 10)).sort((a, b) => a - b),
    ).toEqual([1, 10, 11]);
  });

  it('should cover nothing when the object has no range', () => {
    expect(rangeTiles(soil, 5, 5, open(10, 10))).toEqual([]);
    expect(coverageKind(soil)).toBeNull();
  });
});

describe('coverageKind', () => {
  it('should water when the range is a diamond or square and protect when it is a circle', () => {
    expect(coverageKind(sprinkler)).toBe('water');
    expect(coverageKind(iridium)).toBe('water');
    expect(coverageKind(scarecrow)).toBe('protect');
  });
});

describe('coverageSummary', () => {
  const t = open(10, 10);
  // Two overlapping quality sprinklers at (2,2) and (3,2); soil on 4 covered tiles and 2 far ones.
  const objects: PlacedObject[] = [
    { t: 'quality-sprinkler', x: 2, y: 2 },
    { t: 'quality-sprinkler', x: 3, y: 2 },
    { t: 'tilled-soil', x: 1, y: 1 },
    { t: 'tilled-soil', x: 2, y: 1 },
    { t: 'tilled-soil', x: 3, y: 1 },
    { t: 'tilled-soil', x: 4, y: 3 },
    { t: 'tilled-soil', x: 8, y: 8 },
    { t: 'tilled-soil', x: 9, y: 0 },
  ];

  it('should count each tilled tile once when sprinklers overlap', () => {
    const summary = coverageSummary(
      objects,
      catalog,
      t,
      coverage(objects, catalog, t),
    );
    expect(summary.tilled).toBe(6);
    expect(summary.watered).toBe(4);
    expect(summary.dry).toEqual([9, 88]);
  });

  it('should list every tilled tile as unprotected when there is no scarecrow', () => {
    const summary = coverageSummary(
      objects,
      catalog,
      t,
      coverage(objects, catalog, t),
    );
    expect(summary.protected).toBe(0);
    expect(summary.unprotected).toEqual([9, 11, 12, 13, 34, 88]);
  });

  it('should ignore covered tiles when they are not tilled', () => {
    const only: PlacedObject[] = [{ t: 'quality-sprinkler', x: 5, y: 5 }];
    const cov = coverage(only, catalog, t);
    expect(cov.watered.size).toBe(8);
    expect(coverageSummary(only, catalog, t, cov)).toEqual({
      tilled: 0,
      watered: 0,
      protected: 0,
      dry: [],
      unprotected: [],
    });
  });

  it('should protect tilled tiles when a scarecrow reaches them', () => {
    const withCrow: PlacedObject[] = [
      ...objects,
      { t: 'scarecrow', x: 5, y: 5 },
    ];
    const summary = coverageSummary(
      withCrow,
      catalog,
      t,
      coverage(withCrow, catalog, t),
    );
    expect(summary.protected).toBe(6);
    expect(summary.unprotected).toEqual([]);
  });
});

describe('coverage performance', () => {
  it('should compute coverage in under 300 ms when 2,000 deluxe scarecrows fill an 80x80 terrain', () => {
    const objects: PlacedObject[] = Array.from({ length: 2000 }, (_, i) => ({
      t: deluxe.id,
      x: i % 80,
      y: Math.floor(i / 80) * 3,
    }));
    const start = performance.now();
    coverage(objects, catalog, open(80, 80));
    expect(performance.now() - start).toBeLessThan(300);
  });
});
