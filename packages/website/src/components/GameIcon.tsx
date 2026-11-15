import { PhotoIcon } from '@heroicons/react/20/solid';
import { type ComponentType, useState } from 'react';
import { hasIcon, iconUrl } from '../lib/icons';

export type GameIconSize = 'sm' | 'md' | 'lg';

const SIZES: Record<GameIconSize, { className: string; px: number }> = {
  sm: { className: 'size-4', px: 16 },
  md: { className: 'size-6', px: 24 },
  lg: { className: 'size-12', px: 48 },
};

type FallbackIcon = ComponentType<{
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

type GameIconProps = {
  /** Data id of the entity (e.g. `abigail`, `strawberry-seeds`). */
  id: string;
  /** Translated name; the image's alt text when the icon stands alone. */
  label: string;
  size?: GameIconSize;
  /** True when the name is shown next to the icon, so screen readers do not repeat it. */
  decorative?: boolean;
  className?: string;
  /** Icon shown when the id has no sprite or it fails to load; a generic picture by default. */
  fallback?: FallbackIcon;
};

const Fallback = ({
  icon: Icon,
  size,
  className = '',
}: {
  icon: FallbackIcon;
  size: GameIconSize;
  className?: string;
}) => (
  <Icon
    aria-hidden="true"
    className={`${SIZES[size].className} shrink-0 text-gray-400 dark:text-gray-500 ${className}`}
  />
);

/** In-game sprite of an entity; the fallback icon when it has none or fails to load. */
export const GameIcon = ({
  id,
  label,
  size = 'md',
  decorative = true,
  className = '',
  fallback = PhotoIcon,
}: GameIconProps) => {
  // Remembers which id failed, so a reused instance shows the next id's sprite again.
  const [failedId, setFailedId] = useState<string | null>(null);
  if (failedId === id || !hasIcon(id)) {
    return <Fallback icon={fallback} size={size} className={className} />;
  }
  const { className: sizeClass, px } = SIZES[size];
  return (
    <img
      src={iconUrl(id)}
      alt={decorative ? '' : label}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      onError={() => setFailedId(id)}
      className={`${sizeClass} shrink-0 object-contain [image-rendering:pixelated] ${className}`}
    />
  );
};

/** Game sprite when the id has one; otherwise the given icon (e.g. an event kind's Heroicon). */
export const GameIconOr = (
  props: GameIconProps & { fallback: FallbackIcon },
) => <GameIcon {...props} />;
