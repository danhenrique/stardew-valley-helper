import { ExclamationTriangleIcon } from '@heroicons/react/20/solid';
import { useTranslations } from 'use-intl';
import type { ScheduleOut } from '../generated/stardew-valley-api/types.gen';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus data-display/description-lists/01-left-aligned.jsx and feedback/alerts/01-with-description.jsx
type SchedulePreviewProps = { schedule: ScheduleOut | null; loading?: boolean };

const Row = ({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) => (
  <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
    <dt className="text-sm/6 font-medium text-gray-900 dark:text-gray-100">
      {term}
    </dt>
    <dd className="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0 dark:text-gray-400">
      {children}
    </dd>
  </div>
);

export const SchedulePreview = ({
  schedule,
  loading = false,
}: SchedulePreviewProps) => {
  const labels = useLabels();
  const t = useTranslations('plantings.preview');
  const tCommon = useTranslations('common');
  if (!schedule) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {loading ? tCommon('calculating') : t('choose')}
      </p>
    );
  }
  const regrowthInterval =
    schedule.harvests.length > 1
      ? t('regrowDays', { days: regrowDays(schedule) })
      : t('noRegrow');
  const warnings = schedule.warnings ?? [];

  return (
    <div>
      <h3 className="text-base/7 font-semibold text-gray-900 dark:text-white">
        {t('title')}
      </h3>
      <div className="mt-4 border-t border-gray-100 dark:border-white/10">
        <dl className="divide-y divide-gray-100 dark:divide-white/10">
          <Row term={t('firstHarvest')}>
            {schedule.firstHarvest
              ? labels.gameDate(schedule.firstHarvest)
              : '—'}
          </Row>
          <Row term={t('harvests')}>
            {schedule.infinite
              ? t('continuous')
              : String(schedule.totalHarvests)}
          </Row>
          <Row term={t('expectedYield')}>
            {labels.expectedYield(
              schedule.yieldPerHarvest,
              schedule.expectedTotalYield,
            )}
          </Row>
          <Row term={t('regrowEvery')}>{regrowthInterval}</Row>
          <Row term={t('diesOn')}>
            {schedule.diesOn
              ? labels.gameDate(schedule.diesOn)
              : t('neverDies')}
          </Row>
        </dl>
      </div>
      {warnings.map((warning) => (
        <div
          key={warning}
          role="alert"
          className="mt-4 rounded-md bg-yellow-50 p-4 dark:bg-yellow-500/10 dark:outline dark:outline-yellow-500/15"
        >
          <div className="flex">
            <div className="shrink-0">
              <ExclamationTriangleIcon
                aria-hidden="true"
                className="size-5 text-yellow-400 dark:text-yellow-300"
              />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-100/80">
                {labels.warning(warning)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const SEASON_INDEX = { spring: 0, summer: 1, fall: 2, winter: 3 } as const;
const toAbs = (date: {
  year: number;
  season: keyof typeof SEASON_INDEX;
  day: number;
}) => (date.year - 1) * 112 + SEASON_INDEX[date.season] * 28 + date.day;

const regrowDays = (schedule: ScheduleOut): number =>
  toAbs(schedule.harvests[1]) - toAbs(schedule.harvests[0]);
