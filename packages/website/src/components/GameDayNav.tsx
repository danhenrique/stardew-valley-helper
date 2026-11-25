import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/20/solid';
import { CloudRain } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';
import type { ProfileIn } from '../generated/stardew-valley-api/types.gen';
import { canShiftDay, sameDate, shiftDay } from '../lib/gameDate';
import {
  type Profession,
  professionFlags,
  professionOf,
} from '../lib/profession';
import { GameDateFields } from './form/GameDateFields';
import {
  SegmentedButtons,
  type SegmentedOption,
} from './form/SegmentedButtons';
import { Toggle } from './form/Toggle';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus application-ui-v4/react/elements/button-groups/02-icon-only.jsx
// (prev/next group, with the label in the middle like calendars/02-month-view.jsx) and
// marketing-v4/react/elements/flyout-menus/07-simple.jsx (popover with the editor).
type GameDayNavProps = {
  profile: ProfileIn;
  onSave: (profile: ProfileIn) => void;
};

const SEGMENT =
  'relative inline-flex items-center bg-white py-2 text-gray-700 inset-ring-1 inset-ring-gray-300 hover:bg-gray-50 focus:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white dark:bg-white/10 dark:text-gray-200 dark:inset-ring-gray-700 dark:hover:bg-white/20 dark:disabled:hover:bg-white/10';

/**
 * Rain is only for one day: moving the date clears it here too, so the optimistic profile
 * matches what the server stores (spec: fish design, rain of the day).
 */
const withDate = (profile: ProfileIn, next: ProfileIn): ProfileIn =>
  profile.rainToday && !sameDate(profile.currentDate, next.currentDate)
    ? { ...next, rainToday: false }
    : next;

export const GameDayNav = ({ profile, onSave }: GameDayNavProps) => {
  const labels = useLabels();
  const t = useTranslations('nav.day');
  const tc = useTranslations('common');
  const { currentDate } = profile;
  const rainToday = Boolean(profile.rainToday);
  const rainLabel = rainToday ? t('raining') : t('dry');
  const label = t('current', {
    season: labels.season(currentDate.season),
    day: currentDate.day,
    year: currentDate.year,
  });
  const save = (next: ProfileIn) => onSave(withDate(profile, next));
  const step = (delta: 1 | -1) =>
    save({ ...profile, currentDate: shiftDay(currentDate, delta) });

  return (
    <div className="flex items-center gap-x-2">
      <div
        role="group"
        aria-label={t('group')}
        className="isolate inline-flex rounded-md shadow-xs dark:shadow-none"
      >
        <button
          type="button"
          aria-label={tc('previousDay')}
          title={tc('previousDay')}
          disabled={!canShiftDay(currentDate, -1)}
          onClick={() => step(-1)}
          className={`${SEGMENT} rounded-l-md px-2`}
        >
          <ChevronLeftIcon aria-hidden="true" className="size-5" />
        </button>
        <Popover className="relative -ml-px flex">
          <PopoverButton
            title={t('change')}
            className={`${SEGMENT} gap-x-1 px-3 text-sm font-semibold whitespace-nowrap text-gray-900 data-open:bg-gray-50 dark:text-white dark:data-open:bg-white/20`}
          >
            <span className="sr-only">
              {t('changeLabel', { action: t('change'), label })}
            </span>
            <span aria-hidden="true">{label}</span>
            <ChevronDownIcon
              aria-hidden="true"
              className="size-4 text-gray-400"
            />
          </PopoverButton>
          <PopoverPanel
            role="dialog"
            aria-label={t('panel')}
            anchor={{ to: 'bottom', gap: 8, padding: 16 }}
            transition
            className="z-20 w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-white p-4 shadow-lg outline-1 outline-gray-900/5 transition data-closed:translate-y-1 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:outline dark:-outline-offset-1 dark:outline-white/10"
          >
            {({ close }) => (
              <DayEditor
                profile={profile}
                onSave={(next) => {
                  save(next);
                  close();
                }}
              />
            )}
          </PopoverPanel>
        </Popover>
        <button
          type="button"
          aria-label={tc('nextDay')}
          title={tc('nextDay')}
          disabled={!canShiftDay(currentDate, 1)}
          onClick={() => step(1)}
          className={`${SEGMENT} -ml-px rounded-r-md px-2`}
        >
          <ChevronRightIcon aria-hidden="true" className="size-5" />
        </button>
      </div>
      <button
        type="button"
        aria-label={rainLabel}
        title={rainLabel}
        aria-pressed={rainToday}
        onClick={() => onSave({ ...profile, rainToday: !rainToday })}
        className={
          rainToday
            ? 'relative inline-flex items-center rounded-md bg-sky-600 px-2 py-2 text-white shadow-xs hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400'
            : `${SEGMENT} rounded-md px-2 shadow-xs dark:shadow-none`
        }
      >
        <CloudRain aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
};

/** Draft of the date and progress flags; mounted fresh each time the popover opens. */
const DayEditor = ({ profile, onSave }: GameDayNavProps) => {
  const t = useTranslations('nav.day');
  const tc = useTranslations('common');
  const professionOptions = useMemo<SegmentedOption<Profession>[]>(
    () => [
      { value: 'none', label: t('professionNone') },
      { value: 'agriculturist', label: t('professionAgriculturist') },
      { value: 'artisan', label: t('professionArtisan') },
    ],
    [t],
  );
  const [currentDate, setCurrentDate] = useState(profile.currentDate);
  const [profession, setProfession] = useState<Profession>(
    professionOf(profile),
  );
  const [communityCenterRestored, setCommunityCenterRestored] = useState(
    Boolean(profile.communityCenterRestored),
  );
  const [keyToTown, setKeyToTown] = useState(Boolean(profile.keyToTown));
  const [boatRepaired, setBoatRepaired] = useState(
    Boolean(profile.boatRepaired),
  );

  return (
    <div className="space-y-6">
      <GameDateFields
        legend={t('legend')}
        value={currentDate}
        onChange={setCurrentDate}
      />
      <div>
        <SegmentedButtons
          label={t('profession')}
          options={professionOptions}
          value={profession}
          onChange={setProfession}
        />
        <p className="mt-2 text-sm/6 text-gray-500 dark:text-gray-400">
          {t('professionHint')}
        </p>
      </div>
      <Toggle
        label={t('communityCenter')}
        description={t('communityCenterHint')}
        checked={communityCenterRestored}
        onChange={setCommunityCenterRestored}
      />
      <Toggle
        label={t('keyToTown')}
        description={t('keyToTownHint')}
        checked={keyToTown}
        onChange={setKeyToTown}
      />
      <Toggle
        label={t('boat')}
        description={t('boatHint')}
        checked={boatRepaired}
        onChange={setBoatRepaired}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            onSave({
              ...profile,
              currentDate,
              ...professionFlags(profession),
              communityCenterRestored,
              keyToTown,
              boatRepaired,
            })
          }
          className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:bg-green-500 dark:hover:bg-green-400"
        >
          {tc('save')}
        </button>
      </div>
    </div>
  );
};
