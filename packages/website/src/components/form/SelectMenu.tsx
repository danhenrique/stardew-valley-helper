import {
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/16/solid';
import { CheckIcon } from '@heroicons/react/20/solid';
import { GameIcon } from '../GameIcon';

// Adapted from Tailwind Plus forms/select-menus/02-simple-custom.jsx (and 06-with-secondary-text.jsx,
// 05-custom-with-avatar.jsx for the option icon)
export type SelectOption<T> = {
  value: T;
  label: string;
  secondary?: string;
  /** Data id of a game entity whose sprite is shown before the label. */
  iconId?: string;
};

type SelectMenuProps<T> = {
  label: string;
  /** `null` shows `placeholder` until an option is chosen. */
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function SelectMenu<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
}: SelectMenuProps<T>) {
  const selected =
    options.find((option) => option.value === value) ??
    (placeholder === undefined ? options[0] : undefined);

  return (
    <Listbox<'div', T | null>
      as="div"
      value={value}
      onChange={(next) => next !== null && onChange(next)}
      disabled={disabled}
    >
      <Label className="block text-sm/6 font-medium text-gray-900 dark:text-white">
        {label}
      </Label>
      <div className="relative mt-2">
        <ListboxButton className="grid w-full data-disabled:cursor-not-allowed data-disabled:opacity-50 cursor-default grid-cols-1 rounded-md bg-white py-1.5 pr-2 pl-3 text-left text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:focus-visible:outline-green-500">
          <span className="col-start-1 row-start-1 flex w-full items-center gap-2 pr-6">
            {selected?.iconId && (
              <GameIcon id={selected.iconId} label={selected.label} size="sm" />
            )}
            {selected ? (
              <span className="truncate">{selected.label}</span>
            ) : (
              <span className="truncate text-gray-400 dark:text-gray-500">
                {placeholder}
              </span>
            )}
            {selected?.secondary && (
              <span className="truncate text-gray-500 dark:text-gray-400">
                {selected.secondary}
              </span>
            )}
          </span>
          <ChevronUpDownIcon
            aria-hidden="true"
            className="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-500 sm:size-4 dark:text-gray-400"
          />
        </ListboxButton>

        <ListboxOptions
          transition
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg outline-1 outline-black/5 data-leave:transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0 sm:text-sm dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
        >
          {options.map((option) => (
            <ListboxOption
              key={String(option.value)}
              value={option.value}
              className="group relative cursor-default py-2 pr-9 pl-3 text-gray-900 select-none data-focus:bg-green-600 data-focus:text-white data-focus:outline-hidden dark:text-white dark:data-focus:bg-green-500"
            >
              <div className="flex items-center">
                {option.iconId && (
                  <GameIcon
                    id={option.iconId}
                    label={option.label}
                    className="mr-3"
                  />
                )}
                <span className="truncate font-normal group-data-selected:font-semibold">
                  {option.label}
                </span>
                {option.secondary && (
                  <span className="ml-2 truncate text-gray-500 group-data-focus:text-green-200 dark:text-gray-400 dark:group-data-focus:text-green-100">
                    {option.secondary}
                  </span>
                )}
              </div>
              <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-green-600 group-not-data-selected:hidden group-data-focus:text-white dark:text-green-400">
                <CheckIcon aria-hidden="true" className="size-5" />
              </span>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
