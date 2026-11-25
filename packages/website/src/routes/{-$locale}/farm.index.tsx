import { createFileRoute } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { PlanList } from '../../components/FarmPlanner/PlanList';

export const Route = createFileRoute('/{-$locale}/farm/')({
  component: FarmPlansPage,
});

function FarmPlansPage() {
  const t = useTranslations('farmPlanner');
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        {t('title')}
      </h1>
      <PlanList />
    </div>
  );
}
