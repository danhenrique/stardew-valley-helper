import { useTranslations } from 'use-intl';
import type { Location } from '../generated/stardew-valley-api/types.gen';
import { LOCATIONS } from '../lib/i18n';
import { UnderlineTabs } from './UnderlineTabs';
import { useLabels } from './useLabels';

export type LocationTab = 'all' | Location;

type LocationTabsProps = {
  value: LocationTab;
  counts: Record<LocationTab, number>;
  onChange: (tab: LocationTab) => void;
};

export const LocationTabs = ({
  value,
  counts,
  onChange,
}: LocationTabsProps) => {
  const labels = useLabels();
  const t = useTranslations('common.locationTabs');
  const tabs: { id: LocationTab; label: string }[] = [
    { id: 'all', label: t('all') },
    ...LOCATIONS.map((id) => ({ id, label: labels.location(id) })),
  ];
  return (
    <UnderlineTabs
      tabs={tabs}
      value={value}
      counts={counts}
      onChange={onChange}
      navLabel={t('nav')}
      selectLabel={t('choose')}
    />
  );
};
