import { useTranslations } from 'use-intl';
import type { CoverageSummary } from '../../lib/farmPlanner/coverage';
import { PROTECT_FILL, WATER_FILL } from './CoverageLayer';

// Floor, so 100% only ever means fully covered.
const percent = (n: number, of: number) => Math.floor((n / of) * 100);

const Swatch = ({ className }: { className: string }) => (
  <svg viewBox="0 0 1 1" aria-hidden="true" className="size-3 shrink-0">
    <rect width={1} height={1} className={className} />
  </svg>
);

const ProblemButton = ({
  label,
  className,
  onClick,
}: {
  label: string;
  className: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`block text-sm font-medium hover:underline ${className}`}
  >
    {label}
  </button>
);

/** Tilled, watered and protected counts, with a jump to the first dry or unprotected tile. */
export function CoveragePanel({
  summary,
  onShowTile,
}: {
  summary: CoverageSummary;
  onShowTile: (tile: number) => void;
}) {
  const t = useTranslations('farmPlanner.coverage');
  return (
    <section aria-label={t('title')}>
      <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {t('title')}
      </h3>
      {summary.tilled === 0 ? (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('empty')}
        </p>
      ) : (
        <div className="mt-1 space-y-1 text-sm">
          <p>{t('tilled', { count: summary.tilled })}</p>
          <p>
            {t('watered', {
              count: summary.watered,
              percent: percent(summary.watered, summary.tilled),
            })}
          </p>
          <p>
            {t('protected', {
              count: summary.protected,
              percent: percent(summary.protected, summary.tilled),
            })}
          </p>
          {summary.dry.length > 0 && (
            <ProblemButton
              label={t('dry', { count: summary.dry.length })}
              className="text-orange-700 dark:text-orange-400"
              onClick={() => onShowTile(summary.dry[0])}
            />
          )}
          {summary.unprotected.length > 0 && (
            <ProblemButton
              label={t('unprotected', { count: summary.unprotected.length })}
              className="text-red-700 dark:text-red-400"
              onClick={() => onShowTile(summary.unprotected[0])}
            />
          )}
        </div>
      )}
      <ul className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <li className="flex items-center gap-1.5">
          <Swatch className={WATER_FILL} /> {t('legendWatered')}
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch className={PROTECT_FILL} /> {t('legendProtected')}
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch className="fill-none stroke-orange-500 [stroke-width:0.2] dark:stroke-orange-400" />{' '}
          {t('legendDry')}
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch className="fill-none stroke-red-500 [stroke-width:0.2] dark:stroke-red-400" />{' '}
          {t('legendUnprotected')}
        </li>
      </ul>
    </section>
  );
}
