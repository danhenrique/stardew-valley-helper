import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/20/solid';
import clsx from 'clsx';
import type { ComponentType, SVGProps } from 'react';
import { useTranslations } from 'use-intl';
import type { Translatable } from '../../lib/message';
import { useLabels } from '../useLabels';
import type { SaveState } from './useAutosave';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const STATES: Record<
  Exclude<SaveState, 'idle'>,
  { icon: Icon; className: string; iconClassName?: string }
> = {
  saving: {
    icon: ArrowPathIcon,
    className: 'text-gray-500 dark:text-gray-400',
    iconClassName: 'animate-spin',
  },
  saved: {
    icon: CheckCircleIcon,
    className: 'text-green-700 dark:text-green-400',
  },
  error: {
    icon: ExclamationCircleIcon,
    className: 'text-red-700 dark:text-red-400',
  },
  conflict: {
    icon: ExclamationTriangleIcon,
    className: 'text-amber-700 dark:text-amber-400',
  },
};

/** Autosave state for the toolbar; an empty live region while nothing was saved yet. */
export function SaveStatus({
  status,
  message,
}: {
  status: SaveState;
  /** Server detail appended to the error text. */
  message?: Translatable;
}) {
  const labels = useLabels();
  const t = useTranslations('farmPlanner.save');
  const state = status === 'idle' ? undefined : STATES[status];
  const text =
    status === 'idle'
      ? undefined
      : status === 'error' && message
        ? t('errorDetail', { detail: labels.text(message) })
        : t(status);
  const IconComponent = state?.icon;
  return (
    <p
      role="status"
      aria-label={t('label')}
      className={clsx(
        'inline-flex min-w-0 items-center gap-1 text-xs font-medium',
        state?.className,
      )}
    >
      {state && IconComponent && (
        <>
          <IconComponent
            aria-hidden="true"
            className={clsx('size-4 shrink-0', state.iconClassName)}
          />
          <span className="truncate" title={text}>
            {text}
          </span>
        </>
      )}
    </p>
  );
}
