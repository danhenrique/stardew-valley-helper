import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Catalog, PlannerObjectDef } from '../../lib/farmPlanner/types';
import { iconUrl } from '../../lib/icons';
import { ObjectsLayer } from './MapLayers';

const paintDef = (
  id: string,
  category: PlannerObjectDef['category'],
  icon: string | null,
): PlannerObjectDef => ({
  id,
  name: id,
  icon,
  category,
  size: { w: 1, h: 1 },
  placement: 'any',
  paint: true,
  removable: true,
});

const catalog: Catalog = new Map(
  [
    paintDef('wood-floor', 'decoration', 'wood-floor'),
    paintDef('tilled-soil', 'planting', null),
  ].map((d) => [d.id, d]),
);

const renderLayer = (t: string) =>
  render(
    <svg>
      <ObjectsLayer
        objects={[
          { t, x: 0, y: 0 },
          { t, x: 1, y: 0 },
        ]}
        catalog={catalog}
      />
    </svg>,
  ).container;

afterEach(() => {
  cleanup();
});

describe('ObjectsLayer', () => {
  it('should fill a painted floor with a pattern of its icon when the def has an icon', () => {
    const container = renderLayer('wood-floor');
    const paths = container.querySelectorAll('path[data-object="wood-floor"]');
    expect(paths).toHaveLength(1);
    const fill = paths[0].getAttribute('fill') ?? '';
    expect(fill).toMatch(/^url\(#/);
    const patternId = fill.slice('url(#'.length, -1);
    const pattern = container.querySelector(`pattern[id="${patternId}"]`);
    expect(pattern).not.toBeNull();
    expect(pattern?.getAttribute('patternUnits')).toBe('userSpaceOnUse');
    expect(pattern?.querySelector('image')?.getAttribute('href')).toBe(
      iconUrl('wood-floor'),
    );
  });

  it('should keep the class fill when a painted def has no icon', () => {
    const container = renderLayer('tilled-soil');
    const path = container.querySelector('path[data-object="tilled-soil"]');
    expect(path?.getAttribute('fill')).toBeNull();
    expect(path).toHaveClass('fill-amber-900/50');
    expect(container.querySelector('pattern')).toBeNull();
  });
});
