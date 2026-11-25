import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { useTranslations } from 'use-intl';
import type { CoverageSummary } from '../../lib/farmPlanner/coverage';
import { issueMessage } from '../../lib/farmPlanner/rules';
import type {
  Catalog,
  Issue,
  PlacedObject,
  PlannerObjectDef,
} from '../../lib/farmPlanner/types';
import { message, type Translatable } from '../../lib/message';
import { useLabels } from '../useLabels';
import { CoveragePanel } from './CoveragePanel';
import { CATEGORY_LABELS } from './paletteGroups';

export type Notice = { level: 'error' | 'info'; messages: Translatable[] };

type DetailsPanelProps = {
  catalog: Catalog;
  objects: PlacedObject[];
  issues: Map<number, Issue[]>;
  selection: ReadonlySet<number>;
  notice: Notice | null;
  dropped: number;
  onSelect: (indexes: number[]) => void;
  coverage: CoverageSummary;
  /** Centres the map on a tile index (`y * width + x`). */
  onShowTile: (tile: number) => void;
};

export const droppedMessage = (count: number) =>
  message('farmPlanner.details.dropped', { count });

/** Painted areas can produce thousands of issues; the list shows the first ones. */
const MAX_LISTED = 50;

const nameOf = (catalog: Catalog, o: PlacedObject) =>
  catalog.get(o.t)?.name ?? o.t;

// Adapted from Tailwind Plus feedback/alerts/02-with-list.jsx.
const Alert = ({ notice }: { notice: Notice }) => {
  const labels = useLabels();
  const error = notice.level === 'error';
  const Icon = error ? XCircleIcon : InformationCircleIcon;
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={clsx(
        'rounded-md p-3 dark:outline',
        error
          ? 'bg-red-50 dark:bg-red-500/15 dark:outline-red-500/25'
          : 'bg-blue-50 dark:bg-blue-500/10 dark:outline-blue-500/20',
      )}
    >
      <div className="flex">
        <Icon
          aria-hidden="true"
          className={clsx(
            'size-5 shrink-0',
            error ? 'text-red-400' : 'text-blue-400',
          )}
        />
        <ul
          role="list"
          className={clsx(
            'ml-3 space-y-1 text-sm',
            error
              ? 'text-red-700 dark:text-red-200'
              : 'text-blue-700 dark:text-blue-200',
          )}
        >
          {notice.messages.map((m) => {
            const text = labels.text(m);
            return <li key={text}>{text}</li>;
          })}
        </ul>
      </div>
    </div>
  );
};

const IssueList = ({ list, catalog }: { list: Issue[]; catalog: Catalog }) => {
  const labels = useLabels();
  return (
    <ul role="list" className="mt-1 space-y-0.5">
      {list.map((issue, k) => (
        <li
          key={k}
          className={clsx(
            'flex items-start gap-1 text-sm',
            issue.level === 'error'
              ? 'text-red-700 dark:text-red-400'
              : 'text-amber-700 dark:text-amber-400',
          )}
        >
          {issue.level === 'error' ? (
            <XCircleIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
          ) : (
            <ExclamationTriangleIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
          )}
          <span>{labels.text(issueMessage(issue, catalog))}</span>
        </li>
      ))}
    </ul>
  );
};

const Heading = ({ children }: { children: string }) => (
  <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
    {children}
  </h3>
);

/** Selected object, notices, the plan's errors and warnings, and counts per category. */
export function DetailsPanel(props: DetailsPanelProps) {
  const labels = useLabels();
  const t = useTranslations('farmPlanner.details');
  const { catalog, objects, issues, selection } = props;
  const selected = [...selection].filter((i) => objects[i]);
  const counts = new Map<PlannerObjectDef['category'], number>();
  for (const o of objects) {
    const category = catalog.get(o.t)?.category;
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return (
    <section
      aria-label={t('label')}
      className="space-y-6 text-gray-900 dark:text-white"
    >
      {props.dropped > 0 && (
        <Alert
          notice={{ level: 'info', messages: [droppedMessage(props.dropped)] }}
        />
      )}
      {props.notice && <Alert notice={props.notice} />}

      <div>
        <Heading>{t('selection')}</Heading>
        {selected.length === 0 && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('none')}
          </p>
        )}
        {selected.length === 1 && (
          <div className="mt-1">
            <p className="text-sm font-medium">
              {nameOf(catalog, objects[selected[0]])}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('position', {
                x: objects[selected[0]].x,
                y: objects[selected[0]].y,
              })}
            </p>
          </div>
        )}
        {selected.length > 1 && (
          <p className="mt-1 text-sm">
            {t('many', { count: selected.length })}
          </p>
        )}
      </div>

      <div>
        <Heading>{t('problems')}</Heading>
        {issues.size === 0 ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('noProblems')}
          </p>
        ) : (
          <ul
            role="list"
            className="mt-1 divide-y divide-gray-100 dark:divide-white/10"
          >
            {[...issues].slice(0, MAX_LISTED).map(([i, list]) => (
              <li key={i} className="py-2">
                <button
                  type="button"
                  onClick={() => props.onSelect([i])}
                  className="text-sm font-medium hover:underline"
                >
                  {nameOf(catalog, objects[i])} ({objects[i].x}, {objects[i].y})
                </button>
                <IssueList list={list} catalog={catalog} />
              </li>
            ))}
            {issues.size > MAX_LISTED && (
              <li className="py-2 text-sm text-gray-500 dark:text-gray-400">
                {t('more', { count: issues.size - MAX_LISTED })}
              </li>
            )}
          </ul>
        )}
      </div>

      <CoveragePanel summary={props.coverage} onShowTile={props.onShowTile} />

      <div>
        <Heading>{t('summary')}</Heading>
        <dl className="mt-1 divide-y divide-gray-100 text-sm dark:divide-white/10">
          {(Object.keys(CATEGORY_LABELS) as PlannerObjectDef['category'][]).map(
            (c) => (
              <div key={c} className="flex justify-between py-1.5">
                <dt className="text-gray-500 dark:text-gray-400">
                  {labels.text(CATEGORY_LABELS[c])}
                </dt>
                <dd className="font-medium tabular-nums">
                  {counts.get(c) ?? 0}
                </dd>
              </div>
            ),
          )}
        </dl>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">{t('hint')}</p>
    </section>
  );
}
