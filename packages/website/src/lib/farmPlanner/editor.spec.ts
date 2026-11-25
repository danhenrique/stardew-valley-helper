import { describe, expect, it } from 'vitest';
import { type EditorState, editorReducer, loadPlan } from './editor';
import { catalog as baseCatalog, terrain } from './testFixtures.spec-helpers';
import {
  type Catalog,
  MAX_OBJECTS,
  type PlacedObject,
  type Terrain,
} from './types';

const catalog: Catalog = new Map(baseCatalog);
catalog.set('farmhouse', {
  id: 'farmhouse',
  name: 'Farmhouse',
  icon: null,
  category: 'building',
  size: { w: 2, h: 2 },
  placement: 'buildable',
  paint: false,
  removable: false,
});

const init = (objects: PlacedObject[] = []): EditorState => ({
  objects,
  past: [],
  future: [],
  selection: new Set(),
  dirty: false,
});
const ctxOf = (s: EditorState, t: Terrain = terrain) => ({
  terrain: t,
  catalog,
  objects: s.objects,
});
const run = (
  s: EditorState,
  a: Parameters<typeof editorReducer>[1],
  t?: Terrain,
) => editorReducer(s, a, ctxOf(s, t));

const scare = (x: number, y: number): PlacedObject => ({
  t: 'scarecrow',
  x,
  y,
});

describe('editorReducer', () => {
  it('place, undo, redo', () => {
    const s1 = run(init(), { type: 'place', object: scare(0, 0) });
    expect(s1.objects).toEqual([scare(0, 0)]);
    expect(s1.dirty).toBe(true);
    const s2 = run(s1, { type: 'undo' });
    expect(s2.objects).toEqual([]);
    expect(s2.future).toHaveLength(1);
    const s3 = run(s2, { type: 'redo' });
    expect(s3.objects).toEqual([scare(0, 0)]);
  });

  it('refuses an invalid place with the same reference', () => {
    const s = init();
    expect(run(s, { type: 'place', object: scare(5, 2) })).toBe(s);
  });

  it('allows warnings', () => {
    const s = init([{ t: 'shed', x: 1, y: 1 }]);
    const next = run(s, {
      type: 'place',
      object: { t: 'apple-sapling', x: 1, y: 3 },
    });
    expect(next.objects).toHaveLength(2);
  });

  it('a paint is one undo step', () => {
    const s = run(init(), {
      type: 'paint',
      objects: [scare(0, 0), scare(1, 0), scare(2, 0)],
    });
    expect(s.objects).toHaveLength(3);
    expect(run(s, { type: 'undo' }).objects).toEqual([]);
  });

  it('empty paint is a no-op', () => {
    const s = init();
    expect(run(s, { type: 'paint', objects: [] })).toBe(s);
  });

  it('refuses a place at the 8,000 object limit with the same reference', () => {
    // Parked outside the map, so they neither collide with nor crowd the candidate.
    const full = init(
      Array.from({ length: MAX_OBJECTS }, () => scare(-50, -50)),
    );
    expect(run(full, { type: 'place', object: scare(0, 0) })).toBe(full);
    const room = init(
      Array.from({ length: MAX_OBJECTS - 1 }, () => scare(-50, -50)),
    );
    expect(
      run(room, { type: 'place', object: scare(0, 0) }).objects,
    ).toHaveLength(MAX_OBJECTS);
  });

  it('refuses a paint that would pass the 8,000 object limit', () => {
    const s = init(
      Array.from({ length: MAX_OBJECTS - 1 }, () => scare(-50, -50)),
    );
    expect(run(s, { type: 'paint', objects: [scare(0, 0), scare(1, 0)] })).toBe(
      s,
    );
  });

  it('new edit clears future', () => {
    const s1 = run(init(), { type: 'place', object: scare(0, 0) });
    const s2 = run(s1, { type: 'undo' });
    const s3 = run(s2, { type: 'place', object: scare(1, 0) });
    expect(s3.future).toEqual([]);
  });

  it('caps history at 100', () => {
    const big: Terrain = {
      farmId: 'big',
      width: 200,
      height: 1,
      tiles: Array<'f'>(200).fill('f'),
      fixed: [],
    };
    let s = init();
    for (let i = 0; i < 101; i++) {
      s = run(s, { type: 'place', object: scare(i, 0) }, big);
    }
    expect(s.objects).toHaveLength(101);
    expect(s.past).toHaveLength(100);
  });

  it('keeps non-removable objects on delete', () => {
    const s = init([{ t: 'farmhouse', x: 1, y: 1 }]);
    expect(run(s, { type: 'delete', indexes: [0] })).toBe(s);
  });

  it('deletes removable ones only and clears selection', () => {
    const s = {
      ...init([{ t: 'farmhouse', x: 1, y: 1 }, scare(0, 0)]),
      selection: new Set([0, 1]),
    };
    const next = run(s, { type: 'delete', indexes: [0, 1] });
    expect(next.objects).toEqual([{ t: 'farmhouse', x: 1, y: 1 }]);
    expect(next.selection.size).toBe(0);
    expect(next.past).toHaveLength(1);
  });

  it('moves when allowed and refuses otherwise with the same reference', () => {
    const s = init([scare(0, 0)]);
    const moved = run(s, { type: 'move', indexes: [0], dx: 1, dy: 0 });
    expect(moved.objects).toEqual([scare(1, 0)]);
    const refused = run(s, { type: 'move', indexes: [0], dx: -1, dy: 0 });
    expect(refused).toBe(s);
    expect(refused.objects).toBe(s.objects);
  });

  it('select, saved and reset', () => {
    const s1 = run(init(), { type: 'place', object: scare(0, 0) });
    const sel = run(s1, { type: 'select', indexes: [0] });
    expect([...sel.selection]).toEqual([0]);
    expect(run(s1, { type: 'saved' }).dirty).toBe(false);
    expect(run(s1, { type: 'saved' }).past).toBe(s1.past);
    const r = run(s1, { type: 'reset', objects: [scare(2, 2)] });
    expect(r.objects).toEqual([scare(2, 2)]);
    expect(r.past).toEqual([]);
    expect(r.future).toEqual([]);
    expect(r.dirty).toBe(false);
  });

  it('undo clears selection', () => {
    const s1 = run(init(), { type: 'place', object: scare(0, 0) });
    const sel = run(s1, { type: 'select', indexes: [0] });
    expect(run(sel, { type: 'undo' }).selection.size).toBe(0);
  });
});

describe('loadPlan', () => {
  it('drops unknown ids', () => {
    const r = loadPlan([scare(0, 0), { t: 'gone', x: 1, y: 1 }], catalog);
    expect(r.objects).toEqual([scare(0, 0)]);
    expect(r.dropped).toBe(1);
  });
});
