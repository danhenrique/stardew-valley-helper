import {
  ArrowsPointingInIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  CursorArrowRaysIcon,
  InformationCircleIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  PlusCircleIcon,
  SignalIcon,
  Squares2X2Icon,
  TrashIcon,
} from '@heroicons/react/20/solid';
import clsx from 'clsx';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { useTranslations } from 'use-intl';
import type { Translatable } from '../../lib/message';
import { type PlanChoice, PlanSelector } from './PlanSelector';
import { SaveStatus } from './SaveStatus';
import type { SaveState } from './useAutosave';
import type { Tool } from './useEditorKeys';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export type ToolbarProps = {
  planName: string;
  /** The player's other plans; with one or more, the name opens a menu to switch plans. */
  otherPlans?: PlanChoice[];
  onPickPlan?: (planId: string) => void;
  saveStatus: SaveState;
  /** Server detail shown with the error state. */
  saveError?: Translatable;
  tool: Tool;
  onTool: (tool: Tool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  showCoverage: boolean;
  onToggleCoverage: () => void;
  onOpenPalette: () => void;
  onOpenDetails: () => void;
};

const TOOLS = [
  { tool: 'place', label: 'place', key: 'B', icon: PlusCircleIcon },
  { tool: 'select', label: 'select', key: 'V', icon: CursorArrowRaysIcon },
  { tool: 'delete', label: 'erase', key: 'E', icon: TrashIcon },
] as const satisfies { tool: Tool; label: string; key: string; icon: Icon }[];

// Adapted from Tailwind Plus elements/button-groups/02-icon-only.jsx.
const BUTTON =
  'relative inline-flex items-center px-2 py-2 inset-ring-1 not-first:-ml-px first:rounded-l-md last:rounded-r-md focus:z-10 disabled:cursor-not-allowed disabled:opacity-40';
const IDLE =
  'bg-white text-gray-500 inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-gray-300 dark:inset-ring-gray-700 dark:hover:bg-white/20';
const PRESSED =
  'z-10 bg-green-50 text-green-700 inset-ring-green-600 dark:bg-green-500/20 dark:text-green-300 dark:inset-ring-green-500';

const IconButton = ({
  label,
  icon: IconComponent,
  onClick,
  pressed,
  disabled,
  shortcut,
}: {
  label: string;
  icon: Icon;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  shortcut?: string;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    aria-keyshortcuts={shortcut}
    disabled={disabled}
    onClick={onClick}
    className={clsx(BUTTON, pressed ? PRESSED : IDLE)}
  >
    <IconComponent aria-hidden="true" className="size-5" />
  </button>
);

const Group = ({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) => (
  <span
    role="group"
    aria-label={label}
    className={clsx(
      'isolate inline-flex rounded-md shadow-xs dark:shadow-none',
      className,
    )}
  >
    {children}
  </span>
);

/** Editor toolbar: plan name (or plan selector), save status, tools, undo/redo and zoom. */
export function Toolbar(props: ToolbarProps) {
  const { otherPlans, onPickPlan } = props;
  const t = useTranslations('farmPlanner.toolbar');
  const common = useTranslations('common');
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-gray-900">
      <div className="mr-auto flex min-w-0 items-center gap-3">
        {otherPlans?.length && onPickPlan ? (
          <>
            <h1 className="sr-only">{props.planName}</h1>
            <PlanSelector
              planName={props.planName}
              plans={otherPlans}
              onPick={onPickPlan}
            />
          </>
        ) : (
          <h1 className="truncate text-base font-semibold text-gray-900 dark:text-white">
            {props.planName}
          </h1>
        )}
        <SaveStatus status={props.saveStatus} message={props.saveError} />
      </div>
      <Group label={t('tools')}>
        {TOOLS.map((tool) => (
          <IconButton
            key={tool.tool}
            label={t(tool.label)}
            icon={tool.icon}
            shortcut={tool.key}
            pressed={props.tool === tool.tool}
            onClick={() => props.onTool(tool.tool)}
          />
        ))}
      </Group>
      <Group label={t('history')}>
        <IconButton
          label={common('undo')}
          icon={ArrowUturnLeftIcon}
          shortcut="Control+Z"
          disabled={!props.canUndo}
          onClick={props.onUndo}
        />
        <IconButton
          label={t('redo')}
          icon={ArrowUturnRightIcon}
          shortcut="Control+Shift+Z"
          disabled={!props.canRedo}
          onClick={props.onRedo}
        />
      </Group>
      <button
        type="button"
        aria-pressed={props.showCoverage}
        onClick={props.onToggleCoverage}
        className={clsx(
          'inline-flex items-center gap-x-1.5 rounded-md px-2.5 py-2 text-sm font-semibold inset-ring-1 shadow-xs dark:shadow-none',
          props.showCoverage ? PRESSED : IDLE,
        )}
      >
        <SignalIcon aria-hidden="true" className="-ml-0.5 size-5" />
        {t('coverage')}
      </button>
      <Group label={t('zoom')}>
        <IconButton
          label={t('zoomOut')}
          icon={MagnifyingGlassMinusIcon}
          onClick={props.onZoomOut}
        />
        <IconButton
          label={t('zoomIn')}
          icon={MagnifyingGlassPlusIcon}
          onClick={props.onZoomIn}
        />
        <IconButton
          label={t('fit')}
          icon={ArrowsPointingInIcon}
          onClick={props.onFit}
        />
      </Group>
      <span className="w-12 text-right text-xs text-gray-500 tabular-nums dark:text-gray-400">
        {Math.round(props.zoom * 100)}%
      </span>
      <Group label={t('panels')} className="lg:hidden">
        <IconButton
          label={t('openObjects')}
          icon={Squares2X2Icon}
          onClick={props.onOpenPalette}
        />
        <IconButton
          label={t('openDetails')}
          icon={InformationCircleIcon}
          onClick={props.onOpenDetails}
        />
      </Group>
    </div>
  );
}
