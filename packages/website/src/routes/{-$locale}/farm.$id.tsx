import { createFileRoute } from '@tanstack/react-router';
import { FarmPlanPage } from '../../components/FarmPlanner/FarmPlanPage';

export const Route = createFileRoute('/{-$locale}/farm/$id')({
  component: FarmEditorPage,
});

function FarmEditorPage() {
  const { id } = Route.useParams();
  return <FarmPlanPage planId={id} />;
}
