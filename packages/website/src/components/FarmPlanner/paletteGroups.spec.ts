import { describe, expect, it } from 'vitest';
import type { PlannerObjectDef } from '../../lib/farmPlanner/types';
import { textOf } from '../../lib/messageText.spec-helpers';
import { paletteGroups } from './paletteGroups';

const def = (
  id: string,
  category: PlannerObjectDef['category'],
  extra: Partial<PlannerObjectDef> = {},
): PlannerObjectDef => ({
  id,
  name: id,
  icon: null,
  category,
  size: { w: 1, h: 1 },
  placement: 'any',
  paint: false,
  removable: true,
  ...extra,
});

const defs = [
  def('barn', 'building'),
  def('tilled-soil', 'planting', { paint: true }),
  def('sprinkler', 'planting', { range: { shape: 'diamond', radius: 1 } }),
  def('scarecrow', 'planting', { range: { shape: 'circle', radius: 8 } }),
  def('apple-sapling', 'planting', { kind: 'fruitTree' }),
  def('keg', 'machine'),
  def('wood-fence', 'decoration'),
  def('gate', 'decoration'),
  def('iron-gate', 'decoration'),
  def('stone-floor', 'decoration'),
];

const summary = (list: PlannerObjectDef[]) =>
  paletteGroups(list).map((g) => [textOf(g.label), g.defs.map((d) => d.id)]);

describe('paletteGroups', () => {
  it('should put each def in its type group when every group has defs', () => {
    expect(summary(defs)).toEqual([
      ['Construções', ['barn']],
      ['Solo', ['tilled-soil']],
      ['Aspersores', ['sprinkler']],
      ['Espantalhos', ['scarecrow']],
      ['Árvores frutíferas', ['apple-sapling']],
      ['Máquinas', ['keg']],
      ['Cercas', ['wood-fence']],
      ['Portões', ['gate', 'iron-gate']],
      ['Pisos e caminhos', ['stone-floor']],
    ]);
  });

  it('should tag each group with its category and a unique id', () => {
    const groups = paletteGroups(defs);
    expect(new Set(groups.map((g) => g.id)).size).toBe(groups.length);
    expect(groups.find((g) => textOf(g.label) === 'Cercas')?.category).toBe(
      'decoration',
    );
  });

  it('should skip a group when it has no defs', () => {
    expect(summary([def('keg', 'machine'), def('gate', 'decoration')])).toEqual(
      [
        ['Máquinas', ['keg']],
        ['Portões', ['gate']],
      ],
    );
  });
});
