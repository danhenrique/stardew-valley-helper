import clsx from 'clsx';
import { useId } from 'react';

// Adapted from Tailwind Plus elements/button-groups/01-basic.jsx
// (a single-choice group: the pressed button is the selected option).
export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type SegmentedButtonsProps<T extends string> = {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedButtons<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedButtonsProps<T>) {
  const id = useId();
  return (
    <div>
      <span
        id={id}
        className="block text-sm/6 font-medium text-gray-900 dark:text-white"
      >
        {label}
      </span>
      <span
        role="group"
        aria-labelledby={id}
        className="mt-2 isolate flex w-full rounded-md shadow-xs dark:shadow-none"
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              className={clsx(
                index === 0 && 'rounded-l-md',
                index > 0 && '-ml-px',
                index === options.length - 1 && 'rounded-r-md',
                selected
                  ? 'bg-green-600 text-white inset-ring-green-600 hover:bg-green-500 dark:bg-green-500 dark:inset-ring-green-500 dark:hover:bg-green-400'
                  : 'bg-white text-gray-900 inset-ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:inset-ring-gray-700 dark:hover:bg-white/20',
                'relative inline-flex flex-1 items-center justify-center px-3 py-2 text-sm/5 font-semibold whitespace-nowrap inset-ring-1 focus:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white dark:disabled:hover:bg-white/10 dark:focus-visible:outline-green-500',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </span>
    </div>
  );
}
