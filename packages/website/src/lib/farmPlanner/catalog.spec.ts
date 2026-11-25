import { describe, expect, it } from 'vitest';
import { toCatalog } from './catalog';
import { catalog } from './testFixtures.spec-helpers';

describe('toCatalog', () => {
  it('uses the entity name, else the names map, else a humanized id', () => {
    expect(catalog.get('shed')?.name).toBe('Galpão');
    expect(catalog.get('apple-sapling')?.name).toBe('Muda de Macieira');
    expect(catalog.get('tilled-soil')?.name).toBe('Tilled Soil');
    expect(catalog.get('scarecrow')?.name).toBe('Scarecrow');
  });
  it('reads doors and range, and marks only saplings as fruit trees', () => {
    expect(catalog.get('shed')?.humanDoor).toEqual({ x: 0, y: 1 });
    expect(catalog.get('coop')?.animalDoor).toEqual({ x: 0, y: 1, w: 1, h: 1 });
    expect(catalog.get('scarecrow')?.range).toEqual({
      shape: 'circle',
      radius: 8,
    });
    expect(catalog.get('apple-sapling')?.kind).toBe('fruitTree');
    expect(catalog.get('tilled-soil')?.kind).toBeUndefined();
    expect(catalog.get('scarecrow')?.kind).toBeUndefined();
  });
  it('skips entities with invalid attributes', () => {
    expect(
      toCatalog(
        [{ type: 'planner-objects', id: 'bad', attributes: {} }],
        {},
        'pt-BR',
      ).size,
    ).toBe(0);
  });
});
