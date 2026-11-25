import {
  Description,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Field,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';
import type {
  GameDateIn,
  Location,
  MachineOut,
  MachineOutputOut,
} from '../generated/stardew-valley-api/types.gen';
import { localizedName } from '../lib/i18n';
import { type MachineDraft, machineIssue } from '../lib/machines';
import { GameDateFields } from './form/GameDateFields';
import { LocationRadio } from './form/LocationRadio';
import { NumberStepper } from './form/NumberStepper';
import { SelectMenu } from './form/SelectMenu';
import { GameIcon } from './GameIcon';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus forms/form-layouts/01-stacked.jsx

export const MIN_MACHINES = 1;
export const MAX_MACHINES = 999;

type StartQuality = NonNullable<MachineDraft['startQuality']>;

const START_QUALITIES: StartQuality[] = ['normal', 'silver', 'gold'];
const BEE_HOUSE_LOCATIONS: Location[] = ['farm', 'ginger-island'];
const BEE_HOUSE_ID = 'bee-house';

type MachineFormProps = {
  formId: string;
  today: GameDateIn;
  machines: readonly MachineOut[];
  initial?: MachineDraft;
  onSubmit: (draft: MachineDraft) => void;
  onDraftChange?: (draft: MachineDraft | null) => void;
  /** Called with the chosen machine id, so the drawer can tell "no machine" from "no product". */
  onMachineChange?: (machineId: string) => void;
};

const linkButton =
  'text-sm font-semibold text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300';

const sameDay = (a: GameDateIn, b: GameDateIn) =>
  a.year === b.year && a.season === b.season && a.day === b.day;

type Translate = ReturnType<typeof useTranslations<'machines.form'>>;

const outputDays = (output: MachineOutputOut, t: Translate): string =>
  t(output.approximate ? 'daysApproximate' : 'days', { days: output.days });

export const MachineForm = ({
  formId,
  today,
  machines,
  initial,
  onSubmit,
  onDraftChange,
  onMachineChange,
}: MachineFormProps) => {
  const labels = useLabels();
  const locale = useLocale();
  const t = useTranslations('machines.form');
  const tFarming = useTranslations('farming.form');
  const [machineId, setMachineId] = useState<string | null>(
    initial?.machineId ?? null,
  );
  const [outputId, setOutputId] = useState<string | null>(
    initial?.outputId ?? null,
  );
  const [date, setDate] = useState<GameDateIn>(initial?.startedOn ?? today);
  // "Today" unless the initial values start on another day.
  const [otherDate, setOtherDate] = useState(
    initial != null && !sameDay(initial.startedOn, today),
  );
  const [startQuality, setStartQuality] = useState<StartQuality>(
    initial?.startQuality ?? 'normal',
  );
  const [location, setLocation] = useState<Location>(
    initial?.location ?? 'farm',
  );
  const [quantity, setQuantity] = useState(initial?.quantity ?? MIN_MACHINES);
  const [label, setLabel] = useState(initial?.label ?? '');
  // The product message shows only after a machine change dropped the chosen product.
  const [productDropped, setProductDropped] = useState(false);

  const machine = machines.find((entry) => entry.id === machineId);
  const aging = machine?.kind === 'aging';
  const beeHouse = machine?.id === BEE_HOUSE_ID;
  const singleOutput =
    machine?.outputs.length === 1 ? machine.outputs[0] : undefined;
  const issue =
    machine && productDropped ? machineIssue(machine, outputId) : null;

  const chooseMachine = (id: string) => {
    const next = machines.find((entry) => entry.id === id);
    setMachineId(id);
    onMachineChange?.(id);
    // Keep the product only while it is still valid; nothing else is cleared.
    if (next?.outputs.length === 1) setOutputId(next.outputs[0].id);
    else if (!next?.outputs.some((output) => output.id === outputId)) {
      if (outputId) setProductDropped(true);
      setOutputId(null);
    }
  };

  const chooseOutput = (id: string) => {
    setOutputId(id);
    setProductDropped(false);
  };

  const draft = useMemo<MachineDraft | null>(() => {
    if (!machine || !outputId || machineIssue(machine, outputId)) return null;
    return {
      machineId: machine.id,
      outputId,
      startedOn: date,
      quantity,
      startQuality: aging ? startQuality : null,
      location: beeHouse ? location : 'farm',
      label: label.trim() || null,
    };
  }, [
    machine,
    outputId,
    date,
    quantity,
    aging,
    startQuality,
    beeHouse,
    location,
    label,
  ]);

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (draft) onSubmit(draft);
  };

  return (
    <form id={formId} onSubmit={submit} className="space-y-6">
      <div>
        <SelectMenu<string>
          label={t('machine')}
          value={machineId}
          placeholder={t('chooseMachine')}
          options={machines.map((entry) => ({
            value: entry.id,
            label: localizedName(entry.name, locale),
            iconId: entry.id,
          }))}
          onChange={chooseMachine}
        />
      </div>
      {singleOutput ? (
        <div>
          <div className="text-sm/6 font-medium text-gray-900 dark:text-white">
            {t('product')}
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <GameIcon
              id={singleOutput.id}
              label={localizedName(singleOutput.name, locale)}
              size="sm"
            />
            <span>{localizedName(singleOutput.name, locale)}</span>
            <span className="text-gray-500 dark:text-gray-400">
              {outputDays(singleOutput, t)}
            </span>
          </p>
        </div>
      ) : (
        <Field>
          <SelectMenu<string>
            label={t('product')}
            value={outputId}
            placeholder={machine ? t('chooseProduct') : t('chooseMachineFirst')}
            disabled={!machine}
            options={(machine?.outputs ?? []).map((output) => ({
              value: output.id,
              label: localizedName(output.name, locale),
              secondary: outputDays(output, t),
              iconId: output.id,
            }))}
            onChange={chooseOutput}
          />
          {issue && (
            <Description className="mt-2 block text-sm text-red-600 dark:text-red-400">
              {labels.text(issue)}
            </Description>
          )}
        </Field>
      )}
      {otherDate ? (
        <div>
          <GameDateFields legend={t('start')} value={date} onChange={setDate} />
          <button
            type="button"
            onClick={() => {
              setDate(today);
              setOtherDate(false);
            }}
            className={`mt-2 ${linkButton}`}
          >
            {tFarming('useToday')}
          </button>
        </div>
      ) : (
        <div>
          <div className="text-sm/6 font-semibold text-gray-900 dark:text-white">
            {t('start')}
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {tFarming('today', { date: labels.gameDate(today) })}
            </span>
            <button
              type="button"
              onClick={() => setOtherDate(true)}
              className={linkButton}
            >
              {tFarming('otherDate')}
            </button>
          </div>
        </div>
      )}
      {aging && (
        <div>
          <SelectMenu<StartQuality>
            label={t('startQuality')}
            value={startQuality}
            options={START_QUALITIES.map((quality) => ({
              value: quality,
              label: labels.quality(quality),
            }))}
            onChange={setStartQuality}
          />
        </div>
      )}
      {beeHouse && (
        <LocationRadio
          value={location}
          locations={BEE_HOUSE_LOCATIONS}
          onChange={setLocation}
        />
      )}
      <NumberStepper
        label={t('count')}
        value={quantity}
        min={MIN_MACHINES}
        max={MAX_MACHINES}
        onChange={setQuantity}
      />
      <Disclosure as="div">
        <DisclosureButton className="group flex w-full items-center justify-between text-sm/6 font-semibold text-gray-900 dark:text-white">
          {tFarming('moreOptions')}
          <ChevronDownIcon
            aria-hidden="true"
            className="size-5 text-gray-400 group-data-open:rotate-180"
          />
        </DisclosureButton>
        <DisclosurePanel className="mt-4 space-y-6">
          <div>
            <label
              htmlFor={`${formId}-label`}
              className="block text-sm/6 font-medium text-gray-900 dark:text-white"
            >
              {tFarming('nickname')}
            </label>
            <div className="mt-2">
              <input
                id={`${formId}-label`}
                name="label"
                type="text"
                maxLength={60}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10"
              />
            </div>
          </div>
        </DisclosurePanel>
      </Disclosure>
    </form>
  );
};
