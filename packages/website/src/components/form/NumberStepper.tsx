import { MinusIcon, PlusIcon } from '@heroicons/react/16/solid';
import { type KeyboardEvent, useId, useState } from 'react';

// Adapted from Tailwind Plus forms/input-groups/14-input-with-leading-icon-and-trailing-button.jsx
type NumberStepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Keeps the label for screen readers only, for compact rows. */
  hideLabel?: boolean;
};

const buttonClasses =
  'flex shrink-0 items-center justify-center bg-white px-3 py-2 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 hover:bg-gray-50 focus:relative focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-white dark:bg-white/10 dark:text-white dark:outline-gray-700 dark:hover:bg-white/20 dark:focus:outline-green-500 dark:aria-disabled:hover:bg-white/10';

export const NumberStepper = ({
  label,
  value,
  min,
  max,
  onChange,
  hideLabel = false,
}: NumberStepperProps) => {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);

  // Resync the text when the value changes from outside (buttons, parent).
  if (value !== lastValue) {
    setLastValue(value);
    if (Number(text) !== value || text === '') setText(String(value));
  }

  const parse = (raw: string): number | null => {
    if (!/^\d+$/.test(raw)) return null;
    const parsed = Number(raw);
    return parsed >= min && parsed <= max ? parsed : null;
  };

  const handleChange = (raw: string) => {
    setText(raw);
    const parsed = parse(raw);
    if (parsed !== null) onChange(parsed);
  };

  const commit = () => {
    if (parse(text) !== null) return setText(String(Number(text)));
    const numeric = Number(text);
    const snapped =
      text === '' || Number.isNaN(numeric)
        ? value
        : Math.min(max, Math.max(min, Math.round(numeric)));
    setText(String(snapped));
    if (snapped !== value) onChange(snapped);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Snap before the form's implicit submit so it sees what the field shows.
    if (event.key === 'Enter') commit();
  };

  const step = (delta: 1 | -1) => {
    if ((delta < 0 && value <= min) || (delta > 0 && value >= max)) return;
    const next = Math.min(max, Math.max(min, value + delta));
    setText(String(next));
    onChange(next);
  };

  return (
    <div>
      <label
        htmlFor={id}
        className={
          hideLabel
            ? 'sr-only'
            : 'block text-sm/6 font-medium text-gray-900 dark:text-white'
        }
      >
        {label}
      </label>
      <div className={`${hideLabel ? '' : 'mt-2 '}grid grid-cols-2 sm:flex`}>
        <button
          type="button"
          aria-label={`Diminuir ${label}`}
          title={`Diminuir ${label}`}
          aria-disabled={value <= min}
          onClick={() => step(-1)}
          className={`${buttonClasses} rounded-l-md sm:-mr-px sm:rounded-r-none sm:rounded-l-md max-sm:order-2 max-sm:rounded-r-none`}
        >
          <MinusIcon aria-hidden="true" className="size-4" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={text}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="col-span-2 block w-full min-w-0 appearance-none bg-white py-1.5 text-center text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:relative focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 max-sm:order-1 max-sm:rounded-t-md sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-gray-700 dark:focus:outline-green-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
        />
        <button
          type="button"
          aria-label={`Aumentar ${label}`}
          title={`Aumentar ${label}`}
          aria-disabled={value >= max}
          onClick={() => step(1)}
          className={`${buttonClasses} rounded-r-md sm:-ml-px sm:rounded-l-none max-sm:order-3 max-sm:rounded-l-none`}
        >
          <PlusIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
};
