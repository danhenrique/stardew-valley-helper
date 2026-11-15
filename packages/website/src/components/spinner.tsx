import type React from 'react';
import { SkeletonPage } from './Skeleton';

/** Shown while the app starts (auth and runtime config): a generic page skeleton. */
export const Spinner: React.FC = () => (
  <div className="p-4 sm:p-6">
    <SkeletonPage label="Carregando..." />
  </div>
);
