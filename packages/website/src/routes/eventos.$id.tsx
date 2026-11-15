import { createFileRoute } from '@tanstack/react-router';
import { EventDetailPage } from '../components/EventDetailPage';

export const Route = createFileRoute('/eventos/$id')({
  component: EventPage,
});

function EventPage() {
  const { id } = Route.useParams();
  return <EventDetailPage id={id} />;
}
