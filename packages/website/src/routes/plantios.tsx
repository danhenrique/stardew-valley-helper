import { createFileRoute, redirect } from '@tanstack/react-router';

/** The plantings moved to a tab of the production page. */
export const Route = createFileRoute('/plantios')({
  beforeLoad: () => {
    throw redirect({ to: '/producao', search: { aba: 'plantios' } });
  },
});
