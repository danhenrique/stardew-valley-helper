import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlacedObject } from '../../lib/farmPlanner/types';
import type { Translatable } from '../../lib/message';
import { apiErrorMessage } from '../Notifications';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

/** Autosave fires this long after the last change. */
export const AUTOSAVE_DELAY_MS = 1500;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;

type SaveInput = {
  planId: string;
  name: string;
  objects: PlacedObject[];
  version: number;
};

export type AutosaveOptions = {
  planId: string;
  name: string;
  initialVersion: number;
  /** PUTs the plan; resolves with the new version, rejects with `{ status }` on HTTP errors. */
  save: (input: SaveInput) => Promise<{ version: number }>;
  /** Reads the current server plan (used to resolve a conflict). */
  fetchPlan: () => Promise<{ version: number; objects: PlacedObject[] }>;
  /** Replaces the editor objects with the server ones after "Recarregar". */
  onReload: (objects: PlacedObject[]) => void;
};

const statusOf = (error: unknown) =>
  (error as { status?: unknown } | null)?.status;
const isConflict = (error: unknown) => statusOf(error) === 409;
/** The server refused the plan itself: sending it again cannot succeed. */
const isRejected = (error: unknown) => {
  const status = statusOf(error);
  return (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    status !== 409
  );
};

/**
 * Debounced, serialized plan saving. At most one save is in flight; changes made meanwhile are
 * coalesced into one follow-up save that sends the version the previous save returned.
 */
export const useAutosave = (options: AutosaveOptions) => {
  const [status, setStatus] = useState<SaveState>('idle');
  const [unsaved, setUnsaved] = useState(false);
  // Server detail of a rejected save (4xx other than 409), shown with the error state.
  const [errorMessage, setErrorMessage] = useState<Translatable>();

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const version = useRef(options.initialVersion);
  const latest = useRef<PlacedObject[]>([]);
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const conflict = useRef(false);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // After unmount the last changes are still sent, but nothing is retried or rendered.
  const mounted = useRef(true);

  const syncUnsaved = useCallback(() => {
    if (mounted.current) setUnsaved(dirty.current || inFlight.current);
  }, []);
  const show = useCallback((next: SaveState, message?: Translatable) => {
    if (!mounted.current) return;
    setStatus(next);
    setErrorMessage(message);
  }, []);

  const clearTimer = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const flushRef = useRef<() => void>(() => undefined);

  const later = useCallback(
    (ms: number) => {
      clearTimer();
      timer.current = setTimeout(() => {
        timer.current = undefined;
        flushRef.current();
      }, ms);
    },
    [clearTimer],
  );

  flushRef.current = () => {
    if (inFlight.current || conflict.current || !dirty.current) return;
    const objects = latest.current;
    const { planId, name, save } = optionsRef.current;
    dirty.current = false;
    inFlight.current = true;
    syncUnsaved();
    show('saving');
    save({ planId, name, objects, version: version.current }).then(
      (saved) => {
        inFlight.current = false;
        version.current = saved.version;
        failures.current = 0;
        syncUnsaved();
        if (!dirty.current) show('saved');
        // A change made during the save: send it now unless its debounce is still running.
        else if (timer.current === undefined) flushRef.current();
      },
      (error: unknown) => {
        inFlight.current = false;
        if (!dirty.current) {
          dirty.current = true;
          latest.current = objects;
        }
        syncUnsaved();
        if (isConflict(error)) {
          conflict.current = true;
          clearTimer();
          show('conflict');
          return;
        }
        if (isRejected(error)) {
          // Wait for the next edit instead of retrying; it is saved on the normal debounce.
          show('error', apiErrorMessage(error));
          return;
        }
        show('error');
        if (!mounted.current) return;
        const delay = Math.min(
          RETRY_BASE_MS * 2 ** failures.current,
          RETRY_MAX_MS,
        );
        failures.current += 1;
        // A newer change already waits on its own debounce.
        if (timer.current === undefined) later(delay);
      },
    );
  };

  const schedule = useCallback(
    (objects: PlacedObject[]) => {
      latest.current = objects;
      dirty.current = true;
      syncUnsaved();
      if (conflict.current) return;
      later(AUTOSAVE_DELAY_MS);
    },
    [later, syncUnsaved],
  );

  const resolveConflict = useCallback(
    async (keepLocal: boolean) => {
      if (!conflict.current) return;
      show('saving');
      let server: { version: number; objects: PlacedObject[] };
      try {
        server = await optionsRef.current.fetchPlan();
      } catch {
        show('conflict');
        return;
      }
      conflict.current = false;
      version.current = server.version;
      failures.current = 0;
      if (keepLocal) {
        dirty.current = true;
        flushRef.current();
        return;
      }
      clearTimer();
      dirty.current = false;
      latest.current = server.objects;
      syncUnsaved();
      optionsRef.current.onReload(server.objects);
      show('saved');
    },
    [clearTimer, show, syncUnsaved],
  );

  const overwrite = useCallback(() => resolveConflict(true), [resolveConflict]);
  const reload = useCallback(() => resolveConflict(false), [resolveConflict]);

  useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers only prompt when returnValue is set.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsaved]);

  // Leaving the editor inside the app: send what is pending instead of dropping it.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimer();
      flushRef.current();
    };
  }, [clearTimer]);

  return { status, errorMessage, unsaved, schedule, overwrite, reload };
};
