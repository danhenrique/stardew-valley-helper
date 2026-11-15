import { ExclamationTriangleIcon } from '@heroicons/react/20/solid';
import type { ScheduleOut } from '../generated/stardew-valley-api/types.gen';
import {
  formatExpectedYield,
  formatGameDate,
  WARNING_LABELS,
} from '../lib/i18n';

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
  if (!schedule) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {loading ? 'Calculando...' : 'Escolha uma semente para ver a previsão.'}
      </p>
    );
  }
  const regrowthInterval =
    schedule.harvests.length > 1
      ? `${regrowDays(schedule)} dias`
      : 'Não rebrota';
  const warnings = schedule.warnings ?? [];

  return (
    <div>
      <h3 className="text-base/7 font-semibold text-gray-900 dark:text-white">
        Previsão
      </h3>
      <div className="mt-4 border-t border-gray-100 dark:border-white/10">
        <dl className="divide-y divide-gray-100 dark:divide-white/10">
          <Row term="Primeira colheita">
            {schedule.firstHarvest
              ? formatGameDate(schedule.firstHarvest)
              : '—'}
          </Row>
          <Row term="Colheitas">
            {schedule.infinite
              ? 'Contínuas (próximas 10)'
              : String(schedule.totalHarvests)}
          </Row>
          <Row term="Colheita esperada">
            {formatExpectedYield(
              schedule.yieldPerHarvest,
              schedule.expectedTotalYield,
            )}
          </Row>
          <Row term="Rebrota a cada">{regrowthInterval}</Row>
          <Row term="Morre em">
            {schedule.diesOn
              ? formatGameDate(schedule.diesOn)
              : 'Não morre na troca de estação'}
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
                {WARNING_LABELS[warning] ?? warning}
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
