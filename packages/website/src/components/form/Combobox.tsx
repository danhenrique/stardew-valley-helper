import {
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Combobox as HeadlessCombobox,
  Label,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { GameIcon } from '../GameIcon';
import type { SelectOption } from './SelectMenu';

// Adapted from Tailwind Plus forms/comboboxes/05-with-secondary-text.jsx (and 04-with-avatar.jsx
// for the option icon).
// The typed text only filters the list: only a listed option can be selected.
type ComboboxProps = {
  label: string;
  buttonLabel: string;
  value: string | null;
  options: SelectOption<string>[];
  onChange: (value: string | null) => void;
};

export const Combobox = ({
  label,
  buttonLabel,
  value,
  options,
  onChange,
}: ComboboxProps) => {
  const t = useTranslations('common');
  const [query, setQuery] = useState('');
  const filtered =
    query === ''
      ? options
      : options.filter((option) =>
          option.label.toLowerCase().includes(query.toLowerCase()),
        );
  const labelOf = (id: string | null) =>
    options.find((option) => option.value === id)?.label ?? '';
  const selected = options.find((option) => option.value === value);

  return (
    <HeadlessCombobox
      as="div"
      value={value}
      onChange={(next: string | null) => {
        setQuery('');
        onChange(next);
      }}
    >
      <Label className="block text-sm/6 font-medium text-gray-900 dark:text-white">
        {label}
      </Label>
      <div className="relative mt-2">
        {selected?.iconId && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
            <GameIcon id={selected.iconId} label={selected.label} size="sm" />
          </div>
        )}
        <ComboboxInput
          className={clsx(
            selected?.iconId ? 'pl-9' : 'pl-3',
            'block w-full rounded-md bg-white py-1.5 pr-12 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-green-500',
          )}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => setQuery('')}
          displayValue={labelOf}
          placeholder={t('search')}
        />
        <ComboboxButton
          aria-label={buttonLabel}
          title={buttonLabel}
          className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-hidden"
        >
          <ChevronDownIcon
            className="size-5 text-gray-400"
            aria-hidden="true"
          />
        </ComboboxButton>

        <ComboboxOptions
          anchor={{ to: 'bottom start', gap: 4, padding: 16 }}
          transition
          className="z-10 max-h-60 w-(--input-width) overflow-auto rounded-md bg-white py-1 text-base shadow-lg outline-1 outline-black/5 data-leave:transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0 sm:text-sm dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
        >
          {filtered.map((option) => (
            <ComboboxOption
              key={option.value}
              value={option.value}
              className="cursor-default px-3 py-2 text-gray-900 select-none data-focus:bg-green-600 data-focus:text-white data-focus:outline-hidden dark:text-white dark:data-focus:bg-green-500"
            >
              <div className="flex items-center">
                {option.iconId && (
                  <GameIcon
                    id={option.iconId}
                    label={option.label}
                    className="mr-3"
                  />
                )}
                <span className="block truncate">{option.label}</span>
                {option.secondary && (
                  <span className="ml-2 block truncate text-gray-500 in-data-focus:text-white dark:text-gray-400 dark:in-data-focus:text-white">
                    {option.secondary}
                  </span>
                )}
              </div>
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </div>
    </HeadlessCombobox>
  );
};
