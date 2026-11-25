import type { PlantableOut } from '../generated/stardew-valley-api/types.gen';
import { textOf } from './messageText.spec-helpers';
import { describePlantable, filterPlantables } from './plantables';

const STRAWBERRY: PlantableOut = {
  id: 'strawberry-seeds',
  name: { en: 'Strawberry Seeds', ptBr: 'Sementes de Morango' },
  kind: 'crop',
  seasons: ['spring'],
  growthDays: 8,
  regrowDays: 4,
};
const MELON: PlantableOut = {
  id: 'melon-seeds',
  name: { en: 'Melon Seeds' },
  kind: 'crop',
  seasons: ['summer'],
  growthDays: 12,
};
const APPLE: PlantableOut = {
  id: 'apple-sapling',
  name: { en: 'Apple Sapling' },
  kind: 'fruit_tree',
  seasons: ['fall'],
  daysToMature: 28,
};
const ALL = [STRAWBERRY, MELON, APPLE];

describe('filterPlantables', () => {
  it('should keep only season crops and saplings when location is the farm', () => {
    expect(
      filterPlantables(ALL, 'summer', 'farm', 'planted').map((p) => p.id),
    ).toEqual(['melon-seeds', 'apple-sapling']);
  });

  it('should keep every plantable when location is the greenhouse', () => {
    expect(
      filterPlantables(ALL, 'summer', 'greenhouse', 'planted'),
    ).toHaveLength(3);
  });

  it('should keep only regrowing crops when starting from a harvest', () => {
    expect(
      filterPlantables(ALL, 'spring', 'farm', 'harvested').map((p) => p.id),
    ).toEqual(['strawberry-seeds']);
  });
});

describe('describePlantable', () => {
  it('should show seasons, days and regrowth when plantable is a regrowing crop', () => {
    expect(textOf(describePlantable(STRAWBERRY))).toBe(
      'Primavera · 8 dias · rebrota 4',
    );
  });

  it('should show maturity days when plantable is a fruit tree', () => {
    expect(textOf(describePlantable(APPLE))).toBe('Outono · árvore: 28 dias');
  });
});
