import { useTranslations } from 'use-intl';
import type { Location } from '../../generated/stardew-valley-api/types.gen';
import { useLabels } from '../useLabels';

// Adapted from Tailwind Plus forms/radio-groups/11-small-cards.jsx
const LOCATIONS: Location[] = ['farm', 'greenhouse', 'ginger-island'];

type LocationRadioProps = {
  value: Location;
  /** Locations to offer; all of them by default. */
  locations?: readonly Location[];
  onChange: (value: Location) => void;
};

export const LocationRadio = ({
  value,
  locations = LOCATIONS,
  onChange,
}: LocationRadioProps) => {
  const labels = useLabels();
  const t = useTranslations('common');
  return (
    <fieldset aria-label={t('location')}>
      <div className="text-sm/6 font-medium text-gray-900 dark:text-white">
        {t('location')}
      </div>
      <div
        className={`mt-2 grid gap-3 ${locations.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
      >
        {locations.map((location) => (
          <label
            key={location}
            className="group relative flex items-center justify-center rounded-md border border-gray-300 bg-white p-3 has-checked:border-green-600 has-checked:bg-green-600 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-green-600 dark:border-white/10 dark:bg-gray-800/50 dark:has-checked:border-green-500 dark:has-checked:bg-green-500"
          >
            <input
              value={location}
              checked={value === location}
              onChange={() => onChange(location)}
              name="location"
              type="radio"
              className="absolute inset-0 appearance-none focus:outline-none"
            />
            <span className="text-sm font-medium text-gray-900 group-has-checked:text-white dark:text-white">
              {labels.location(location)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};
