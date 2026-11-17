import { createFileRoute, redirect } from '@tanstack/react-router';

/** The events list moved to a tab of the calendar page. */
export const Route = createFileRoute('/eventos/')({
  beforeLoad: () => {
    throw redirect({ to: '/calendario', search: { aba: 'eventos' } });
  },
});
