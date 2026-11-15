import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { TagIcon } from '@heroicons/react/24/outline';
import { HandThumbUpIcon, HeartIcon } from '@heroicons/react/24/solid';
import { type ComponentType, type SVGProps, useId } from 'react';
import { useGameNames } from '../hooks/useGameNames';
import {
  GIFT_TIER_LABELS,
  GIFT_TIERS,
  type GiftEntry,
  type GiftTier,
  type GiftTastes as Tastes,
} from '../lib/gifts';
import { GameIcon } from './GameIcon';

// Cards adapted from Tailwind Plus application-ui-v4/react/lists/grid-lists/03-simple-cards.jsx;
// the other tiers sit behind a Headless UI Disclosure, so the gifts to give come first.

/** Tiers worth giving, shown as cards; the rest are tucked away. */
const GIVE_TIERS: readonly GiftTier[] = ['loves', 'likes'];

type TierStyle = {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  iconClass: string;
  tile: string;
  name: string;
};

const TIER_STYLES: Record<'loves' | 'likes', TierStyle> = {
  loves: {
    icon: HeartIcon,
    iconClass: 'text-rose-500 dark:text-rose-400',
    tile: 'bg-rose-50 dark:bg-rose-500/10',
    name: 'font-semibold text-gray-900 dark:text-white',
  },
  likes: {
    icon: HandThumbUpIcon,
    iconClass: 'text-green-600 dark:text-green-400',
    tile: 'bg-gray-50 dark:bg-white/5',
    name: 'font-medium text-gray-700 dark:text-gray-200',
  },
};

const useExcept = (entry: GiftEntry) => {
  const { nameOf } = useGameNames();
  return entry.except.length > 0
    ? `exceto ${entry.except.map(nameOf).join(', ')}`
    : undefined;
};

const EntryIcon = ({
  entry,
  name,
  size,
}: {
  entry: GiftEntry;
  name: string;
  size: 'sm' | 'md';
}) => (
  <GameIcon
    id={entry.kind === 'item' ? entry.id : ''}
    label={name}
    size={size}
    fallback={entry.kind === 'category' ? TagIcon : undefined}
  />
);

const GiftCard = ({ entry, style }: { entry: GiftEntry; style: TierStyle }) => {
  const { nameOf } = useGameNames();
  const name = nameOf(entry.id);
  const except = useExcept(entry);
  return (
    <li className="col-span-1 flex rounded-md shadow-xs dark:shadow-none">
      <div
        className={`flex w-12 shrink-0 items-center justify-center rounded-l-md border-y border-l border-gray-200 dark:border-white/10 ${style.tile}`}
      >
        <EntryIcon entry={entry} name={name} size="md" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center rounded-r-md border-y border-r border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-800/50">
        <span className={`break-words ${style.name}`}>{name}</span>
        {except && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {except}
          </span>
        )}
      </div>
    </li>
  );
};

const PlainRow = ({ entry }: { entry: GiftEntry }) => {
  const { nameOf } = useGameNames();
  const name = nameOf(entry.id);
  const except = useExcept(entry);
  return (
    <li className="py-1.5 text-sm text-gray-700 dark:text-gray-300">
      <span className="flex items-center gap-x-2">
        <EntryIcon entry={entry} name={name} size="sm" />
        {name}
      </span>
      {except && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {except}
        </p>
      )}
    </li>
  );
};

const TierHeading = ({
  id,
  tier,
  count,
  style,
}: {
  id: string;
  tier: GiftTier;
  count: number;
  style?: TierStyle;
}) => {
  const Icon = style?.icon;
  return (
    <div className="flex items-center gap-x-2">
      {Icon && (
        <Icon aria-hidden="true" className={`size-5 ${style.iconClass}`} />
      )}
      <h3
        id={id}
        className="text-sm font-semibold text-gray-900 dark:text-white"
      >
        {GIFT_TIER_LABELS[tier]}
      </h3>
      <span className="text-sm text-gray-500 dark:text-gray-400">{count}</span>
    </div>
  );
};

const CardTier = ({
  tier,
  entries,
  headingId,
}: {
  tier: 'loves' | 'likes';
  entries: GiftEntry[];
  headingId?: string;
}) => {
  const style = TIER_STYLES[tier];
  return (
    <section>
      {headingId && (
        <TierHeading
          id={headingId}
          tier={tier}
          count={entries.length}
          style={style}
        />
      )}
      <ul
        aria-labelledby={headingId}
        aria-label={headingId ? undefined : GIFT_TIER_LABELS[tier]}
        className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${headingId ? 'mt-3' : ''}`}
      >
        {entries.map((entry) => (
          <GiftCard
            key={`${entry.kind}-${entry.id}`}
            entry={entry}
            style={style}
          />
        ))}
      </ul>
    </section>
  );
};

const PlainTier = ({
  tier,
  entries,
  headingId,
}: {
  tier: GiftTier;
  entries: GiftEntry[];
  headingId?: string;
}) => (
  <section>
    {headingId && (
      <TierHeading id={headingId} tier={tier} count={entries.length} />
    )}
    <ul
      aria-labelledby={headingId}
      aria-label={headingId ? undefined : GIFT_TIER_LABELS[tier]}
      className="mt-1"
    >
      {entries.map((entry) => (
        <PlainRow key={`${entry.kind}-${entry.id}`} entry={entry} />
      ))}
    </ul>
  </section>
);

const isGiveTier = (tier: GiftTier): tier is 'loves' | 'likes' =>
  GIVE_TIERS.includes(tier);

/**
 * The villager's gift tastes: the gifts to give (loves, likes) as cards, the other tiers
 * behind a "show more" toggle. A single requested tier gets no heading.
 */
export const GiftTastes = ({
  tastes,
  tiers = GIFT_TIERS,
}: {
  tastes: Tastes;
  tiers?: readonly GiftTier[];
}) => {
  const shown = tiers.filter((tier) => tastes[tier].length > 0);
  const idPrefix = useId();
  const headingId = (tier: GiftTier) =>
    tiers.length > 1 ? `${idPrefix}-${tier}` : undefined;
  const give = shown.filter(isGiveTier);
  const others = shown.filter((tier) => !isGiveTier(tier));
  const othersCount = others.reduce(
    (total, tier) => total + tastes[tier].length,
    0,
  );

  return (
    <div className="space-y-6">
      {give.map((tier) => (
        <CardTier
          key={tier}
          tier={tier}
          entries={tastes[tier]}
          headingId={headingId(tier)}
        />
      ))}
      {others.length > 0 &&
        (give.length === 0 ? (
          others.map((tier) => (
            <PlainTier
              key={tier}
              tier={tier}
              entries={tastes[tier]}
              headingId={headingId(tier)}
            />
          ))
        ) : (
          <Disclosure as="div">
            <DisclosureButton className="group inline-flex items-center gap-x-1 text-sm font-semibold text-green-700 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:text-green-400 dark:hover:text-green-300">
              {`Ver outras preferências (${othersCount})`}
              <ChevronDownIcon
                aria-hidden="true"
                className="size-5 group-data-open:rotate-180"
              />
            </DisclosureButton>
            <DisclosurePanel className="mt-4 space-y-4">
              {others.map((tier) => (
                <PlainTier
                  key={tier}
                  tier={tier}
                  entries={tastes[tier]}
                  headingId={headingId(tier)}
                />
              ))}
            </DisclosurePanel>
          </Disclosure>
        ))}
    </div>
  );
};
