import { ArrowLeftIcon } from '@heroicons/react/16/solid';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { PlantableOut } from '../generated/stardew-valley-api/types.gen';
import { useGameNames } from '../hooks/useGameNames';
import { eventIconId, type FixedEvent } from '../lib/events';
import { isEmptyTastes, type GiftTastes as Tastes } from '../lib/gifts';
import { EVENT_KIND_LABELS, formatEventDays, localizedName } from '../lib/i18n';
import { KIND_ICONS } from './EventCalendar';
import { GameIcon, GameIconOr } from './GameIcon';
import { GiftTastes } from './GiftTastes';
import { SkeletonCards } from './Skeleton';

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

export const BackToEvents = () => (
  <Link
    to="/calendario"
    search={{ aba: 'eventos' }}
    className="inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
  >
    <ArrowLeftIcon aria-hidden="true" className="size-4" />
    Voltar para eventos
  </Link>
);

const growthDays = (plantable: PlantableOut): number | undefined =>
  plantable.growthDays ?? plantable.daysToMature ?? undefined;

export const EventDetail = ({ event, details }: EventDetailProps) => {
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
            label={localizedName(event.name)}
            size="lg"
            fallback={KIND_ICONS[event.kind]}
          />
          {localizedName(event.name)}
        </h1>
      </div>
      <div className="border-t border-gray-100 dark:border-white/10">
        <dl className="divide-y divide-gray-100 dark:divide-white/10">
          <Row label="Tipo">{EVENT_KIND_LABELS[event.kind]}</Row>
          <Row label={event.endDay === undefined ? 'Dia' : 'Dias'}>
            {formatEventDays(event)}
          </Row>
          {event.kind === 'festival' && shopsClosed !== undefined && (
            <Row label="Lojas">
              {shopsClosed ? 'Lojas fecham' : 'Lojas abertas'}
            </Row>
          )}
          {event.kind === 'foraging' && event.item !== undefined && (
            <Row label="Item">
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
            <Row label="Casável">{event.marriageable ? 'Sim' : 'Não'}</Row>
          )}
          {event.kind === 'birthday' && gifts && (
            <Row label="Presentes amados">
              {gifts.status === 'pending' ? (
                <SkeletonCards label="Carregando presentes..." cards={3} />
              ) : gifts.status === 'error' ? (
                'Não foi possível carregar os presentes.'
              ) : isEmptyTastes(gifts.tastes, ['loves']) ? (
                'Nenhum presente amado cadastrado.'
              ) : (
                <GiftTastes tastes={gifts.tastes} tiers={['loves']} />
              )}
            </Row>
          )}
          {event.kind === 'cropDeadline' &&
            plantable?.lastPlantingDay != null && (
              <Row label="Último dia de plantio">{`Dia ${plantable.lastPlantingDay}`}</Row>
            )}
          {event.kind === 'cropDeadline' && days !== undefined && (
            <Row label="Dias de crescimento">{`${days} dias`}</Row>
          )}
        </dl>
      </div>
    </div>
  );
};
