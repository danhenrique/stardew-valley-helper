import type {
  GameEntityOut,
  LocalizedTextOut,
} from '../../generated/stardew-valley-api/types.gen';
import { isRecord } from '../events';
import { humanizeId, localizedName } from '../i18n';
import { hasIcon } from '../icons';
import type { Locale } from '../locale';
import type { PlannerObjectDef } from './types';

const CATEGORIES = ['building', 'planting', 'machine', 'decoration'] as const;
const PLACEMENTS = ['buildable', 'diggable', 'any'] as const;
const SHAPES = ['square', 'diamond', 'circle'] as const;

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

const pick = <T extends string>(
  list: readonly T[],
  v: unknown,
): T | undefined => list.find((x) => x === v);

const readRect = (v: unknown) => {
  if (!isRecord(v)) return undefined;
  const x = num(v['x']);
  const y = num(v['y']);
  if (x === undefined || y === undefined) return undefined;
  return { x, y, w: num(v['w']), h: num(v['h']) };
};

const toDef = (
  entity: GameEntityOut,
  names: Record<string, LocalizedTextOut>,
  locale: Locale,
): PlannerObjectDef | undefined => {
  const a = entity.attributes ?? {};
  const category = pick(CATEGORIES, a['category']);
  const placement = pick(PLACEMENTS, a['placement']);
  const size = isRecord(a['size']) ? a['size'] : undefined;
  const w = num(size?.['w']);
  const h = num(size?.['h']);
  if (!category || !placement || w === undefined || h === undefined) {
    return undefined;
  }
  const item = typeof a['item'] === 'string' ? a['item'] : undefined;
  const name =
    localizedName(entity.name, locale) ||
    (item ? localizedName(names[item], locale) : '') ||
    humanizeId(entity.id);

  const def: PlannerObjectDef = {
    id: entity.id,
    name,
    icon: item && hasIcon(item) ? item : null,
    category,
    size: { w, h },
    placement,
    paint: a['paint'] === true,
    removable: a['removable'] !== false,
  };

  const human = readRect(a['humanDoor']);
  if (human) def.humanDoor = { x: human.x, y: human.y };
  const animal = readRect(a['animalDoor']);
  if (animal) {
    def.animalDoor = {
      x: animal.x,
      y: animal.y,
      w: animal.w ?? 1,
      h: animal.h ?? 1,
    };
  }
  const range = isRecord(a['range']) ? a['range'] : undefined;
  const shape = pick(SHAPES, range?.['shape']);
  const radius = num(range?.['radius']);
  if (shape && radius !== undefined) def.range = { shape, radius };

  if (
    category === 'planting' &&
    placement === 'diggable' &&
    w === 1 &&
    h === 1 &&
    entity.id !== 'tilled-soil'
  ) {
    def.kind = 'fruitTree';
  }
  return def;
};

export const toCatalog = (
  entities: GameEntityOut[],
  names: Record<string, LocalizedTextOut>,
  locale: Locale,
): Map<string, PlannerObjectDef> => {
  const catalog = new Map<string, PlannerObjectDef>();
  for (const entity of entities) {
    const def = toDef(entity, names, locale);
    if (def) catalog.set(def.id, def);
  }
  return catalog;
};
