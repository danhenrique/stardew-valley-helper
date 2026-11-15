import { useEffect, useState } from 'react';
import type { PlantingDraft } from '../components/PlantingForm';
import type {
  MachineScheduleOut,
  MachineSchedulePreviewIn,
  ProfileIn,
  ScheduleOut,
  SchedulePreviewIn,
} from '../generated/stardew-valley-api/types.gen';
import type { MachineDraft } from '../lib/machines';
import { useMachineSchedulePreview, useSchedulePreview } from './useGameData';

const PREVIEW_DEBOUNCE_MS = 300;

type PreviewMutation<Body, Result> = {
  mutate: (
    body: Body,
    options: { onSuccess: (result: Result) => void; onError: () => void },
  ) => void;
  isPending: boolean;
};

/**
 * Debounced preview request for the draft being edited: waits 300 ms after the last change and
 * clears the result while there is no valid draft. `toBody` must be stable (module level).
 */
const useDebouncedPreview = <Draft, Body, Result>(
  draft: Draft | null,
  profile: ProfileIn | undefined,
  preview: PreviewMutation<Body, Result>,
  toBody: (draft: Draft, profile: ProfileIn) => Body,
): { schedule: Result | null; loading: boolean } => {
  const { mutate: requestPreview } = preview;
  const [schedule, setSchedule] = useState<Result | null>(null);

  useEffect(() => {
    if (!draft || !profile) {
      setSchedule(null);
      return;
    }
    const timer = setTimeout(() => {
      requestPreview(toBody(draft, profile), {
        onSuccess: setSchedule,
        onError: () => setSchedule(null),
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, profile, requestPreview, toBody]);

  return { schedule, loading: preview.isPending };
};

const plantingPreviewBody = (
  draft: PlantingDraft,
  profile: ProfileIn,
): SchedulePreviewIn => ({
  ...draft,
  agriculturist: Boolean(profile.agriculturist),
  today: profile.currentDate,
});

const machinePreviewBody = (
  draft: MachineDraft,
  profile: ProfileIn,
): MachineSchedulePreviewIn => ({ ...draft, today: profile.currentDate });

/** Debounced `POST /schedule` preview for the planting being edited. */
export const useDraftSchedule = (
  draft: PlantingDraft | null,
  profile: ProfileIn | undefined,
): { schedule: ScheduleOut | null; loading: boolean } =>
  useDebouncedPreview(
    draft,
    profile,
    useSchedulePreview(),
    plantingPreviewBody,
  );

/** Debounced machine schedule preview for the batch being edited. */
export const useDraftMachineSchedule = (
  draft: MachineDraft | null,
  profile: ProfileIn | undefined,
): { schedule: MachineScheduleOut | null; loading: boolean } =>
  useDebouncedPreview(
    draft,
    profile,
    useMachineSchedulePreview(),
    machinePreviewBody,
  );
