import { BellIcon } from '@heroicons/react/20/solid';
import { useLocale, useTranslations } from 'use-intl';
import type { GameDateIn } from '../generated/stardew-valley-api/types.gen';
import type { FixedEvent } from '../lib/events';
import { localizedName } from '../lib/i18n';
import { type Reminder, remindersToday } from '../lib/reminders';
import { GameIconOr } from './GameIcon';
import type { MachineCatalogStatus } from './MachineCatalogNotice';
import { REMINDER_ICONS } from './reminderIcons';
import { SkeletonList } from './Skeleton';
import { CARD } from './styles';

// Adapted from Tailwind Plus lists/stacked-lists/01-simple.jsx

type TodayRemindersProps = {
  reminders: Reminder[];
  events: FixedEvent[];
  today: GameDateIn;
  status: MachineCatalogStatus;
};

/** Reminders that apply today; nothing at all when none applies. */
export const TodayReminders = ({
  reminders,
  events,
  today,
  status,
}: TodayRemindersProps) => {
  const locale = useLocale();
  const t = useTranslations('today');
  const todayReminders = remindersToday(reminders, events, today);
  if (status === 'success' && todayReminders.length === 0) return null;
  return (
    <section className={CARD}>
      <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">
        {t('reminders')}
      </h2>
      {status === 'pending' ? (
        <SkeletonList label={t('remindersLoading')} rows={2} />
      ) : status === 'error' ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">
          {t('remindersError')}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-white/5">
          {todayReminders.map((reminder) => (
            <li key={reminder.id} className="flex items-center gap-x-3 py-4">
              <GameIconOr
                id={reminder.id}
                label={localizedName(reminder.name, locale)}
                fallback={REMINDER_ICONS[reminder.id] ?? BellIcon}
              />
              <div className="min-w-0">
                <p className="text-sm/6 font-semibold text-gray-900 dark:text-white">
                  {localizedName(reminder.name, locale)}
                </p>
                <p className="mt-1 text-xs/5 text-gray-500 dark:text-gray-400">
                  {localizedName(reminder.detail, locale)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
