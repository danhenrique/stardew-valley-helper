import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';

// Adapted from Tailwind Plus overlays/modal-dialogs/04-simple-with-dismiss-button.jsx
// (footer from 05-simple-with-gray-footer.jsx).
export const Modal = ({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) => (
  <Dialog open={open} onClose={onClose} className="relative z-10">
    <DialogBackdrop
      transition
      className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:bg-gray-900/50"
    />
    <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 sm:items-center sm:p-0">
        <DialogPanel
          transition
          className="relative w-full transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:max-w-lg data-closed:sm:translate-y-0 data-closed:sm:scale-95 dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10"
        >
          <div className="flex items-start justify-between gap-x-4 px-4 pt-5 sm:px-6 sm:pt-6">
            <div className="min-w-0">
              <DialogTitle
                as="h2"
                className="text-base font-semibold text-gray-900 dark:text-white"
              >
                {title}
              </DialogTitle>
              {subtitle && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              title="Fechar"
              className="rounded-md text-gray-400 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:hover:text-gray-300"
            >
              <XMarkIcon aria-hidden="true" className="size-6" />
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-6">
            {children}
          </div>
          {footer && (
            <div className="flex justify-end bg-gray-50 px-4 py-3 sm:px-6 dark:bg-gray-700/25">
              {footer}
            </div>
          )}
        </DialogPanel>
      </div>
    </div>
  </Dialog>
);
