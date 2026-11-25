import { ArrowLeftIcon } from '@heroicons/react/16/solid';
import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'use-intl';
import type { PlantableOut } from '../generated/stardew-valley-api/types.gen';
import { useGameNames } from '../hooks/useGameNames';
import { eventIconId, type FixedEvent } from '../lib/events';
import { isEmptyTastes, type GiftTastes as Tastes } from '../lib/gifts';
import { localizedName } from '../lib/i18n';
import { KIND_ICONS } from './EventCalendar';
import { GameIcon, GameIconOr } from './GameIcon';
import { GiftTastes } from './GiftTastes';
import { LocaleLink } from './LocaleLink';
import { SkeletonCards } from './Skeleton';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus data-display/description-lists/01-left-aligned.jsx
export type EventDetails = {
  /** Festival: whether the shops close. Omitted when the data does not say. */
  shopsClosed?: boolean;
  /** Crop deadline: the seed the deadline refers to. */
  plantable?: PlantableOut;
  /** Birthday: the villager's gift tastes (the page shows the loved ones). */
  gifts?: { status: 'pending' | 'error' | 'success'; tastes: Tastes };
};

type EventDetailProps = { event: FixedEvent; details: EventDetails };

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
    <dt className="text-sm/6 font-medium text-gray-900 dark:text-gray-100">
      {label}
    </dt>
    <dd className="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0 dark:text-gray-400">
      {children}
    </dd>
  </div>
);

export const BackToEvents = () => {
  const t = useTranslations('events.detail');
  return (
    <LocaleLink
      to="/{-$locale}/calendar"
      search={{ tab: 'events' }}
      className="inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      {t('back')}
    </LocaleLink>
  );
};

const growthDays = (plantable: PlantableOut): number | undefined =>
  plantable.growthDays ?? plantable.daysToMature ?? undefined;

export const EventDetail = ({ event, details }: EventDetailProps) => {
  const labels = useLabels();
  const locale = useLocale();
  const t = useTranslations('events.detail');
  const { shopsClosed, plantable, gifts } = details;
  const { nameOf } = useGameNames();
  const days = plantable ? growthDays(plantable) : undefined;

  return (
    <div className="space-y-6">
      <BackToEvents />
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          <GameIconOr
            id={eventIconId(event)}
            label={localizedName(event.name, locale)}
            size="lg"
            fallback={KIND_ICONS[event.kind]}
          />
          {localizedName(event.name, locale)}
        </h1>
      </div>
      <div className="border-t border-gray-100 dark:border-white/10">
        <dl className="divide-y divide-gray-100 dark:divide-white/10">
          <Row label={t('type')}>{labels.eventKind(event.kind)}</Row>
          <Row label={event.endDay === undefined ? t('day') : t('days')}>
            {labels.eventDays(event)}
          </Row>
          {event.kind === 'festival' && shopsClosed !== undefined && (
            <Row label={t('shops')}>
              {shopsClosed ? t('shopsClosed') : t('shopsOpen')}
            </Row>
          )}
          {event.kind === 'foraging' && event.item !== undefined && (
            <Row label={t('item')}>
              <span className="flex items-center gap-x-2">
                <GameIcon
                  id={event.item}
                  label={nameOf(event.item)}
                  size="sm"
                />
                {nameOf(event.item)}
              </span>
            </Row>
          )}
          {event.kind === 'birthday' && event.marriageable !== undefined && (
            <Row label={t('marriageable')}>
              {event.marriageable ? t('yes') : t('no')}
            </Row>
          )}
          {event.kind === 'birthday' && gifts && (
            <Row label={t('lovedGifts')}>
              {gifts.status === 'pending' ? (
                <SkeletonCards label={t('giftsLoading')} cards={3} />
              ) : gifts.status === 'error' ? (
                t('giftsError')
              ) : isEmptyTastes(gifts.tastes, ['loves']) ? (
                t('noLovedGifts')
              ) : (
                <GiftTastes tastes={gifts.tastes} tiers={['loves']} />
              )}
            </Row>
          )}
          {event.kind === 'cropDeadline' &&
            plantable?.lastPlantingDay != null && (
              <Row label={t('lastPlantingDay')}>
                {t('lastPlantingDayValue', { day: plantable.lastPlantingDay })}
              </Row>
            )}
          {event.kind === 'cropDeadline' && days !== undefined && (
            <Row label={t('growthDays')}>{t('growthDaysValue', { days })}</Row>
          )}
        </dl>
      </div>
    </div>
  );
};
