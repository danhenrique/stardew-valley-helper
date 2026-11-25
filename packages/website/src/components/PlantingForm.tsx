import {
  Description,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Field,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocale, useTranslations } from 'use-intl';
import type {
  Anchor,
  Fertilizer,
  GameDateIn,
  GameEntityOut,
  Location,
  PlantableOut,
  PlantingIn,
} from '../generated/stardew-valley-api/types.gen';
import { localizedName } from '../lib/i18n';
import { describePlantable } from '../lib/plantables';
import { plantingIssue } from '../lib/plantings';
import { Combobox } from './form/Combobox';
import { GameDateFields } from './form/GameDateFields';
import { LocationRadio } from './form/LocationRadio';
import { NumberStepper } from './form/NumberStepper';
import { SelectMenu } from './form/SelectMenu';
import { Toggle } from './form/Toggle';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus forms/form-layouts/01-stacked.jsx

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 999;

export type PlantingDraft = Required<
  Pick<PlantingIn, 'seedId' | 'anchor' | 'fertilizer' | 'location' | 'quantity'>
> & {
  plantedOn: GameDateIn | null;
  lastHarvestOn: GameDateIn | null;
  label: string | null;
};

type PlantingFormProps = {
  formId: string;
  today: GameDateIn;
  plantables: PlantableOut[];
  fertilizers: GameEntityOut[];
  initial?: PlantingDraft;
  onSubmit: (draft: PlantingDraft) => void;
  onDraftChange?: (draft: PlantingDraft | null) => void;
  /** Shown right under the date, e.g. the first harvest of the current draft. */
  harvestHint?: ReactNode;
};

const linkButton =
  'text-sm font-semibold text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300';

export const PlantingForm = ({
  formId,
  today,
  plantables,
  fertilizers,
  initial,
  onSubmit,
  onDraftChange,
  harvestHint,
}: PlantingFormProps) => {
  const labels = useLabels();
  const locale = useLocale();
  const t = useTranslations('plantings.form');
  const tFarming = useTranslations('farming.form');
  const [harvestOnly, setHarvestOnly] = useState(
    initial?.anchor === 'harvested',
  );
  const [date, setDate] = useState<GameDateIn>(
    initial?.plantedOn ?? initial?.lastHarvestOn ?? today,
  );
  const [otherDate, setOtherDate] = useState(Boolean(initial));
  const [seedId, setSeedId] = useState<string | null>(initial?.seedId ?? null);
  const [fertilizer, setFertilizer] = useState<Fertilizer>(
    initial?.fertilizer ?? 'none',
  );
  const [location, setLocation] = useState<Location>(
    initial?.location ?? 'farm',
  );
  const [quantity, setQuantity] = useState(initial?.quantity ?? MIN_QUANTITY);
  const [label, setLabel] = useState(initial?.label ?? '');

  const selected = plantables.find((plantable) => plantable.id === seedId);
  const regrowing = selected?.kind === 'crop' && selected.regrowDays != null;
  const anchor: Anchor = harvestOnly && regrowing ? 'harvested' : 'planted';
  const issue = seedId
    ? plantingIssue(selected, { date, location, anchor })
    : null;

  const draft = useMemo<PlantingDraft | null>(() => {
    if (!seedId || plantingIssue(selected, { date, location, anchor }))
      return null;
    return {
      seedId,
      anchor,
      plantedOn: anchor === 'planted' ? date : null,
      lastHarvestOn: anchor === 'harvested' ? date : null,
      fertilizer: anchor === 'harvested' ? 'none' : fertilizer,
      location,
      quantity,
      label: label.trim() || null,
    };
  }, [seedId, selected, anchor, date, fertilizer, location, quantity, label]);

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (draft) onSubmit(draft);
  };

  const fertilizerOptions = [
    { value: 'none' as Fertilizer, label: labels.noFertilizer },
    ...fertilizers.map((entity) => ({
      value: entity.id as Fertilizer,
      label: localizedName(entity.name, locale),
      secondary: labels.fertilizerSpeed(entity.id as Fertilizer),
      iconId: entity.id,
    })),
  ];
  const dateLegend =
    anchor === 'harvested' ? t('harvestDate') : t('plantedDate');

  return (
    <form id={formId} onSubmit={submit} className="space-y-6">
      <Field>
        <Combobox
          label={t('seed')}
          buttonLabel={t('showSeeds')}
          value={seedId}
          options={plantables.map((plantable) => {
            const outOfSeason =
              plantingIssue(plantable, {
                date,
                location: 'farm',
                anchor: 'planted',
              }) !== null;
            const description = labels.text(describePlantable(plantable));
            return {
              value: plantable.id,
              label: localizedName(plantable.name, locale),
              iconId: plantable.id,
              secondary: outOfSeason
                ? t('outOfSeason', { description })
                : description,
            };
          })}
          onChange={setSeedId}
        />
        {issue && (
          <Description className="mt-2 block text-sm text-red-600 dark:text-red-400">
            {labels.text(issue)}
          </Description>
        )}
      </Field>
      {otherDate ? (
        <div>
          <GameDateFields legend={dateLegend} value={date} onChange={setDate} />
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
            {dateLegend}
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
      {harvestHint}
      <LocationRadio value={location} onChange={setLocation} />
      <NumberStepper
        label={t('quantity')}
        value={quantity}
        min={MIN_QUANTITY}
        max={MAX_QUANTITY}
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
          {anchor === 'planted' && (
            <SelectMenu<Fertilizer>
              label={t('fertilizer')}
              value={fertilizer}
              options={fertilizerOptions}
              onChange={setFertilizer}
            />
          )}
          <Toggle
            label={t('harvestOnly')}
            description={t('harvestOnlyHint')}
            checked={anchor === 'harvested'}
            disabled={!regrowing}
            onChange={setHarvestOnly}
          />
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
