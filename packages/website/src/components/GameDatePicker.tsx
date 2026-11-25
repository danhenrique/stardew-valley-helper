import { useState } from 'react';
import { useTranslations } from 'use-intl';
import type { GameDateIn } from '../generated/stardew-valley-api/types.gen';
import { clampYear, DAYS } from '../lib/gameDate';
import { SeasonTabs } from './SeasonTabs';

// Adapted from Tailwind Plus forms/select-menus (native select) and forms/input-groups/01-input-with-label.jsx
const FIELD =
  'block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-green-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:*:bg-gray-800 dark:focus:outline-green-500';
const LABEL = 'block text-sm/6 font-medium text-gray-900 dark:text-white';

/** Season, day and year of the game calendar. */
export const GameDatePicker = ({
  value,
  onChange,
}: {
  value: GameDateIn;
  onChange: (next: GameDateIn) => void;
}) => {
  const t = useTranslations('common');
  // The year field keeps its own text so it can be cleared while typing.
  const [yearText, setYearText] = useState(String(value.year));
  return (
    <div className="flex flex-wrap items-end gap-4">
      <SeasonTabs
        value={value.season}
        onChange={(season) => onChange({ ...value, season })}
      />
      <div className="w-24">
        <label htmlFor="game-date-day" className={LABEL}>
          {t('day')}
        </label>
        <select
          id="game-date-day"
          value={value.day}
          onChange={(event) =>
            onChange({ ...value, day: Number(event.target.value) })
          }
          className={`mt-2 ${FIELD}`}
        >
          {DAYS.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </div>
      <div className="w-24">
        <label htmlFor="game-date-year" className={LABEL}>
          {t('year')}
        </label>
        <input
          id="game-date-year"
          type="number"
          min={1}
          value={yearText}
          onChange={(event) => {
            setYearText(event.target.value);
            const year = Number(event.target.value);
            if (Number.isInteger(year) && year >= 1)
              onChange({ ...value, year: clampYear(year) });
          }}
          className={`mt-2 ${FIELD}`}
        />
      </div>
    </div>
  );
};
