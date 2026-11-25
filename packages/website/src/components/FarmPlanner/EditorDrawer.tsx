import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';

// Adapted from Tailwind Plus overlays/drawers/02-with-background-overlay.jsx, opening from the
// bottom so the map keeps the screen on phones (palette and details below `lg`).
export function EditorDrawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('common');
  return (
    <Dialog open={open} onClose={onClose} className="relative z-10 lg:hidden">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity duration-300 ease-in-out data-closed:opacity-0 dark:bg-gray-900/50"
      />
      <div className="fixed inset-0 overflow-hidden">
        <div className="pointer-events-none fixed inset-x-0 bottom-0 flex max-h-full pt-16">
          <DialogPanel
            transition
            className="pointer-events-auto w-screen transform transition duration-300 ease-in-out data-closed:translate-y-full"
          >
            <div className="relative flex max-h-[75dvh] flex-col overflow-y-auto rounded-t-xl bg-white py-6 shadow-xl dark:bg-gray-800 dark:outline dark:outline-white/10">
              <div className="px-4 sm:px-6">
                <div className="flex items-start justify-between">
                  <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white">
                    {title}
                  </DialogTitle>
                  <div className="ml-3 flex h-7 items-center">
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={t('close')}
                      title={t('close')}
                      className="relative rounded-md text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:hover:text-white dark:focus-visible:outline-green-500"
                    >
                      <span className="absolute -inset-2.5" />
                      <XMarkIcon aria-hidden="true" className="size-6" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="relative mt-4 flex-1 px-4 sm:px-6">
                {children}
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
