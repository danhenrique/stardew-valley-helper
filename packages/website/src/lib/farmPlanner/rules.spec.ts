import { describe, expect, it } from 'vitest';
import { textOf } from '../messageText.spec-helpers';
import {
  canMove,
  checkPlacement,
  checkPlan,
  issueMessage,
  objectsInBox,
  paintRect,
} from './rules';
import { catalog, terrain } from './testFixtures.spec-helpers';
import type { PlacedObject, Terrain } from './types';

const codes = (o: PlacedObject, objects: PlacedObject[] = []) =>
  checkPlacement(o, { terrain, catalog, objects }).map((i) => i.code);

const scare = (x: number, y: number): PlacedObject => ({
  t: 'scarecrow',
  x,
  y,
});

describe('checkPlacement', () => {
  it('accepts a building on buildable tiles', () => {
    expect(codes({ t: 'shed', x: 1, y: 1 })).toEqual([]);
  });
  it('outside', () => {
    expect(codes({ t: 'shed', x: 5, y: 4 })).toEqual(['outside']);
  });
  it('notBuildable on diggable-only or free tiles', () => {
    expect(codes({ t: 'shed', x: 1, y: 2 })).toEqual(['notBuildable']);
    expect(codes({ t: 'shed', x: 0, y: 0 })).toEqual(['notBuildable']);
  });
  it('tilled soil on buildable tiles is fine, on free tiles is notDiggable', () => {
    expect(codes({ t: 'tilled-soil', x: 1, y: 1 })).toEqual([]);
    expect(codes({ t: 'tilled-soil', x: 1, y: 3 })).toEqual([]);
    expect(codes({ t: 'tilled-soil', x: 0, y: 0 })).toEqual(['notDiggable']);
  });
  it('any object on water or blocked is blockedTile', () => {
    expect(codes(scare(4, 2))).toEqual(['blockedTile']);
    expect(codes(scare(5, 2))).toEqual(['blockedTile']);
    expect(codes({ t: 'shed', x: 4, y: 2 })).toContain('blockedTile');
    expect(codes({ t: 'tilled-soil', x: 4, y: 2 })).toEqual(['blockedTile']);
  });
  it('overlap names the other object', () => {
    const objects = [{ t: 'shed', x: 1, y: 1 }];
    const issues = checkPlacement(scare(2, 2), { terrain, catalog, objects });
    expect(issues).toEqual([
      { level: 'error', code: 'overlap', other: 'shed' },
    ]);
    expect(textOf(issueMessage(issues[0]!, catalog))).toBe('Sobrepõe Galpão');
  });
  it('ignore lets an object stand on itself', () => {
    const objects = [{ t: 'shed', x: 1, y: 1 }];
    expect(
      checkPlacement(
        { t: 'shed', x: 2, y: 1 },
        { terrain, catalog, objects, ignore: new Set([0]) },
      ),
    ).toEqual([]);
  });
  it('fruit tree with a neighbor gets only a treeSpace warning', () => {
    const objects = [scare(2, 2)];
    const issues = checkPlacement(
      { t: 'apple-sapling', x: 1, y: 1 },
      { terrain, catalog, objects },
    );
    expect(issues).toEqual([{ level: 'warning', code: 'treeSpace' }]);
    expect(codes({ t: 'apple-sapling', x: 1, y: 1 })).toEqual([]);
  });
  it('warns when something stands in front of a door', () => {
    const objects = [scare(1, 3)];
    expect(codes({ t: 'shed', x: 1, y: 1 }, objects)).toEqual(['doorBlocked']);
    const coopObjects = [scare(1, 3)];
    expect(codes({ t: 'coop', x: 1, y: 1 }, coopObjects)).toEqual([
      'doorBlocked',
    ]);
  });
});

describe('checkPlacement door terrain', () => {
  // 2x3 terrain: two buildable rows, then the row in front of the shed door.
  const doorTerrain = (front: string): Terrain => ({
    farmId: 'door',
    width: 2,
    height: front ? 3 : 2,
    tiles: [...'bbbb', ...front] as Terrain['tiles'],
    fixed: [],
  });
  const doorCodes = (front: string) =>
    checkPlacement(
      { t: 'shed', x: 0, y: 0 },
      { terrain: doorTerrain(front), catalog, objects: [] },
    ).map((i) => i.code);

  it('should warn doorBlocked when the tile in front of the door is water', () => {
    expect(doorCodes('wf')).toEqual(['doorBlocked']);
  });
  it('should warn doorBlocked when the tile in front of the door is blocked', () => {
    expect(doorCodes('xf')).toEqual(['doorBlocked']);
  });
  it('should warn doorBlocked when the tile in front of the door is outside the map', () => {
    expect(doorCodes('')).toEqual(['doorBlocked']);
  });
  it('should give no warning when the tile in front of the door is free terrain', () => {
    expect(doorCodes('ff')).toEqual([]);
  });
});

describe('checkPlan', () => {
  it('flags an object on a blocked tile loaded from a saved plan', () => {
    const plan = checkPlan(terrain, catalog, [scare(0, 0), scare(5, 2)]);
    expect(plan.has(0)).toBe(false);
    expect(plan.get(1)?.[0]?.code).toBe('blockedTile');
  });
});

describe('checkPlan overlaps', () => {
  it('flags both of two stacked objects', () => {
    const plan = checkPlan(terrain, catalog, [scare(0, 0), scare(0, 0)]);
    expect(plan.get(0)).toEqual([
      { level: 'error', code: 'overlap', other: 'scarecrow' },
    ]);
    expect(plan.get(1)).toEqual([
      { level: 'error', code: 'overlap', other: 'scarecrow' },
    ]);
  });
  it('flags all of three stacked objects', () => {
    const plan = checkPlan(terrain, catalog, [
      scare(0, 0),
      scare(0, 0),
      scare(0, 0),
    ]);
    expect([...plan.keys()]).toEqual([0, 1, 2]);
  });
  it('ignores terrain.fixed: a moved farmhouse frees its original tiles', () => {
    const t = { ...terrain, fixed: [{ t: 'shed', x: 1, y: 1 }] };
    const objects = [scare(4, 3)];
    const ctx = { terrain: t, catalog, objects };
    expect(checkPlacement(scare(1, 1), ctx)).toEqual([]);
    expect(checkPlan(t, catalog, objects).size).toBe(0);
  });
});

describe('canMove', () => {
  it('refuses the whole move when only one object would overlap', () => {
    const objects = [
      { t: 'tilled-soil', x: 1, y: 1 },
      { t: 'tilled-soil', x: 2, y: 1 },
      { t: 'tilled-soil', x: 3, y: 1 },
    ];
    expect(canMove([0, 1], 1, 0, { terrain, catalog, objects })).toBe(false);
    expect(canMove([0, 1, 2], 1, 0, { terrain, catalog, objects })).toBe(true);
  });
});

describe('paintRect', () => {
  const soil = catalog.get('tilled-soil')!;
  it('paints only valid tiles', () => {
    const r = paintRect(
      soil,
      { x: 3, y: 1 },
      { x: 5, y: 2 },
      { terrain, catalog, objects: [] },
    );
    expect(r).toEqual([
      { t: 'tilled-soil', x: 3, y: 1 },
      { t: 'tilled-soil', x: 4, y: 1 },
      { t: 'tilled-soil', x: 3, y: 2 },
    ]);
  });
  it('accepts from greater than to (dragging up/left)', () => {
    const r = paintRect(
      soil,
      { x: 4, y: 2 },
      { x: 2, y: 1 },
      { terrain, catalog, objects: [] },
    );
    expect(r).toHaveLength(5);
  });
  it('3x2 area with one water tile gives 5', () => {
    const r = paintRect(
      soil,
      { x: 2, y: 1 },
      { x: 4, y: 2 },
      { terrain, catalog, objects: [] },
    );
    expect(r).toHaveLength(5);
  });
  it('refuses past the object limit', () => {
    const objects = Array.from({ length: 7998 }, () => ({
      t: 'scarecrow',
      x: 0,
      y: 0,
    }));
    expect(
      paintRect(
        soil,
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { terrain, catalog, objects },
      ),
    ).toEqual({ error: 'limit' });
  });
});

describe('issueMessage', () => {
  it('has a farmPlanner key for every code', () => {
    expect(issueMessage({ level: 'error', code: 'limit' }, catalog)).toEqual({
      key: 'farmPlanner.issue.limit',
    });
    expect(issueMessage({ level: 'error', code: 'outside' }, catalog)).toEqual({
      key: 'farmPlanner.issue.outside',
    });
  });

  it('has pt-BR and English text for the placement issues', () => {
    const issue = { level: 'error', code: 'treeSpace' } as const;
    expect(textOf(issueMessage(issue, catalog))).toBe(
      'Árvore frutífera precisa de 3×3 livres em volta',
    );
    expect(textOf(issueMessage(issue, catalog), 'en')).toBe(
      'Fruit trees need a free 3×3 area around them',
    );
    expect(
      textOf(issueMessage({ level: 'error', code: 'overlap' }, catalog)),
    ).toBe('Sobrepõe outro objeto');
  });
});

describe('objectsInBox', () => {
  const objects: PlacedObject[] = [
    { t: 'shed', x: 0, y: 0 },
    scare(3, 0),
    scare(5, 5),
    { t: 'gone', x: 2, y: 2 },
  ];

  it('should return the indexes of every object whose footprint intersects the box', () => {
    // The 2x2 shed reaches (1, 1), so a box starting there catches it; unknown objects count as 1x1.
    expect(objectsInBox(objects, catalog, { x: 1, y: 1, w: 3, h: 2 })).toEqual([
      0, 3,
    ]);
    expect(objectsInBox(objects, catalog, { x: 0, y: 0, w: 6, h: 6 })).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('should return nothing when the box only touches the edge of a footprint', () => {
    expect(objectsInBox(objects, catalog, { x: 2, y: 0, w: 1, h: 1 })).toEqual(
      [],
    );
  });
});
