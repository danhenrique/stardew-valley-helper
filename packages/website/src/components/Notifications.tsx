import { Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslations } from 'use-intl';
import { type MessageRef, message, type Translatable } from '../lib/message';
import type { MessageKey } from '../lib/messages';
import { useLabels } from './useLabels';

// Adapted from Tailwind Plus application-ui-v4/react/overlays/notifications/01-simple.jsx
// and application-ui-v4/react/overlays/notifications/02-condensed.jsx (undo variant)
export const UNDO_TIMEOUT_MS = 5000;

const API_DETAILS: Record<string, MessageKey> = {
  'Seed cannot be planted in this season': 'errors.api.seedNotInSeason',
  'Item is not plantable': 'errors.api.notPlantable',
  'Only regrowing crops can start from a harvest date': 'errors.api.regrowOnly',
  'Seed not found': 'errors.api.seedNotFound',
  'Planting not found': 'errors.api.plantingNotFound',
  'Output does not belong to this machine': 'errors.api.outputNotInMachine',
  'Machine not found': 'errors.api.machineNotFound',
  'Machine batch not found': 'errors.api.machineBatchNotFound',
  'Farm plan not found': 'errors.api.planNotFound',
  'Too many objects (max 8000)': 'errors.api.tooManyObjects',
};

/** Details that end with the offending object: the prefix is translated, the rest kept. */
const API_DETAIL_PREFIXES: [string, MessageKey][] = [
  ['Unknown object: ', 'errors.api.unknownObject'],
  ['Object outside the farm: ', 'errors.api.objectOutsideFarm'],
  ['Missing fixed object: ', 'errors.api.missingFixedObject'],
];

const translateDetail = (detail: string): MessageRef => {
  if (Object.prototype.hasOwnProperty.call(API_DETAILS, detail))
    return message(API_DETAILS[detail]);
  for (const [prefix, key] of API_DETAIL_PREFIXES) {
    if (detail.startsWith(prefix))
      return message(key, { object: detail.slice(prefix.length) });
  }
  return message('errors.generic');
};

/**
 * Error shapes produced by the generated client: business-rule 422s carry a validation-style
 * list (`detail[0].msg`), declared 404s carry `{ detail: string }`.
 */
export const apiErrorMessage = (error: unknown): MessageRef => {
  const detail = (error as { error?: { detail?: unknown } } | null)?.error
    ?.detail;
  const text = Array.isArray(detail)
    ? (detail[0] as { msg?: unknown } | undefined)?.msg
    : detail;
  return typeof text === 'string'
    ? translateDetail(text)
    : message('errors.generic');
};

type Notice = {
  kind: 'error' | 'undo';
  message: Translatable;
  onUndo?: () => void;
};

type NotificationsContextValue = {
  notifyError: (message: Translatable) => void;
  notifyUndo: (message: Translatable, onUndo: () => void) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export const useNotifications = (): NotificationsContextValue => {
  const value = useContext(NotificationsContext);
  if (!value)
    throw new Error(
      'useNotifications must be used within NotificationsProvider',
    );
  return value;
};

export const NotificationsProvider = ({ children }: PropsWithChildren) => {
  const [notice, setNotice] = useState<Notice | null>(null);
  // Keep the last notice rendered while the leave transition runs.
  const lastNotice = useRef<Notice | null>(null);
  const shown = notice ?? lastNotice.current;
  const labels = useLabels();
  const t = useTranslations('common');
  const notifyError = useCallback(
    (message: Translatable) => setNotice({ kind: 'error', message }),
    [],
  );
  const notifyUndo = useCallback(
    (message: Translatable, onUndo: () => void) =>
      setNotice({ kind: 'undo', message, onUndo }),
    [],
  );
  const value = useMemo(
    () => ({ notifyError, notifyUndo }),
    [notifyError, notifyUndo],
  );

  useEffect(() => {
    if (notice) lastNotice.current = notice;
  }, [notice]);

  useEffect(() => {
    if (notice?.kind !== 'undo') return;
    const timer = setTimeout(() => setNotice(null), UNDO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6"
      >
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          <Transition show={notice !== null}>
            <div className="pointer-events-auto w-full max-w-sm rounded-lg bg-white shadow-lg outline-1 outline-black/5 transition data-closed:opacity-0 data-enter:transform data-enter:duration-300 data-enter:ease-out data-closed:data-enter:translate-y-2 data-leave:duration-100 data-leave:ease-in data-closed:data-enter:sm:translate-x-2 data-closed:data-enter:sm:translate-y-0 dark:bg-gray-800 dark:-outline-offset-1 dark:outline-white/10">
              {shown?.kind === 'undo' ? (
                <div className="p-4">
                  <div className="flex items-center">
                    <div className="flex w-0 flex-1 justify-between">
                      <p className="w-0 flex-1 text-sm font-medium text-gray-900 dark:text-white">
                        {shown && labels.text(shown.message)}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          notice?.onUndo?.();
                          setNotice(null);
                        }}
                        className="ml-3 shrink-0 rounded-md bg-white text-sm font-medium text-green-600 hover:text-green-500 focus:outline-2 focus:outline-offset-2 focus:outline-green-600 dark:bg-gray-800 dark:text-green-400 dark:hover:text-green-300"
                      >
                        {t('undo')}
                      </button>
                    </div>
                    <div className="ml-4 flex shrink-0">
                      <button
                        type="button"
                        aria-label={t('close')}
                        title={t('close')}
                        onClick={() => setNotice(null)}
                        className="inline-flex rounded-md text-gray-400 hover:text-gray-500 focus:outline-2 focus:outline-offset-2 focus:outline-green-600 dark:hover:text-white"
                      >
                        <XMarkIcon aria-hidden="true" className="size-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-start">
                    <div className="shrink-0">
                      <ExclamationCircleIcon
                        aria-hidden="true"
                        className="size-6 text-red-400"
                      />
                    </div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {shown && labels.text(shown.message)}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0">
                      <button
                        type="button"
                        aria-label={t('close')}
                        title={t('close')}
                        onClick={() => setNotice(null)}
                        className="inline-flex rounded-md text-gray-400 hover:text-gray-500 focus:outline-2 focus:outline-offset-2 focus:outline-green-600 dark:hover:text-white"
                      >
                        <XMarkIcon aria-hidden="true" className="size-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Transition>
        </div>
      </div>
    </NotificationsContext.Provider>
  );
};
