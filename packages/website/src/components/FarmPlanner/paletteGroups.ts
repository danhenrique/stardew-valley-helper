import { coverageKind } from '../../lib/farmPlanner/coverage';
import type { PlannerObjectDef } from '../../lib/farmPlanner/types';
import { type MessageRef, message } from '../../lib/message';

type Category = PlannerObjectDef['category'];

export const CATEGORY_LABELS: Record<Category, MessageRef> = {
  building: message('farmPlanner.category.building'),
  planting: message('farmPlanner.category.planting'),
  machine: message('farmPlanner.category.machine'),
  decoration: message('farmPlanner.category.decoration'),
};

export type PaletteGroup = {
  /** Stable id, used to remember collapsed groups. */
  id: string;
  label: MessageRef;
  category: Category;
  defs: PlannerObjectDef[];
};

type GroupSpec = {
  id: string;
  label: MessageRef;
  test: (def: PlannerObjectDef) => boolean;
};

const all = () => true;

/** Groups of each category in display order; a def goes to the first group it passes. */
const SPECS: Record<Category, GroupSpec[]> = {
  building: [{ id: 'building', label: CATEGORY_LABELS.building, test: all }],
  planting: [
    // "Soil" takes what no other planting group does (tilled soil and the rest).
    {
      id: 'planting-soil',
      label: message('farmPlanner.group.soil'),
      test: (d) => !coverageKind(d) && d.kind !== 'fruitTree',
    },
    {
      id: 'planting-sprinklers',
      label: message('farmPlanner.group.sprinklers'),
      test: (d) => coverageKind(d) === 'water',
    },
    {
      id: 'planting-scarecrows',
      label: message('farmPlanner.group.scarecrows'),
      test: (d) => coverageKind(d) === 'protect',
    },
    {
      id: 'planting-fruit-trees',
      label: message('farmPlanner.group.fruitTrees'),
      test: (d) => d.kind === 'fruitTree',
    },
  ],
  machine: [{ id: 'machine', label: CATEGORY_LABELS.machine, test: all }],
  decoration: [
    {
      id: 'decoration-fences',
      label: message('farmPlanner.group.fences'),
      test: (d) => d.id.endsWith('-fence'),
    },
    {
      id: 'decoration-gates',
      label: message('farmPlanner.group.gates'),
      test: (d) => d.id === 'gate' || d.id.endsWith('-gate'),
    },
    {
      id: 'decoration-floors',
      label: message('farmPlanner.group.floors'),
      test: all,
    },
  ],
};

/** Splits defs (kept in their given order) into the palette groups, skipping empty ones. */
export const paletteGroups = (defs: PlannerObjectDef[]): PaletteGroup[] =>
  (Object.keys(CATEGORY_LABELS) as Category[]).flatMap((category) => {
    const specs = SPECS[category];
    const groups = new Map<string, PaletteGroup>(
      specs.map((s) => [
        s.id,
        { id: s.id, label: s.label, category, defs: [] },
      ]),
    );
    for (const def of defs) {
      if (def.category !== category) continue;
      const spec = specs.find((s) => s.test(def)) as GroupSpec;
      groups.get(spec.id)?.defs.push(def);
    }
    return [...groups.values()].filter((g) => g.defs.length > 0);
  });
