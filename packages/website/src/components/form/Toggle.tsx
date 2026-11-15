import { useId } from 'react';

// Adapted from Tailwind Plus forms/toggles/04-with-left-label-and-description.jsx
type ToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export const Toggle = ({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: ToggleProps) => {
  const id = useId();
  return (
    <div className="flex items-center justify-between">
      <span className="flex grow flex-col">
        <label
          id={`${id}-label`}
          htmlFor={id}
          className="text-sm/6 font-medium text-gray-900 dark:text-white"
        >
          {label}
        </label>
        <span
          id={`${id}-description`}
          className="text-sm text-gray-500 dark:text-gray-400"
        >
          {description}
        </span>
      </span>
      <div className="group relative inline-flex has-disabled:opacity-50 w-11 shrink-0 rounded-full bg-gray-200 p-0.5 inset-ring inset-ring-gray-900/5 outline-offset-2 outline-green-600 transition-colors duration-200 ease-in-out has-checked:bg-green-600 has-focus-visible:outline-2 dark:bg-white/5 dark:inset-ring-white/10 dark:outline-green-500 dark:has-checked:bg-green-500">
        <span className="size-5 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-checked:translate-x-5" />
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-description`}
          className="absolute inset-0 size-full appearance-none focus:outline-hidden"
        />
      </div>
    </div>
  );
};
