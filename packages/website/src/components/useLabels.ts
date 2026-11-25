import { useMemo } from 'react';
import { useLocale, useTranslations } from 'use-intl';
import type {
  Fertilizer,
  GameDateIn,
  Location,
  Quality,
  Season,
} from '../generated/stardew-valley-api/types.gen';
import type { EventKind } from '../lib/events';
import type { Weekday } from '../lib/gameDate';
import type { GiftTier } from '../lib/gifts';
import {
  eventDaysMessage,
  expectedYieldMessage,
  gameDateMessage,
  type MachineStatus,
  type PlantingStatus,
} from '../lib/i18n';
import type { Locale } from '../lib/locale';
import type { MachineMarkerKind } from '../lib/machines';
import {
  type MessageRef,
  message,
  resolveMessage,
  type Translatable,
  type Translate,
} from '../lib/message';

export type Labels = ReturnType<typeof useLabels>;

const WARNINGS = ['will_not_mature', 'approximate'] as const;

/**
 * Typed getters for the `labels` messages, plus `text` for the references `lib/` returns, so
 * components never index a label map or build a key by hand.
 */
export const useLabels = () => {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return useMemo(() => {
    const translate: Translate = (key, values) =>
      (t as (key: string, values?: Record<string, unknown>) => string)(
        key,
        values,
      );
    const text = (value: Translatable): string =>
      resolveMessage(translate, value);
    return {
      /** Translates a message reference (nested references and lists included). */
      text,
      /** Select/segmented options whose `label` is a reference, with the label translated. */
      options: <T extends { label: MessageRef }>(
        list: readonly T[],
      ): (Omit<T, 'label'> & { label: string })[] =>
        list.map((option) => ({ ...option, label: text(option.label) })),
      season: (season: Season) => text(message(`labels.season.${season}`)),
      weekday: (day: Weekday) => text(message(`labels.weekday.${day}`)),
      /** Plural name, for "Closed on Mondays". */
      weekdayPlural: (day: Weekday) =>
        text(message(`labels.weekdayPlural.${day}`)),
      location: (location: Location) =>
        text(message(`labels.location.${location}`)),
      plantingStatus: (status: PlantingStatus) =>
        text(message(`labels.plantingStatus.${status}`)),
      quality: (quality: Quality) => text(message(`labels.quality.${quality}`)),
      machineStatus: (status: MachineStatus) =>
        text(message(`labels.machineStatus.${status}`)),
      fertilizerSpeed: (fertilizer: Fertilizer) =>
        text(message(`labels.fertilizerSpeed.${fertilizer}`)),
      /** Fertilizer names come from the game data; only the empty option is a label. */
      noFertilizer: text(message('labels.noFertilizer')),
      /** A schedule warning code; an unknown code is shown as it is. */
      warning: (code: string) =>
        (WARNINGS as readonly string[]).includes(code)
          ? text(message(`labels.warning.${code as (typeof WARNINGS)[number]}`))
          : code,
      eventKind: (kind: EventKind) => text(message(`labels.eventKind.${kind}`)),
      machineMarker: (kind: MachineMarkerKind) =>
        text(message(`labels.machineMarker.${kind}`)),
      giftTier: (tier: GiftTier) => text(message(`labels.giftTier.${tier}`)),
      gameDate: (date: GameDateIn) => text(gameDateMessage(date)),
      eventDays: (event: { season: Season; day: number; endDay?: number }) =>
        text(eventDaysMessage(event)),
      expectedYield: (perHarvest: number, total: number | null | undefined) =>
        text(expectedYieldMessage(perHarvest, total, locale)),
    };
  }, [t, locale]);
};
