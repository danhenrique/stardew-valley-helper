import { SparklesIcon } from '@heroicons/react/24/outline';

// Adapted from Tailwind Plus feedback/empty-states/02-with-dashed-border.jsx (a div with an optional button inside)
type EmptyPlantingsProps = {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

export const EmptyPlantings = ({
  title = 'Nenhum plantio ainda',
  description = 'Adicione sua primeira semente.',
  action,
}: EmptyPlantingsProps) => (
  <div className="relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-white/15">
    <SparklesIcon
      aria-hidden="true"
      className="mx-auto size-12 text-gray-400 dark:text-gray-500"
    />
    <span className="mt-2 block text-sm font-semibold text-gray-900 dark:text-white">
      {title}
    </span>
    <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
      {description}
    </span>
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="mt-4 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:bg-green-500 dark:hover:bg-green-400"
      >
        {action.label}
      </button>
    )}
  </div>
);
