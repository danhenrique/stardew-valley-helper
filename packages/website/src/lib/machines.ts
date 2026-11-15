import type {
  GameDateIn,
  MachineBatchIn,
  MachineBatchOut,
  MachineOut,
  MachineScheduleOut,
  Quality,
} from '../generated/stardew-valley-api/types.gen';
import {
  formatGameDate,
  humanizeId,
  localizedName,
  QUALITY_LABELS,
  SEASONS,
} from './i18n';

export type MachineKind = MachineOut['kind'];

/** A machine batch being edited: the API body with every required field set. */
export type MachineDraft = MachineBatchIn;

/** Absolute day count (28 days per season, 4 seasons per year). */
const dayNumber = (d: GameDateIn): number =>
  (d.year - 1) * 112 + SEASONS.indexOf(d.season) * 28 + d.day;

/** Days from `a` to `b` (negative when `b` is earlier). */
export const daysBetween = (a: GameDateIn, b: GameDateIn): number =>
  dayNumber(b) - dayNumber(a);

/** Why the machine/output choice is invalid (pt-BR), or null when it is fine. */
export const machineIssue = (
  machine: MachineOut | undefined,
  outputId: string | null,
): string | null => {
  if (!machine) return 'Escolha uma máquina';
  if (!outputId || !machine.outputs.some((output) => output.id === outputId))
    return 'Escolha um produto desta máquina';
  return null;
};

/** One-line forecast; `days` is the output's processing time from the machine catalog. */
export const summarizeMachineSchedule = (
  kind: MachineKind,
  days: number,
  schedule: MachineScheduleOut,
): string => {
  if (kind === 'continuous') {
    const [next] = schedule.collections;
    if (!next) return 'Sem coletas previstas';
    // The catalog days, not the gap between collections (the farm bee house pauses in winter).
    return `Coleta a cada ${days} ${days === 1 ? 'dia' : 'dias'} · próxima ${formatGameDate(next)}`;
  }
  if (kind === 'aging')
    return schedule.milestones
      .map(
        ({ quality, on }) => `${QUALITY_LABELS[quality]} ${formatGameDate(on)}`,
      )
      .join(' · ');
  return schedule.readyOn
    ? `Pronto em ${formatGameDate(schedule.readyOn)}`
    : 'Sem previsão';
};

/** Dates worth marking on a calendar for this batch, with a short label. */
export const machineDates = (
  batch: Pick<MachineBatchOut, 'schedule'>,
): { date: GameDateIn; label: string }[] => {
  const { schedule } = batch;
  if (!schedule) return [];
  if (schedule.collections.length)
    return schedule.collections.map((date) => ({ date, label: 'Coleta' }));
  if (schedule.milestones.length)
    return schedule.milestones.map(({ quality, on }) => ({
      date: on,
      label: QUALITY_LABELS[quality],
    }));
  return schedule.readyOn ? [{ date: schedule.readyOn, label: 'Pronto' }] : [];
};

export const isMachineActionable = (batch: MachineBatchOut): boolean =>
  batch.schedule?.status === 'ready' || batch.schedule?.status === 'iridium';

/** Quality a Cask batch reaches on `date` (a milestone day), or null. */
export const milestoneReachedOn = (
  batch: Pick<MachineBatchOut, 'schedule'>,
  date: GameDateIn,
): Quality | null =>
  batch.schedule?.milestones.find(({ on }) => daysBetween(date, on) === 0)
    ?.quality ?? null;

export const toMachineBatchIn = (batch: MachineBatchOut): MachineBatchIn => {
  const { id: _id, schedule: _schedule, invalid: _invalid, ...body } = batch;
  return body;
};

/** Restart the same batch today (after collecting it). */
export const recollectBody = (
  batch: MachineBatchOut,
  today: GameDateIn,
): MachineBatchIn => ({ ...toMachineBatchIn(batch), startedOn: today });

/** Localized machine and product names of a batch ("Barril", "Vinho"), falling back to the ids. */
export const machineBatchNames = (
  batch: Pick<MachineBatchOut, 'machineId' | 'outputId'>,
  machines: readonly MachineOut[],
): { machine: string; output: string; kind: MachineKind | undefined } => {
  const machine = machines.find((entry) => entry.id === batch.machineId);
  const output = machine?.outputs.find((entry) => entry.id === batch.outputId);
  return {
    machine: localizedName(machine?.name) || humanizeId(batch.machineId),
    output: localizedName(output?.name) || humanizeId(batch.outputId),
    kind: machine?.kind,
  };
};

/** Calendar marker kinds for machines: Cask milestones get their own icon and label. */
export type MachineMarkerKind = 'machine' | 'caskMilestone';

export type MachineMarker = {
  /** Unique among all markers of all batches. */
  key: string;
  kind: MachineMarkerKind;
  date: GameDateIn;
  /** Short date label from `machineDates` ("Pronto", "Coleta", "Prata"...). */
  label: string;
  machine: string;
  /** Data id of the machine, for its sprite. */
  machineId: string;
  output: string;
  /** Player nickname, or the product name when there is none. */
  name: string;
};

/** Every dated entry of the batches (ready day, collections, Cask milestones), for calendars and lists. */
export const machineMarkers = (
  batches: readonly MachineBatchOut[],
  machines: readonly MachineOut[],
): MachineMarker[] =>
  batches.flatMap((batch) => {
    const names = machineBatchNames(batch, machines);
    const kind: MachineMarkerKind = batch.schedule?.milestones.length
      ? 'caskMilestone'
      : 'machine';
    return machineDates(batch).map(({ date, label }) => ({
      key: `machine:${batch.id}:${label}:${dayNumber(date)}`,
      kind,
      date,
      label,
      machine: names.machine,
      machineId: batch.machineId,
      output: names.output,
      name: batch.label || names.output,
    }));
  });

/** The first batch date on or after `today` (next ready day, collection or milestone). */
export const nextMachineDate = (
  batch: Pick<MachineBatchOut, 'schedule'>,
  today: GameDateIn,
): GameDateIn | null =>
  machineDates(batch)
    .map(({ date }) => date)
    .filter((date) => daysBetween(today, date) >= 0)
    .sort((a, b) => dayNumber(a) - dayNumber(b))[0] ?? null;
