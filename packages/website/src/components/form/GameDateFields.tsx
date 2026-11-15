import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid';
import type {
  GameDateIn,
  Season,
} from '../../generated/stardew-valley-api/types.gen';
import { canShiftDay, MAX_YEAR, shiftDay } from '../../lib/gameDate';
import { SEASON_LABELS, SEASONS } from '../../lib/i18n';
import { NumberStepper } from './NumberStepper';
import { SelectMenu } from './SelectMenu';

type GameDateFieldsProps = {
  legend: string;
  value: GameDateIn;
  onChange: (value: GameDateIn) => void;
};

const navButtonClasses =
  'flex items-center justify-center bg-white px-3 py-2 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 hover:bg-gray-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-white dark:aria-disabled:hover:bg-white/10 focus:relative focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 dark:bg-white/10 dark:text-white dark:outline-gray-700 dark:hover:bg-white/20 dark:focus:outline-green-500';

export const GameDateFields = ({
  legend,
  value,
  onChange,
}: GameDateFieldsProps) => (
  <fieldset>
    <legend className="text-sm/6 font-semibold text-gray-900 dark:text-white">
      {legend}
    </legend>
    <div className="mt-2 grid grid-cols-3 gap-3">
      <div>
        <SelectMenu<Season>
          label="Estação"
          value={value.season}
          options={SEASONS.map((season) => ({
            value: season,
            label: SEASON_LABELS[season],
          }))}
          onChange={(season) => onChange({ ...value, season })}
        />
      </div>
      <NumberStepper
        label="Dia"
        value={value.day}
        min={1}
        max={28}
        onChange={(day) => onChange({ ...value, day })}
      />
      <NumberStepper
        label="Ano"
        value={value.year}
        min={1}
        max={MAX_YEAR}
        onChange={(year) => onChange({ ...value, year })}
      />
    </div>
    <div className="mt-2 inline-flex">
      <button
        type="button"
        aria-label="Dia anterior"
        title="Dia anterior"
        aria-disabled={!canShiftDay(value, -1)}
        onClick={() => canShiftDay(value, -1) && onChange(shiftDay(value, -1))}
        className={`${navButtonClasses} rounded-l-md`}
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Próximo dia"
        title="Próximo dia"
        aria-disabled={!canShiftDay(value, 1)}
        onClick={() => canShiftDay(value, 1) && onChange(shiftDay(value, 1))}
        className={`${navButtonClasses} -ml-px rounded-r-md`}
      >
        <ChevronRightIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  </fieldset>
);
