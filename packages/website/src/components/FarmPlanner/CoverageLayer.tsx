import { memo } from 'react';
import type { Coverage, CoverageSummary } from '../../lib/farmPlanner/coverage';
import { mergeTileIndexes } from '../../lib/farmPlanner/paths';

export const WATER_FILL = 'fill-sky-400/30 dark:fill-sky-300/30';
export const PROTECT_FILL = 'fill-emerald-400/20 dark:fill-emerald-300/20';
const OUTLINE = 'fill-none [stroke-width:1.5]';

/** Watered and protected areas plus outlines of dry and unprotected tilled tiles; never takes pointer events. */
export const CoverageLayer = memo(function CoverageLayer({
  cov,
  summary,
  width,
}: {
  cov: Coverage;
  summary: CoverageSummary;
  width: number;
}) {
  return (
    <g data-layer="coverage" className="pointer-events-none">
      <path d={mergeTileIndexes(cov.watered, width)} className={WATER_FILL} />
      <path
        d={mergeTileIndexes(cov.protected, width)}
        className={PROTECT_FILL}
      />
      <path
        d={mergeTileIndexes(summary.dry, width)}
        vectorEffect="non-scaling-stroke"
        className={`${OUTLINE} stroke-orange-500 dark:stroke-orange-400`}
      />
      <path
        d={mergeTileIndexes(summary.unprotected, width)}
        vectorEffect="non-scaling-stroke"
        className={`${OUTLINE} stroke-red-500 [stroke-dasharray:3_2] dark:stroke-red-400`}
      />
    </g>
  );
});

/** The range of one sprinkler (water) or scarecrow (protect). */
export const RangePreview = ({
  tiles,
  kind,
  width,
}: {
  tiles: number[];
  kind: 'water' | 'protect';
  width: number;
}) => (
  <path
    data-layer="range-preview"
    d={mergeTileIndexes(tiles, width)}
    className={`pointer-events-none ${kind === 'water' ? WATER_FILL : PROTECT_FILL}`}
  />
);
