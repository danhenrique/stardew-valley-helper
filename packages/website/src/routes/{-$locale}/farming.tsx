import { createFileRoute, useSearch } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { useLocaleNavigate } from '../../components/LocaleLink';
import { MachinesTab } from '../../components/MachinesTab';
import { PlantingsTab } from '../../components/PlantingsTab';
import {
  type UnderlineTab,
  UnderlineTabs,
} from '../../components/UnderlineTabs';

export type FarmingTabId = 'plantings' | 'machines';

/** The `tab` search param; a missing or unknown tab opens the plantings. */
export const parseFarmingSearch = (
  search: Record<string, unknown>,
): { tab: FarmingTabId } => ({
  tab: search['tab'] === 'machines' ? 'machines' : 'plantings',
});

export const Route = createFileRoute('/{-$locale}/farming')({
  validateSearch: parseFarmingSearch,
  component: FarmingPage,
});

function FarmingPage() {
  const { tab } = parseFarmingSearch(useSearch({ strict: false }));
  const navigate = useLocaleNavigate();
  const t = useTranslations('farming');
  const tabs: readonly UnderlineTab<FarmingTabId>[] = [
    { id: 'plantings', label: t('tabs.plantings') },
    { id: 'machines', label: t('tabs.machines') },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        {t('title')}
      </h1>
      <UnderlineTabs
        tabs={tabs}
        value={tab}
        onChange={(next) =>
          navigate({
            to: '/{-$locale}/farming',
            search: { tab: next },
            replace: true,
          })
        }
        navLabel={t('sections')}
        selectLabel={t('chooseSection')}
      />
      {tab === 'machines' ? <MachinesTab /> : <PlantingsTab />}
    </div>
  );
}
