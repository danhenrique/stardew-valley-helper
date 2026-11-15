import type { Location } from '../generated/stardew-valley-api/types.gen';
import { LOCATION_LABELS } from '../lib/i18n';
import { UnderlineTabs } from './UnderlineTabs';

export type LocationTab = 'all' | Location;

const TABS: { id: LocationTab; label: string }[] = [
  { id: 'all', label: 'Todos' },
  ...(Object.entries(LOCATION_LABELS) as [Location, string][]).map(
    ([id, label]) => ({ id, label }),
  ),
];

type LocationTabsProps = {
  value: LocationTab;
  counts: Record<LocationTab, number>;
  onChange: (tab: LocationTab) => void;
};

export const LocationTabs = ({
  value,
  counts,
  onChange,
}: LocationTabsProps) => (
  <UnderlineTabs
    tabs={TABS}
    value={value}
    counts={counts}
    onChange={onChange}
    navLabel="Locais"
    selectLabel="Escolher local"
  />
);
