import { PencilSquareIcon, TrashIcon } from '@heroicons/react/20/solid';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useId, useMemo, useState } from 'react';
import type {
  GameDateIn,
  MachineBatchOut,
  MachineOut,
  PlantableOut,
  PlantingOut,
  ProfileIn,
} from '../generated/stardew-valley-api/types.gen';
import { useMachineActions } from '../hooks/useMachineActions';
import { usePlantingActions } from '../hooks/usePlantingActions';
import { eventIconId, eventsToday, type FixedEvent } from '../lib/events';
import {
  EVENT_KIND_LABELS,
  LOCATION_LABELS,
  localizedName,
  QUALITY_LABELS,
} from '../lib/i18n';
import {
  isMachineActionable,
  machineBatchNames,
  milestoneReachedOn,
  recollectBody,
} from '../lib/machines';
import { canReplant, isActionable } from '../lib/plantings';
import { BirthdayGiftsModal } from './BirthdayGiftsModal';
import { KIND_ICONS } from './EventCalendar';
import { GameIcon } from './GameIcon';
import {
  MachineCatalogNotice,
  type MachineCatalogStatus,
} from './MachineCatalogNotice';
import { MachineDrawer } from './MachineDrawer';
import { PlantingDrawer } from './PlantingDrawer';
import { SkeletonList } from './Skeleton';
import { BADGE, CARD } from './styles';

// Adapted from Tailwind Plus application-ui-v4/react/lists/stacked-lists/06-with-badges-button-and-actions-menu.jsx

/** One row of "Hoje", shown in the "Plantios" or "Máquinas" group. */
export type TodayEntry =
  | { kind: 'planting'; planting: PlantingOut }
  | { kind: 'machine'; batch: MachineBatchOut };

type TodayListProps = {
  plantings: readonly PlantingOut[];
  plantables: readonly PlantableOut[];
  names: Record<string, string>;
  today: GameDateIn;
  /** Player profile for the edit drawers' previews; defaults to just today's date. */
  profile?: ProfileIn;
  machines: readonly MachineBatchOut[];
  machineCatalog: MachineOut[];
  /** Until the catalog loads, the "Máquinas" group shows a notice instead of rows without actions. */
  machineCatalogStatus?: MachineCatalogStatus;
  /** Fixed events of the game; the ones happening today show in the "Eventos" group. */
  events?: FixedEvent[];
  /** Until the events load, the "Eventos" group shows a notice instead of rows. */
  eventsStatus?: MachineCatalogStatus;
  onAddPlanting: () => void;
  onAddMachine: () => void;
};

const EventsNotice = ({
  status,
}: {
  status: Exclude<MachineCatalogStatus, 'success'>;
}) =>
  status === 'pending' ? (
    <SkeletonList label="Carregando eventos..." rows={2} />
  ) : (
    <p className="text-sm text-red-700 dark:text-red-400">
      Não foi possível carregar os eventos.
    </p>
  );

const EVENT_ROW =
  'flex items-center justify-between gap-x-6 py-4 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:hover:bg-white/5';

const ICON_BUTTON =
  'rounded-md p-1 text-gray-400 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:hover:text-red-400';

/** Icon-only delete button ("Remover", "Esvaziar", "Retirar"). */
const TrashButton = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={ICON_BUTTON}
  >
    <TrashIcon aria-hidden="true" className="size-5" />
  </button>
);

const EDIT_BUTTON =
  'rounded-md p-1 text-gray-400 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:hover:text-white';

/** Icon-only edit and delete buttons, shown at the end of every planting and machine row. */
const RowActions = ({
  removeLabel,
  onEdit,
  onRemove,
}: {
  removeLabel: string;
  onEdit: () => void;
  onRemove: () => void;
}) => (
  <>
    <button
      type="button"
      aria-label="Editar"
      title="Editar"
      onClick={onEdit}
      className={EDIT_BUTTON}
    >
      <PencilSquareIcon aria-hidden="true" className="size-5" />
    </button>
    <TrashButton label={removeLabel} onClick={onRemove} />
  </>
);

const SECONDARY_BUTTON =
  'rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20';

const isRegrowing = (plantable: PlantableOut | undefined) =>
  plantable?.kind === 'fruit_tree' || plantable?.regrowDays != null;

const plantingName = (planting: PlantingOut, names: Record<string, string>) =>
  planting.label || names[planting.seedId] || planting.seedId;

const machineName = (batch: MachineBatchOut, catalog: readonly MachineOut[]) =>
  batch.label || machineBatchNames(batch, catalog).output;

const nextUp = (
  plantings: readonly PlantingOut[],
  names: Record<string, string>,
  machines: readonly MachineBatchOut[],
  catalog: readonly MachineOut[],
): string | null => {
  // Invalid records (no schedule) have no next date, so they never show up here.
  const candidates = [
    ...plantings
      .filter(
        (planting) =>
          planting.schedule?.status === 'growing' ||
          planting.schedule?.status === 'regrowing',
      )
      .map((planting) => ({
        name: plantingName(planting, names),
        days: planting.schedule?.daysUntilNext,
      })),
    ...machines
      .filter((batch) => !isMachineActionable(batch))
      .map((batch) => ({
        name: machineName(batch, catalog),
        days: batch.schedule?.daysUntilNext,
      })),
  ].filter(
    (candidate): candidate is { name: string; days: number } =>
      candidate.days != null,
  );
  const upcoming = candidates.sort((a, b) => a.days - b.days)[0];
  if (!upcoming) return null;
  const { days } = upcoming;
  return `Próximo: ${upcoming.name} em ${days} ${days === 1 ? 'dia' : 'dias'}`;
};

const TodayGroup = ({
  title,
  notice,
  children,
}: {
  title: string;
  /** Replaces the rows (e.g. while the data they need is loading). */
  notice?: ReactNode;
  children?: ReactNode;
}) => {
  const headingId = useId();
  return (
    <div>
      <h3
        id={headingId}
        className="text-sm font-medium text-gray-500 dark:text-gray-400"
      >
        {title}
      </h3>
      {notice ? (
        <div className="mt-2">{notice}</div>
      ) : (
        <ul
          aria-labelledby={headingId}
          className="divide-y divide-gray-100 dark:divide-white/5"
        >
          {children}
        </ul>
      )}
    </div>
  );
};

const LocationBadge = ({ location }: { location: PlantingOut['location'] }) => (
  // Adapted from Tailwind Plus elements/badges/09-flat-pill.jsx
  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-400/10 dark:text-gray-400">
    {LOCATION_LABELS[location ?? 'farm']}
  </span>
);

export const TodayList = ({
  plantings,
  plantables,
  names,
  today,
  profile,
  machines,
  machineCatalog,
  machineCatalogStatus = 'success',
  events = [],
  eventsStatus = 'success',
  onAddPlanting,
  onAddMachine,
}: TodayListProps) => {
  const [birthday, setBirthday] = useState<FixedEvent | null>(null);
  const { replant, remove, removing, replanting } = usePlantingActions(today);
  const machineActions = useMachineActions(today);
  const [editingBatch, setEditingBatch] = useState<MachineBatchOut | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  // "Trocar produto" restarts the batch today; "Editar" keeps its current fields.
  const [restartToday, setRestartToday] = useState(false);
  const [editingPlanting, setEditingPlanting] = useState<PlantingOut | null>(
    null,
  );
  const [plantingDrawerOpen, setPlantingDrawerOpen] = useState(false);
  // Stable profile for the drawers' debounced previews.
  const drawerProfile = useMemo(
    () => profile ?? { currentDate: today },
    [profile, today],
  );
  const plantableById = new Map(
    plantables.map((plantable) => [plantable.id, plantable]),
  );
  const entries: TodayEntry[] = [
    ...plantings
      .filter(
        (planting) =>
          isActionable(planting) &&
          !removing.has(planting.id) &&
          !replanting.has(planting.id),
      )
      .map((planting): TodayEntry => ({ kind: 'planting', planting })),
    ...machines
      .filter(
        (batch) =>
          isMachineActionable(batch) &&
          !machineActions.removing.has(batch.id) &&
          !machineActions.recollecting.has(batch.id),
      )
      .map((batch): TodayEntry => ({ kind: 'machine', batch })),
  ];
  const plantingEntries = entries.flatMap((entry) =>
    entry.kind === 'planting' ? [entry.planting] : [],
  );
  const machineEntries = entries.flatMap((entry) =>
    entry.kind === 'machine' ? [entry.batch] : [],
  );
  // Casks reaching silver or gold today: not collectable yet, but worth knowing.
  const milestoneBatches = machines.flatMap((batch) => {
    const quality = milestoneReachedOn(batch, today);
    return quality &&
      !isMachineActionable(batch) &&
      !machineActions.removing.has(batch.id)
      ? [{ batch, quality }]
      : [];
  });
  const hasMachineRows =
    machineEntries.length > 0 || milestoneBatches.length > 0;
  const todayEvents = eventsToday(events, today);
  const showEvents = eventsStatus !== 'success' || todayEvents.length > 0;
  const next = nextUp(plantings, names, machines, machineCatalog);
  const changeProduct = (batch: MachineBatchOut) => {
    setEditingBatch(batch);
    setRestartToday(true);
    setDrawerOpen(true);
  };
  const editMachine = (batch: MachineBatchOut) => {
    setEditingBatch(batch);
    setRestartToday(false);
    setDrawerOpen(true);
  };
  const editPlanting = (planting: PlantingOut) => {
    setEditingPlanting(planting);
    setPlantingDrawerOpen(true);
  };
  const removeLabel = (batch: MachineBatchOut) => {
    const kind = machineBatchNames(batch, machineCatalog).kind;
    if (kind === 'aging') return 'Retirar';
    if (kind === 'batch') return 'Esvaziar';
    return 'Remover';
  };

  return (
    <section className={CARD}>
      {/* Adapted from Tailwind Plus headings/card-headings/02-with-action.jsx */}
      <div className="-mt-2 -ml-4 flex flex-wrap items-center justify-between sm:flex-nowrap">
        <h2 className="mt-2 ml-4 text-base/7 font-semibold text-gray-900 dark:text-white">
          Hoje
        </h2>
        <div className="mt-2 ml-4 flex shrink-0 flex-wrap gap-3">
          <button
            type="button"
            onClick={onAddPlanting}
            className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:bg-green-500 dark:hover:bg-green-400"
          >
            Adicionar plantio
          </button>
          <button
            type="button"
            onClick={onAddMachine}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
          >
            Adicionar máquina
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-6">
        {showEvents && (
          <TodayGroup
            title="Eventos"
            notice={
              eventsStatus !== 'success' && (
                <EventsNotice status={eventsStatus} />
              )
            }
          >
            {todayEvents.map((event) => {
              const Icon = KIND_ICONS[event.kind];
              const row = (
                <>
                  <div className="flex min-w-0 items-center gap-x-3">
                    <GameIcon
                      id={eventIconId(event)}
                      label={localizedName(event.name)}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm/6 font-semibold text-gray-900 dark:text-white">
                        {localizedName(event.name)}
                      </p>
                      {event.endDay !== undefined && (
                        <p className="mt-1 text-xs/5 text-gray-500 dark:text-gray-400">
                          Até o dia {event.endDay}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={BADGE}>
                    <Icon aria-hidden="true" className="size-3.5" />
                    {EVENT_KIND_LABELS[event.kind]}
                  </span>
                </>
              );
              return (
                <li key={event.id}>
                  {event.kind === 'birthday' ? (
                    <button
                      type="button"
                      onClick={() => setBirthday(event)}
                      className={`${EVENT_ROW} w-full text-left`}
                    >
                      {row}
                    </button>
                  ) : (
                    <Link
                      to="/eventos/$id"
                      params={{ id: event.id }}
                      className={EVENT_ROW}
                    >
                      {row}
                    </Link>
                  )}
                </li>
              );
            })}
          </TodayGroup>
        )}
        {entries.length === 0 && milestoneBatches.length === 0 ? (
          <div className="text-sm">
            <p className="font-medium text-gray-900 dark:text-white">
              Nada para coletar hoje
            </p>
            {next && (
              <p className="mt-1 text-gray-500 dark:text-gray-400">{next}</p>
            )}
            {plantings.length === 0 && (
              <button
                type="button"
                onClick={onAddPlanting}
                className="mt-2 font-semibold text-green-700 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
              >
                Adicione sua primeira semente
              </button>
            )}
          </div>
        ) : (
          <>
            {plantingEntries.length > 0 && (
              <TodayGroup title="Plantios">
                {plantingEntries.map((planting) => {
                  const plantable = plantableById.get(planting.seedId);
                  const informational = isRegrowing(plantable);
                  const replantable = canReplant(planting, plantable, today);
                  return (
                    <li
                      key={planting.id}
                      className="flex items-center justify-between gap-x-6 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-x-3">
                        <GameIcon
                          id={planting.seedId}
                          label={plantingName(planting, names)}
                        />
                        <div className="min-w-0">
                          <div className="flex items-start gap-x-3">
                            <p className="text-sm/6 font-semibold text-gray-900 dark:text-white">
                              {plantingName(planting, names)}
                            </p>
                            <LocationBadge location={planting.location} />
                          </div>
                          <p className="mt-1 text-xs/5 text-gray-500 dark:text-gray-400">
                            {planting.quantity}{' '}
                            {planting.quantity === 1 ? 'unidade' : 'unidades'} ·
                            Pronta para colher
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-none items-center gap-x-4">
                        {!informational && (
                          <button
                            type="button"
                            disabled={!replantable}
                            title={
                              replantable
                                ? undefined
                                : 'Fora da estação neste local'
                            }
                            onClick={() => replant(planting)}
                            className={SECONDARY_BUTTON}
                          >
                            Replantar
                          </button>
                        )}
                        <RowActions
                          removeLabel="Remover"
                          onEdit={() => editPlanting(planting)}
                          onRemove={() => remove(planting)}
                        />
                      </div>
                    </li>
                  );
                })}
              </TodayGroup>
            )}
            {hasMachineRows && machineCatalogStatus !== 'success' && (
              <TodayGroup
                title="Máquinas"
                notice={<MachineCatalogNotice status={machineCatalogStatus} />}
              />
            )}
            {hasMachineRows && machineCatalogStatus === 'success' && (
              <TodayGroup title="Máquinas">
                {machineEntries.map((batch) => {
                  const batchNames = machineBatchNames(batch, machineCatalog);
                  const quantity = batch.quantity ?? 1;
                  return (
                    <li
                      key={batch.id}
                      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-x-3">
                        <GameIcon
                          id={batch.machineId}
                          label={batchNames.machine}
                        />
                        <div className="min-w-0">
                          <div className="flex items-start gap-x-3">
                            <p className="text-sm/6 font-semibold text-gray-900 dark:text-white">
                              {batch.label ||
                                `${batchNames.machine} → ${batchNames.output}`}
                            </p>
                            {batch.machineId === 'bee-house' && (
                              <LocationBadge location={batch.location} />
                            )}
                          </div>
                          <p className="mt-1 text-xs/5 text-gray-500 dark:text-gray-400">
                            {quantity} {quantity === 1 ? 'máquina' : 'máquinas'}{' '}
                            ·{' '}
                            {batch.schedule?.status === 'iridium'
                              ? 'Qualidade irídio alcançada'
                              : 'Pronto para coletar'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-none items-center gap-x-4">
                        {batchNames.kind === 'batch' && (
                          <>
                            <button
                              type="button"
                              onClick={() => machineActions.recollect(batch)}
                              className={SECONDARY_BUTTON}
                            >
                              Recolocar
                            </button>
                            <button
                              type="button"
                              onClick={() => changeProduct(batch)}
                              className={SECONDARY_BUTTON}
                            >
                              Trocar produto
                            </button>
                          </>
                        )}
                        <RowActions
                          removeLabel={removeLabel(batch)}
                          onEdit={() => editMachine(batch)}
                          onRemove={() => machineActions.remove(batch)}
                        />
                      </div>
                    </li>
                  );
                })}
                {milestoneBatches.map(({ batch, quality }) => {
                  const batchNames = machineBatchNames(batch, machineCatalog);
                  const quantity = batch.quantity ?? 1;
                  return (
                    <li
                      key={batch.id}
                      className="flex items-center justify-between gap-x-6 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-x-3">
                        <GameIcon
                          id={batch.machineId}
                          label={batchNames.machine}
                        />
                        <div className="min-w-0">
                          <p className="text-sm/6 font-semibold text-gray-900 dark:text-white">
                            {batch.label ||
                              `${batchNames.machine} → ${batchNames.output}`}
                          </p>
                          <p className="mt-1 text-xs/5 text-gray-500 dark:text-gray-400">
                            {quantity} {quantity === 1 ? 'máquina' : 'máquinas'}{' '}
                            · Qualidade {QUALITY_LABELS[quality].toLowerCase()}{' '}
                            alcançada
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-none items-center gap-x-4">
                        <RowActions
                          removeLabel={removeLabel(batch)}
                          onEdit={() => editMachine(batch)}
                          onRemove={() => machineActions.remove(batch)}
                        />
                      </div>
                    </li>
                  );
                })}
              </TodayGroup>
            )}
          </>
        )}
      </div>
      <BirthdayGiftsModal
        event={birthday}
        open={birthday !== null}
        onClose={() => setBirthday(null)}
      />
      <MachineDrawer
        open={drawerOpen}
        editing={editingBatch}
        initial={
          editingBatch && restartToday
            ? recollectBody(editingBatch, today)
            : undefined
        }
        profile={drawerProfile}
        onClose={() => setDrawerOpen(false)}
      />
      <PlantingDrawer
        open={plantingDrawerOpen}
        editing={editingPlanting}
        profile={drawerProfile}
        onClose={() => setPlantingDrawerOpen(false)}
      />
    </section>
  );
};
